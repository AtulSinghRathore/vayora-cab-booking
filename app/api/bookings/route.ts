import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredDocuments, createBookingId, ensureSchema, getDatabase, getDocuments } from "../../../lib/platform";
import { defaultFareConfig, parseFareProperties } from "../../../lib/fare-config";

const notificationEmail = process.env.BOOKING_NOTIFICATION_EMAIL || "natul0636@gmail.com";
const businessPhone = process.env.BOOKING_PHONE || "+919304591415";
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] || c);

async function sendEmail(booking: Record<string, unknown>, bookingId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const rows = [
    ["Request ID", bookingId], ["Customer", booking.name], ["Phone", booking.phone], ["Email", booking.email || "Not provided"],
    ["Pickup", booking.pickup], ["Destination", booking.destination], ["Travel date", booking.travelDate], ["Pickup time", booking.pickupTime],
    ["Trip", booking.tripType], ["Vehicle", booking.vehicle], ["Estimated distance", `${booking.distanceKm} km`],
    ["Estimated fare", `₹${booking.fareTotal}`], ["Airport", booking.airport || "No"], ["Flight", booking.flightNumber || "Not provided"],
    ["Customer note", booking.note || "None"], ["Identity document", booking.documentStored ? "Stored privately; delete 7 days after travel/cancellation" : "Not stored"],
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOOKING_FROM_EMAIL || "Vayora Bookings <onboarding@resend.dev>", to: [notificationEmail],
      reply_to: booking.email || undefined, subject: `Vayora request ${bookingId}: ${booking.pickup} to ${booking.destination}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h2>New Vayora booking request</h2><p>Review and approve this request in the admin panel. Contact: ${escapeHtml(businessPhone)}</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:9px;border-bottom:1px solid #ddd;font-weight:bold">${escapeHtml(label)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join("")}</table></div>`,
    }),
  });
  return response.ok;
}

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
  if (!document) return NextResponse.json({ error: "Please upload a JPG, PNG or PDF identity document." }, { status: 400 });
  if (!["image/jpeg", "image/png", "application/pdf"].includes(document.type) || document.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Identity document must be JPG, PNG or PDF and no larger than 5 MB." }, { status: 400 });

  const id = createBookingId();
  const now = new Date().toISOString();
  const deletionDate = new Date(`${booking.travelDate}T23:59:59+05:30`);
  deletionDate.setDate(deletionDate.getDate() + 7);
  const db = getDatabase();
  const bucket = getDocuments();
  if (!db || !bucket) return NextResponse.json({ error: "Secure booking storage is being connected. Please call us to book meanwhile." }, { status: 503 });

  await ensureSchema(db);
  await cleanupExpiredDocuments(db, bucket);
  const extension = document.type === "application/pdf" ? "pdf" : document.type === "image/png" ? "png" : "jpg";
  const documentKey = `identity/${id}.${extension}`;
  await bucket.put(documentKey, await document.arrayBuffer(), { httpMetadata: { contentType: document.type }, customMetadata: { bookingId: id, deleteAfter: deletionDate.toISOString() } });
  booking.documentStored = true;
  await db.prepare(`INSERT INTO bookings(id,customer_name,phone,email,pickup,destination,travel_date,pickup_time,trip_type,vehicle,fare_total,status,details_json,document_key,document_delete_after,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, booking.name, booking.phone, booking.email || null, booking.pickup, booking.destination, booking.travelDate, booking.pickupTime || null, booking.tripType, booking.vehicle, Number(booking.fareTotal), "pending", JSON.stringify(booking), documentKey, deletionDate.toISOString(), now, now).run();

  const emailed = await sendEmail(booking, id);
  return NextResponse.json({ success: true, bookingId: id, message: `Request ${id} received${emailed ? " and emailed" : ""}. It is pending approval.` });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim().toUpperCase();
  const phone = request.nextUrl.searchParams.get("phone")?.replace(/\D/g, "");
  if (!id || !phone) return NextResponse.json({ error: "Booking ID and mobile number are required." }, { status: 400 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking lookup is not connected yet." }, { status: 503 });
  await ensureSchema(db);
  const bucket = getDocuments(); if (bucket) await cleanupExpiredDocuments(db, bucket);
  const row = await db.prepare("SELECT id,pickup,destination,travel_date,pickup_time,trip_type,vehicle,fare_total,status,driver_name,driver_phone,admin_note,created_at FROM bookings WHERE id=? AND REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-','') LIKE ?")
    .bind(id, `%${phone.slice(-10)}`).first();
  return row ? NextResponse.json(row) : NextResponse.json({ error: "No booking matched those details." }, { status: 404 });
}

export async function PATCH(request: NextRequest) {
  const { id, phone, action, travelDate, pickupTime, note } = await request.json();
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Booking updates are not connected yet." }, { status: 503 });
  await ensureSchema(db);
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
    const cancelledAt = new Date(); const deleteAfter = new Date(cancelledAt); deleteAfter.setDate(deleteAfter.getDate() + 7);
    await db.prepare("UPDATE bookings SET status='cancelled',cancelled_at=?,document_delete_after=?,updated_at=?,admin_note=? WHERE id=?").bind(cancelledAt.toISOString(), deleteAfter.toISOString(), cancelledAt.toISOString(), `Customer cancellation. Indicative fee: ₹${Math.round(cancellationFee)}`, row.id).run();
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
