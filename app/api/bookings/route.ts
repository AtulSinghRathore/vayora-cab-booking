import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredBookings, createBookingId, deletionDateFrom, ensureSchema, getDatabase } from "../../../lib/platform";
import { defaultFareConfig, parseFareProperties } from "../../../lib/fare-config";
import { sendBookingChangeNotification, sendBookingNotification } from "../../../lib/email";

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
  const requestToken = String(booking.requestToken || crypto.randomUUID()).slice(0, 100);
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking records are being connected. Please call us to book meanwhile." }, { status: 503 });

  await ensureSchema(db);
  await cleanupExpiredBookings(db);
  const existing = await db.prepare("SELECT id,notification_status FROM bookings WHERE request_token=?").bind(requestToken).first<{ id:string; notification_status:string }>();
  if (existing?.notification_status === "sent") {
    return NextResponse.json({ success: true, duplicate: true, bookingId: existing.id, message: `Request ${existing.id} was already received. No duplicate email was sent.` });
  }
  if (existing) return NextResponse.json({ error: "This booking request is already being processed. Please wait instead of submitting it again." }, { status: 409 });
  booking.identityDocumentDelivery = "admin-email-only";
  try {
    await db.prepare(`INSERT INTO bookings(id,customer_name,phone,email,pickup,destination,travel_date,pickup_time,trip_type,vehicle,fare_total,status,details_json,created_at,updated_at,delete_after,request_token,notification_status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,'processing')`).bind(id, booking.name, booking.phone, booking.email || null, booking.pickup, booking.destination, booking.travelDate, booking.pickupTime || null, booking.tripType, booking.vehicle, Number(booking.fareTotal), "pending", JSON.stringify(booking), now, now, requestToken).run();
  } catch {
    const duplicate = await db.prepare("SELECT id,notification_status FROM bookings WHERE request_token=?").bind(requestToken).first<{ id:string; notification_status:string }>();
    if (duplicate?.notification_status === "sent") return NextResponse.json({ success: true, duplicate: true, bookingId: duplicate.id, message: `Request ${duplicate.id} was already received. No duplicate email was sent.` });
    return NextResponse.json({ error: "This booking request is already being processed. Please wait instead of submitting it again." }, { status: 409 });
  }

  const emailResult = await sendBookingNotification(booking, id, document);
  if (!emailResult.ok) {
    await db.prepare("DELETE FROM bookings WHERE id=?").bind(id).run();
    return NextResponse.json({ error: "We could not send the booking email, so no booking was created. Please contact Vayora or ask the admin to run the email test." }, { status: 502 });
  }
  await db.prepare("UPDATE bookings SET notification_status='sent',updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
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
  type BookingRow = { id:string; status:string; customer_name:string; phone:string; pickup:string; destination:string; travel_date:string; pickup_time:string|null; fare_total:number };
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
    await db.prepare("UPDATE bookings SET status='cancelled',cancelled_at=?,delete_after=?,updated_at=?,admin_note=? WHERE id=?").bind(cancelledAt.toISOString(), deleteAfter, cancelledAt.toISOString(), `Customer cancellation. Applicable fee: ₹${Math.round(cancellationFee)}. Refund handled manually through WhatsApp payment channel.`, row.id).run();
    const notification = await sendBookingChangeNotification({
      action: "cancellation", bookingId: row.id, customerName: row.customer_name, phone: row.phone,
      pickup: row.pickup, destination: row.destination, previousTravelDate: row.travel_date,
      previousPickupTime: row.pickup_time, charge: cancellationFee, deleteAfter,
    });
    const feeMessage = cancellationFee ? `Applicable cancellation fee: ₹${Math.round(cancellationFee)}.` : "No cancellation fee applies.";
    return NextResponse.json({ success: true, cancellationFee, notificationSent: notification.ok, message: `Booking cancelled. ${feeMessage} ${notification.ok ? "Vayora has been notified by email." : "The admin panel was updated, but the notification email could not be sent."}` });
  }
  if (action === "amend") {
    const settings = await db.prepare("SELECT value FROM settings WHERE key='fare.properties'").first<{ value: string }>();
    const config = settings?.value ? parseFareProperties(settings.value) : defaultFareConfig;
    const amendmentFee = config.cancellation.amendmentFee;
    const newTravelDate = String(travelDate || row.travel_date);
    const newPickupTime = String(pickupTime || row.pickup_time || "");
    const customerNote = String(note || "Customer amendment request").slice(0, 1000);
    const updatedFare = Number(row.fare_total) + amendmentFee;
    await db.prepare("UPDATE bookings SET travel_date=?,pickup_time=?,fare_total=?,status='amendment_requested',admin_note=?,updated_at=? WHERE id=?")
      .bind(newTravelDate, newPickupTime || null, updatedFare, `${customerNote} Amendment fee: ₹${Math.round(amendmentFee)}.`, new Date().toISOString(), row.id).run();
    const notification = await sendBookingChangeNotification({
      action: "amendment", bookingId: row.id, customerName: row.customer_name, phone: row.phone,
      pickup: row.pickup, destination: row.destination, previousTravelDate: row.travel_date,
      previousPickupTime: row.pickup_time, newTravelDate, newPickupTime, customerNote,
      charge: amendmentFee, updatedFare,
    });
    return NextResponse.json({ success: true, amendmentFee, updatedFare, notificationSent: notification.ok, message: `Amendment requested. ₹${Math.round(amendmentFee)} has been added to the fare. ${notification.ok ? "Vayora has been notified by email." : "The admin panel was updated, but the notification email could not be sent."} Payment instructions will be shared on WhatsApp.` });
  }
  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
