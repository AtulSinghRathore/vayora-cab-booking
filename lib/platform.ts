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

export type R2Bucket = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
};

export const getDatabase = () => (process.env.DB as unknown as D1Database | undefined);
export const getDocuments = () => (process.env.DOCUMENTS as unknown as R2Bucket | undefined);

export async function ensureSchema(db: D1Database) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT, pickup TEXT NOT NULL, destination TEXT NOT NULL,
      travel_date TEXT NOT NULL, pickup_time TEXT, trip_type TEXT NOT NULL,
      vehicle TEXT NOT NULL, fare_total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      details_json TEXT NOT NULL, document_key TEXT, document_delete_after TEXT,
      driver_name TEXT, driver_phone TEXT, admin_note TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cancelled_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_travel_date ON bookings(travel_date)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  ];
  for (const query of queries) await db.prepare(query).run();
}

export function createBookingId() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `VAY-${date}-${random}`;
}

export async function cleanupExpiredDocuments(db: D1Database, bucket: R2Bucket) {
  await ensureSchema(db);
  const expired = await db.prepare("SELECT id,document_key FROM bookings WHERE document_key IS NOT NULL AND document_delete_after <= ? LIMIT 50")
    .bind(new Date().toISOString()).all<{ id: string; document_key: string }>();
  for (const row of expired.results || []) {
    await bucket.delete(row.document_key);
    await db.prepare("UPDATE bookings SET document_key=NULL,updated_at=? WHERE id=?").bind(new Date().toISOString(), row.id).run();
  }
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
