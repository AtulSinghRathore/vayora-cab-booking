const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);

export type EmailResult = { ok: true } | { ok: false; error: string };

export function getEmailConfiguration() {
  return {
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    fromEmail: process.env.BOOKING_FROM_EMAIL || "Vayora Bookings <onboarding@resend.dev>",
    notificationEmail: process.env.BOOKING_NOTIFICATION_EMAIL || "natul0636@gmail.com",
  };
}

function fileToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function send(payload: Record<string, unknown>): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY is not configured in Cloudflare." };
  const configuration = getEmailConfiguration();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: configuration.fromEmail,
        to: [configuration.notificationEmail],
        ...payload,
      }),
    });
    if (response.ok) return { ok: true };
    const body = await response.text();
    let message = `Resend rejected the email (${response.status}).`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch { /* Resend did not return JSON */ }
    console.error("Vayora email delivery failed", response.status, message);
    return { ok: false, error: message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Resend.";
    console.error("Vayora email delivery failed", message);
    return { ok: false, error: message };
  }
}

export async function sendBookingNotification(booking: Record<string, unknown>, bookingId: string, document: File) {
  const businessPhone = process.env.BOOKING_PHONE || "+919304591415";
  const rows = [
    ["Request ID", bookingId], ["Customer", booking.name], ["Phone", booking.phone], ["Email", booking.email || "Not provided"],
    ["Pickup", booking.pickup], ["Destination", booking.destination], ["Travel date", booking.travelDate], ["Pickup time", booking.pickupTime],
    ["Trip", booking.tripType], ["Vehicle", booking.vehicle], ["Estimated distance", `${booking.distanceKm} km`],
    ["Estimated fare", `₹${booking.fareTotal}`], ["Airport", booking.airport || "No"], ["Flight", booking.flightNumber || "Not provided"],
    ["Customer note", booking.note || "None"], ["Identity document", "Attached to this email; not stored in the booking database"],
  ];
  const extension = document.type === "image/png" ? "png" : "jpg";
  const originalName = document.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const filename = originalName || `aadhaar-${bookingId}.${extension}`;
  return send({
    reply_to: booking.email || undefined,
    subject: `Vayora request ${bookingId}: ${booking.pickup} to ${booking.destination}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h2>New Vayora booking request</h2><p>Review and approve this request in the admin panel. Contact: ${escapeHtml(businessPhone)}</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:9px;border-bottom:1px solid #ddd;font-weight:bold">${escapeHtml(label)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin-top:22px;color:#555">Retention reminder: delete this email and its identity attachment within seven days after this booking is completed, cancelled or rejected.</p></div>`,
    attachments: [{ filename, content: fileToBase64(new Uint8Array(await document.arrayBuffer())) }],
  });
}

export async function sendDeletionReminder(details: { bookingId: string; status: string; deleteAfter: string; route?: string }) {
  const dueDate = new Date(details.deleteAfter).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return send({
    subject: `Action required: delete Aadhaar email for ${details.bookingId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2>Identity email deletion reminder</h2><p>Booking <strong>${escapeHtml(details.bookingId)}</strong>${details.route ? ` (${escapeHtml(details.route)})` : ""} is now <strong>${escapeHtml(details.status)}</strong>.</p><p>Delete the original booking email and its Aadhaar/identity attachment from the Vayora admin mailbox by <strong>${escapeHtml(dueDate)}</strong>.</p><p>The booking database record is also scheduled for deletion after that date.</p></div>`,
  });
}

export async function sendTestEmail() {
  const configuration = getEmailConfiguration();
  return send({
    subject: "Vayora email configuration test",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Vayora email is working</h2><p>This test confirms that Cloudflare can send booking notifications through Resend.</p><p><strong>Recipient:</strong> ${escapeHtml(configuration.notificationEmail)}</p></div>`,
  });
}
