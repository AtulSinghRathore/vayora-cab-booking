import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredBookings, createBookingId, deletionDateFrom, ensureSchema, getDatabase } from "../../../lib/platform";
import { defaultFareConfig, parseFareProperties } from "../../../lib/fare-config";
import { sendBookingNotification, sendDeletionReminder } from "../../../lib/email";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let booking: Record<string, unknown> = {};
  let document: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    booking = JSON.parse(String(form.get("booking") || "{}"));
    const file = form.get("identityDocument");
    document = file instanceof File && file.size ? file : null;
  } else booking = await request.json();

  const required = ["name", "phone", "pickup", "destination", "travelDate", "vehicle", "fareTotal"];
  if (required.some((key) => !String(booking[key] ?? "").trim())) return NextResponse.json({ error: "Please complete all required booking details." }, { status: 400 });
  if (!document) return NextResponse.json({ error: "Please upload a JPG or PNG identity document." }, { status: 400 });
  if (!["image/jpeg", "image/png"].includes(document.type) || document.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Identity document must be JPG or PNG and no larger than 5 MB." }, { status: 400 });

  const id = createBookingId();
  const now = new Date().toISOString();
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking records are being connected. Please call us to book meanwhile." }, { status: 503 });

  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  booking.identityDocumentDelivery = "admin-email-only";
  await db.prepare(`INSERT INTO bookings(id,customer_name,phone,email,pickup,destination,travel_date,pickup_time,trip_type,vehicle,fare_total,status,details_json,created_at,updated_at,delete_after)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`).bind(id, booking.name, booking.phone, booking.email || null, booking.pickup, booking.destination, booking.travelDate, booking.pickupTime || null, booking.tripType, booking.vehicle, Number(booking.fareTotal), "pending", JSON.stringify(booking), now, now).run();

  const emailed = await sendBookingNotification(booking, id, document);
  if (!emailed) {
    await db.prepare("DELETE FROM bookings WHERE id=?").bind(id).run();
    return NextResponse.json({ error: "We could not email your identity document, so no booking was created. Please try again or call Vayora." }, { status: 502 });
  }
  return NextResponse.json({ success: true, bookingId: id, message: `Request ${id} was received and emailed with your identity document. It is pending approval.` });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim().toUpperCase();
  const phone = request.nextUrl.searchParams.get("phone")?.replace(/\D/g, "");
  if (!id || !phone) return NextResponse.json({ error: "Booking ID and mobile number are required." }, { status: 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking lookup is not connected yet." }, { status: 503 });
  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const row = await db.prepare("SELECT id,pickup,destination,travel_date,pickup_time,trip_type,vehicle,fare_total,status,driver_name,driver_phone,admin_note,created_at FROM bookings WHERE id=? AND REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-','') LIKE ?")
    .bind(id, `%${phone.slice(-10)}`).first();
  return row ? NextResponse.json(row) : NextResponse.json({ error: "No booking matched those details." }, { status: 404 });
}

export async function PATCH(request: NextRequest) {
  const { id, phone, action, travelDate, pickupTime, note } = await request.json();
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking updates are not connected yet." }, { status: 503 });
  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  type BookingRow = { id:string; status:string; travel_date:string; pickup_time:string|null; fare_total:number };
  const row = await db.prepare("SELECT * FROM bookings WHERE id=? AND REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-','') LIKE ?").bind(String(id).toUpperCase(), `%${digits}`).first<BookingRow>();
  if (!row) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (action === "cancel") {
    if (["cancelled", "rejected", "completed"].includes(row.status)) return NextResponse.json({ error: "This booking can no longer be cancelled." }, { status: 400 });
    const settings = await db.prepare("SELECT value FROM settings WHERE key='fare.properties'").first<{ value: string }>();
    const config = settings?.value ? parseFareProperties(settings.value) : defaultFareConfig;
    const daysBefore = Math.ceil((new Date(`${row.travel_date}T00:00:00+05:30`).getTime() - Date.now()) / 86400000);
    const cancellationFee = daysBefore >= config.cancellation.freeBeforeDays ? 0 : daysBefore >= 2
      ? Math.min(config.cancellation.maximumWithinWeek, Number(row.fare_total) * config.cancellation.withinWeekPercent / 100)
      : Math.min(config.cancellation.maximumWithin48Hours, Number(row.fare_total) * config.cancellation.within48HoursPercent / 100);
    const cancelledAt = new Date();
    const deleteAfter = deletionDateFrom(cancelledAt);
    await db.prepare("UPDATE bookings SET status='cancelled',cancelled_at=?,delete_after=?,updated_at=?,admin_note=? WHERE id=?").bind(cancelledAt.toISOString(), deleteAfter, cancelledAt.toISOString(), `Customer cancellation. Indicative fee: ₹${Math.round(cancellationFee)}`, row.id).run();
    await sendDeletionReminder({ bookingId: row.id, status: "cancelled", deleteAfter });
    return NextResponse.json({ success: true, cancellationFee, message: cancellationFee ? `Cancellation recorded. Applicable fee: ₹${Math.round(cancellationFee)}.` : "Booking cancelled with no fee." });
  }
  if (action === "amend") {
    const dateChanged = travelDate && travelDate !== row.travel_date;
    const settings = await db.prepare("SELECT value FROM settings WHERE key='fare.properties'").first<{ value: string }>();
    const config = settings?.value ? parseFareProperties(settings.value) : defaultFareConfig;
    await db.prepare("UPDATE bookings SET travel_date=?,pickup_time=?,status='amendment_requested',admin_note=?,updated_at=? WHERE id=?")
      .bind(travelDate || row.travel_date, pickupTime || row.pickup_time, note || "Customer amendment request", new Date().toISOString(), row.id).run();
    return NextResponse.json({ success: true, dateChangeFeeApplies: Boolean(dateChanged), dateChangeFee: dateChanged ? config.cancellation.dateChangeFee : 0, message: dateChanged ? `Amendment requested. Configured date-change fee: ₹${config.cancellation.dateChangeFee}; it will be confirmed before approval.` : "Amendment requested with no amendment fee." });
  }
  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
