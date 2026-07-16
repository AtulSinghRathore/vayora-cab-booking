import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDatabase, verifyAdmin } from "../../../../lib/platform";

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  const result = await db.prepare("SELECT * FROM bookings ORDER BY travel_date, created_at DESC").all();
  return NextResponse.json(result.results || []);
}

export async function PATCH(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Cloudflare D1 is not connected." }, { status: 503 });
  await ensureSchema(db);
  const { id, status, driverName, driverPhone, adminNote } = await request.json();
  if (!id || !["pending", "approved", "rejected", "completed"].includes(status)) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  await db.prepare("UPDATE bookings SET status=?, driver_name=?, driver_phone=?, admin_note=?, updated_at=? WHERE id=?")
    .bind(status, driverName || null, driverPhone || null, adminNote || null, new Date().toISOString(), id).run();
  return NextResponse.json({ success: true });
}
