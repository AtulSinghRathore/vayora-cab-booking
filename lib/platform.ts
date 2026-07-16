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

type VayoraBindings = Record<string, unknown> & {
  DB?: D1Database;
};

let bindings: VayoraBindings = {};

export function setRuntimeBindings(runtimeBindings: VayoraBindings) {
  bindings = runtimeBindings;
}

export function getRuntimeString(name: string, fallback = "") {
  const binding = bindings[name];
  if (typeof binding === "string" && binding.trim()) return binding;
  return process.env[name] || fallback;
}

export const getDatabase = () => bindings.DB || (process.env.DB as unknown as D1Database | undefined);

let schemaReady: Promise<void> | null = null;

async function initializeSchema(db: D1Database) {
  const queries = [
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT, pickup TEXT NOT NULL, destination TEXT NOT NULL,
      travel_date TEXT NOT NULL, pickup_time TEXT, trip_type TEXT NOT NULL,
      vehicle TEXT NOT NULL, fare_total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      details_json TEXT NOT NULL,
      driver_name TEXT, driver_phone TEXT, admin_note TEXT,
      minimum_booking_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, cancelled_at TEXT,
      delete_after TEXT, request_token TEXT, notification_status TEXT NOT NULL DEFAULT 'processing'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_travel_date ON bookings(travel_date)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS bill_drafts (
      booking_id TEXT PRIMARY KEY, summary_json TEXT NOT NULL, items_json TEXT NOT NULL,
      downloaded_at TEXT, delete_after TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )`,
  ];
  for (const query of queries) await db.prepare(query).run();
  const columns = await db.prepare("PRAGMA table_info(bookings)").all<{ name: string }>();
  const existing = new Set((columns.results || []).map((column) => column.name));
  const additions = [
    ["delete_after", "TEXT"],
    ["request_token", "TEXT"],
    ["notification_status", "TEXT NOT NULL DEFAULT 'processing'"],
    ["minimum_booking_amount", "REAL NOT NULL DEFAULT 0"],
  ];
  for (const [name, definition] of additions) {
    if (!existing.has(name)) await db.prepare(`ALTER TABLE bookings ADD COLUMN ${name} ${definition}`).run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_bookings_delete_after ON bookings(delete_after)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_request_token ON bookings(request_token)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_bill_drafts_delete_after ON bill_drafts(delete_after)").run();
}

export async function ensureSchema(db: D1Database) {
  if (!schemaReady) {
    schemaReady = initializeSchema(db).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
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
  await db.prepare("DELETE FROM bill_drafts WHERE delete_after IS NOT NULL AND delete_after <= ?")
    .bind(new Date().toISOString()).run();
}

export function billDraftDeletionDate(date = new Date()) {
  const deleteAfter = new Date(date);
  deleteAfter.setDate(deleteAfter.getDate() + 2);
  return deleteAfter.toISOString();
}

const encoder = new TextEncoder();
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

export async function issueAdminToken(email: string) {
  const secret = getRuntimeString("ADMIN_SESSION_SECRET");
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = toBase64Url(encoder.encode(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifyAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const [payload, suppliedSignature] = token.split(".");
  const secret = getRuntimeString("ADMIN_SESSION_SECRET");
  if (!payload || !suppliedSignature || !secret || await signature(payload, secret) !== suppliedSignature) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0))));
    return parsed.email === getRuntimeString("ADMIN_EMAIL", "anupkr9265@gmail.com") && parsed.exp > Date.now();
  } catch { return false; }
}
