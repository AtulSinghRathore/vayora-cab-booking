import { NextRequest, NextResponse } from "next/server";

const notificationEmail = process.env.BOOKING_NOTIFICATION_EMAIL || "natul0636@gmail.com";
const businessPhone = process.env.BOOKING_PHONE || "+919304591415";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email service is not configured yet. Please call the booking number." },
      { status: 503 },
    );
  }

  const booking = await request.json();
  const required = ["name", "phone", "pickup", "destination", "travelDate", "vehicle", "fareTotal"];
  if (required.some((key) => !String(booking[key] ?? "").trim())) {
    return NextResponse.json({ error: "Please complete all required booking details." }, { status: 400 });
  }

  const rows = [
    ["Customer", booking.name], ["Customer phone", booking.phone], ["Customer email", booking.email || "Not provided"],
    ["Pickup", booking.pickup], ["Destination", booking.destination], ["Travel date", booking.travelDate],
    ["Pickup time", booking.pickupTime], ["Trip type", booking.tripType], ["Vehicle", booking.vehicle],
    ...(booking.airport ? [["Airport", booking.airport], ["Flight number", booking.flightNumber || "Not provided"], ["Passengers", booking.passengers], ["Luggage", booking.luggage], ["Exact pickup/drop address", booking.pickupAddress || "Not provided"]] : []),
    ["Days", booking.days], ["Overnight stays", booking.overnightStays], ["Estimated distance", `${booking.distanceKm} km`],
    ["Estimated fare", `₹${booking.fareTotal}`], ["Customer note", booking.note || "None"],
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.BOOKING_FROM_EMAIL || "Vayora Bookings <onboarding@resend.dev>",
      to: [notificationEmail],
      reply_to: booking.email || undefined,
      subject: `New Vayora booking: ${booking.pickup} to ${booking.destination}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>New Vayora cab request</h2><p>Call the customer to confirm this booking. Business contact: ${escapeHtml(businessPhone)}</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:9px;border-bottom:1px solid #ddd;font-weight:bold">${escapeHtml(label)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join("")}</table></div>`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "The booking was saved on screen, but email delivery failed." }, { status: 502 });
  }

  return NextResponse.json({ success: true, message: "Booking request sent. We will call you shortly." });
}
