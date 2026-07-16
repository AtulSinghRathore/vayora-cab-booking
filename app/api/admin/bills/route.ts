import { NextRequest, NextResponse } from "next/server";
import { billDraftDeletionDate, cleanupExpiredBookings, ensureSchema, getDatabase, verifyAdmin } from "../../../../lib/platform";

const cleanId = (value: unknown) => String(value || "").trim().toUpperCase().slice(0, 40);

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const bookingId = cleanId(request.nextUrl.searchParams.get("bookingId"));
  if (!bookingId) return NextResponse.json({ error: "Enter a booking ID." }, { status: 400 });
  const booking = await db.prepare("SELECT * FROM bookings WHERE id=?").bind(bookingId).first<Record<string, unknown>>();
  if (!booking) return NextResponse.json({ error: "No booking matched that ID." }, { status: 404 });
  const draft = await db.prepare("SELECT * FROM bill_drafts WHERE booking_id=?").bind(bookingId).first<Record<string, unknown>>();
  let details: Record<string, unknown> = {};
  try { details = JSON.parse(String(booking.details_json || "{}")); } catch { /* keep empty */ }
  return NextResponse.json({ booking: { ...booking, details_json: undefined, details }, draft });
}

export async function PUT(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  const body = await request.json();
  const bookingId = cleanId(body.bookingId);
  const summary = Array.isArray(body.summary) ? body.summary.slice(0, 30) : [];
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!bookingId) return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
  const booking = await db.prepare("SELECT id FROM bookings WHERE id=?").bind(bookingId).first();
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO bill_drafts(booking_id,summary_json,items_json,downloaded_at,delete_after,created_at,updated_at)
    VALUES(?,?,?,NULL,NULL,?,?) ON CONFLICT(booking_id) DO UPDATE SET
    summary_json=excluded.summary_json,items_json=excluded.items_json,downloaded_at=NULL,delete_after=NULL,updated_at=excluded.updated_at`)
    .bind(bookingId, JSON.stringify(summary), JSON.stringify(items), now, now).run();
  return NextResponse.json({ success: true, message: "Draft saved. It will remain available until a PDF is downloaded." });
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  const bookingId = cleanId((await request.json()).bookingId);
  const now = new Date();
  const deleteAfter = billDraftDeletionDate(now);
  await db.prepare("UPDATE bill_drafts SET downloaded_at=?,delete_after=?,updated_at=? WHERE booking_id=?")
    .bind(now.toISOString(), deleteAfter, now.toISOString(), bookingId).run();
  return NextResponse.json({ success: true, deleteAfter, message: "PDF downloaded. This editable draft will be deleted automatically after two days." });
}
