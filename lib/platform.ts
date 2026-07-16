export type D1Result<T = Record<string, unknown>> = { results?: T[]; success?: boolean };

export type D1Database = {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<D1Result<T>> };
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<unknown>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  };
  batch(statements: unknown[]): Promise<unknown>;
};

export const getDatabase = () => (process.env.DB as unknown as D1Database | undefined);

export async function ensureSchema(db: D1Database) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT, pickup TEXT NOT NULL, destination TEXT NOT NULL,
      travel_date TEXT NOT NULL, pickup_time TEXT, trip_type TEXT NOT NULL,
      vehicle TEXT NOT NULL, fare_total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      details_json TEXT NOT NULL, document_key TEXT, document_delete_after TEXT,
      driver_name TEXT, driver_phone TEXT, admin_note TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cancelled_at TEXT,
      delete_after TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_travel_date ON bookings(travel_date)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  ];
  for (const query of queries) await db.prepare(query).run();
  // Existing installations predate record-level retention. D1 does not support
  // ADD COLUMN IF NOT EXISTS, so a duplicate-column error is safely ignored.
  try { await db.prepare("ALTER TABLE bookings ADD COLUMN delete_after TEXT").run(); } catch { /* already present */ }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_delete_after ON bookings(delete_after)").run();
}

export function createBookingId() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `VAY-${date}-${random}`;
}

export function deletionDateFrom(date = new Date()) {
  const deleteAfter = new Date(date);
  deleteAfter.setDate(deleteAfter.getDate() + 7);
  return deleteAfter.toISOString();
}

export async function cleanupExpiredBookings(db: D1Database) {
  await ensureSchema(db);
  await db.prepare(`DELETE FROM bookings WHERE id IN (
    SELECT id FROM bookings
    WHERE delete_after IS NOT NULL AND delete_after <= ?
      AND status IN ('completed','cancelled','rejected')
    LIMIT 100
  )`).bind(new Date().toISOString()).run();
}

const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

export async function issueAdminToken(email: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = toBase64Url(encoder.encode(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifyAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const [payload, suppliedSignature] = token.split(".");
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!payload || !suppliedSignature || !secret || await signature(payload, secret) !== suppliedSignature) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0))));
    return parsed.email === (process.env.ADMIN_EMAIL || "natul0636@gmail.com") && parsed.exp > Date.now();
  } catch { return false; }
}
