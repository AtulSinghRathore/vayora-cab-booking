import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredBookings, deletionDateFrom, ensureSchema, getDatabase, verifyAdmin } from "../../../../lib/platform";
import { sendDeletionReminder } from "../../../../lib/email";

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const result = await db.prepare("SELECT * FROM bookings ORDER BY travel_date, created_at DESC").all();
  return NextResponse.json(result.results || []);
}

export async function PATCH(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const { id, status, driverName, driverPhone, adminNote } = await request.json();
  if (!id || !["pending", "approved", "amendment_requested", "rejected", "cancelled", "completed"].includes(status)) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const current = await db.prepare("SELECT id,status,pickup,destination,delete_after FROM bookings WHERE id=?").bind(id).first<{ id:string; status:string; pickup:string; destination:string; delete_after:string|null }>();
  if (!current) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const now = new Date();
  const isTerminal = ["completed", "cancelled", "rejected"].includes(status);
  const newlyTerminal = isTerminal && current.status !== status;
  const deleteAfter = isTerminal ? current.delete_after || deletionDateFrom(now) : null;
  await db.prepare("UPDATE bookings SET status=?, driver_name=?, driver_phone=?, admin_note=?, delete_after=?, updated_at=? WHERE id=?")
    .bind(status, driverName || null, driverPhone || null, adminNote || null, deleteAfter, now.toISOString(), id).run();
  const reminderResult = newlyTerminal && deleteAfter
    ? await sendDeletionReminder({ bookingId: id, status, deleteAfter, route: `${current.pickup} to ${current.destination}` })
    : null;
  return NextResponse.json({ success: true, reminderSent: reminderResult?.ok || false, deleteAfter });
}
