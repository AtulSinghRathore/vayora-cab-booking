"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Brand from "../../components/Brand";
import StatusMessage, { type StatusTone } from "../../components/StatusMessage";

type Booking = {
  id: string;
  pickup: string;
  destination: string;
  customer_name: string;
  phone: string;
  travel_date: string;
  pickup_time: string | null;
  vehicle: string;
  fare_total: number;
  status: string;
  driver_name: string | null;
  driver_phone: string | null;
  admin_note: string | null;
  delete_after: string | null;
  minimum_booking_amount: number;
  details_json?: string;
};

type BillLine = { label: string; amount: number };
type BillExtra = { date: string; type: string; location: string; amount: number; note: string };
type BillBooking = Booking & { email?: string; details?: Record<string, unknown> };

const defaultProperties = `currency=INR
booking.fee=99
vehicle.go.baseDayFare=1300
vehicle.plus.baseDayFare=1600
vehicle.xl.baseDayFare=2200
vehicle.go.perKm=13
vehicle.plus.perKm=15
vehicle.xl.perKm=20
driver.dayAllowance=350
driver.overnightStay=800
distance.roadFactor=1.18
distance.minimumKm=20
gst.percent=5
airport.bookingFee=149
airport.go.baseFare=1300
airport.plus.baseFare=1600
airport.xl.baseFare=2200
airport.go.perKm=13
airport.plus.perKm=15
airport.xl.perKm=20
airport.waiting.freeMinutes=30
airport.waiting.perHour=200
amendment.fee=25
cancellation.freeBeforeDays=7
cancellation.withinWeek.percent=10
cancellation.withinWeek.maximum=500
cancellation.within48Hours.percent=20
cancellation.within48Hours.maximum=1000`;

type FareField = { key: string; label: string; help: string; prefix?: string; suffix?: string; step?: string; fallback: string };
const fareSections: Array<{ title: string; description: string; fields: FareField[] }> = [
  { title: "General charges", description: "Charges applied to every standard outstation estimate.", fields: [
    { key: "booking.fee", label: "Booking and support fee", help: "Fixed coordination charge added once per booking.", prefix: "₹", fallback: "99" },
    { key: "gst.percent", label: "GST rate", help: "Tax percentage applied to the taxable fare.", suffix: "%", fallback: "5" },
  ] },
  { title: "Vayora Go", description: "Standard sedan pricing for outstation trips.", fields: [
    { key: "vehicle.go.baseDayFare", label: "Full-day cab charge", help: "Fixed charge for each booked day.", prefix: "₹", suffix: "/day", fallback: "1300" },
    { key: "vehicle.go.perKm", label: "Running charge", help: "Fuel and distance rate for every billable kilometre.", prefix: "₹", suffix: "/km", fallback: "13" },
  ] },
  { title: "Vayora Plus", description: "Premium sedan pricing for outstation trips.", fields: [
    { key: "vehicle.plus.baseDayFare", label: "Full-day cab charge", help: "Fixed charge for each booked day.", prefix: "₹", suffix: "/day", fallback: "1600" },
    { key: "vehicle.plus.perKm", label: "Running charge", help: "Fuel and distance rate for every billable kilometre.", prefix: "₹", suffix: "/km", fallback: "15" },
  ] },
  { title: "Vayora XL", description: "Large vehicle pricing for outstation trips.", fields: [
    { key: "vehicle.xl.baseDayFare", label: "Full-day cab charge", help: "Fixed charge for each booked day.", prefix: "₹", suffix: "/day", fallback: "2200" },
    { key: "vehicle.xl.perKm", label: "Running charge", help: "Fuel and distance rate for every billable kilometre.", prefix: "₹", suffix: "/km", fallback: "20" },
  ] },
  { title: "Driver charges", description: "Daily and overnight support paid for the driver.", fields: [
    { key: "driver.dayAllowance", label: "Driver daily allowance", help: "Added for each travel day.", prefix: "₹", suffix: "/day", fallback: "350" },
    { key: "driver.overnightStay", label: "Driver overnight stay", help: "Added for every overnight stay entered by the customer.", prefix: "₹", suffix: "/night", fallback: "800" },
  ] },
  { title: "Airport transfers", description: "Independent pricing for Ranchi and Kolkata airport bookings.", fields: [
    { key: "airport.bookingFee", label: "Airport coordination fee", help: "Flight-detail handling, scheduling and pickup coordination.", prefix: "₹", fallback: "149" },
    { key: "airport.go.baseFare", label: "Go base fare", help: "Fixed airport-trip charge for Vayora Go.", prefix: "₹", fallback: "1300" },
    { key: "airport.go.perKm", label: "Go running charge", help: "Per-kilometre airport rate for Vayora Go.", prefix: "₹", suffix: "/km", fallback: "13" },
    { key: "airport.plus.baseFare", label: "Plus base fare", help: "Fixed airport-trip charge for Vayora Plus.", prefix: "₹", fallback: "1600" },
    { key: "airport.plus.perKm", label: "Plus running charge", help: "Per-kilometre airport rate for Vayora Plus.", prefix: "₹", suffix: "/km", fallback: "15" },
    { key: "airport.xl.baseFare", label: "XL base fare", help: "Fixed airport-trip charge for Vayora XL.", prefix: "₹", fallback: "2200" },
    { key: "airport.xl.perKm", label: "XL running charge", help: "Per-kilometre airport rate for Vayora XL.", prefix: "₹", suffix: "/km", fallback: "20" },
    { key: "airport.waiting.freeMinutes", label: "Free airport waiting", help: "Waiting time included before hourly charges start.", suffix: "minutes", fallback: "30" },
    { key: "airport.waiting.perHour", label: "Extra waiting charge", help: "Charged after the free waiting period.", prefix: "₹", suffix: "/hour", fallback: "200" },
  ] },
  { title: "Amendments and cancellations", description: "Customer change fee and cancellation rules used automatically.", fields: [
    { key: "amendment.fee", label: "Amendment fee", help: "Added each time a customer submits a booking change.", prefix: "₹", fallback: "25" },
    { key: "cancellation.freeBeforeDays", label: "Free cancellation period", help: "No cancellation fee when this many or more days remain.", suffix: "days", fallback: "7" },
    { key: "cancellation.withinWeek.percent", label: "Cancellation rate within one week", help: "Percentage charged after the free period and before the final 48 hours.", suffix: "%", fallback: "10" },
    { key: "cancellation.withinWeek.maximum", label: "Maximum fee within one week", help: "The cancellation charge cannot exceed this amount.", prefix: "₹", fallback: "500" },
    { key: "cancellation.within48Hours.percent", label: "Cancellation rate within 48 hours", help: "Percentage charged for last-minute cancellations.", suffix: "%", fallback: "20" },
    { key: "cancellation.within48Hours.maximum", label: "Maximum fee within 48 hours", help: "The last-minute cancellation charge cannot exceed this amount.", prefix: "₹", fallback: "1000" },
  ] },
  { title: "Distance estimation", description: "Advanced values used to estimate road distance from map coordinates.", fields: [
    { key: "distance.roadFactor", label: "Road-distance multiplier", help: "Converts straight-line distance into an estimated road distance.", step: "0.01", suffix: "×", fallback: "1.18" },
    { key: "distance.minimumKm", label: "Minimum billable distance", help: "Lowest distance used in a fare estimate.", suffix: "km", fallback: "20" },
  ] },
];

function readProperty(source: string, field: FareField) {
  const values = source.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.trim().startsWith("#")) result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    return result;
  }, {});
  return values[field.key] ?? field.fallback;
}

function writeProperty(source: string, key: string, value: string) {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  return lines.join("\n").trim();
}

const terminalStatuses = new Set(["completed", "cancelled", "rejected"]);
type Diagnostics = { email: { apiKeyConfigured: boolean; fromEmail: string; notificationEmail: string }; databaseConfigured: boolean };

function whatsappUrl(booking: Booking) {
  let phone = booking.phone.replace(/\D/g, "");
  if (phone.length === 10) phone = `91${phone}`;
  const message = [
    `Hello ${booking.customer_name},`, "", "Your Vayora booking details:",
    `Booking ID: ${booking.id}`, `Route: ${booking.pickup} to ${booking.destination}`,
    `Travel: ${booking.travel_date}${booking.pickup_time ? ` at ${booking.pickup_time}` : ""}`,
    `Vehicle: ${booking.vehicle}`, `Estimated fare: ₹${Number(booking.fare_total).toLocaleString("en-IN")}`,
    `Minimum booking amount: ₹${Number(booking.minimum_booking_amount || 0).toLocaleString("en-IN")}`,
    "Payment link: [paste payment link here]", "", "Thank you for choosing Vayora — every journey, cared for like family.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function AdminPage() {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("vayora-admin") || "");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState(defaultProperties);
  const [tab, setTab] = useState<"requests" | "calendar" | "bills" | "fares" | "system">("requests");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<StatusTone>("info");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [requestFilter, setRequestFilter] = useState("action");
  const [billSearch, setBillSearch] = useState("");
  const [billBooking, setBillBooking] = useState<BillBooking | null>(null);
  const [billLines, setBillLines] = useState<BillLine[]>([]);
  const [billExtras, setBillExtras] = useState<BillExtra[]>([]);
  const [billBusy, setBillBusy] = useState(false);

  const signOut = useCallback(() => {
    sessionStorage.removeItem("vayora-admin");
    setToken("");
    setBookings([]);
    setDiagnostics(null);
  }, []);

  const load = useCallback(async (auth: string) => {
    const headers = { authorization: `Bearer ${auth}` };
    const [bookingsResponse, faresResponse, diagnosticsResponse] = await Promise.all([
      fetch("/api/admin/bookings", { headers }),
      fetch("/api/admin/fares", { headers }),
      fetch("/api/admin/diagnostics", { headers }),
    ]);
    const bookingsResult = await bookingsResponse.json();
    const faresResult = await faresResponse.json();
    const diagnosticsResult = await diagnosticsResponse.json();
    if (bookingsResponse.status === 401 || faresResponse.status === 401 || diagnosticsResponse.status === 401) {
      signOut();
      setMessage("Your admin session expired. Please sign in again.");
      setMessageTone("warning");
      return;
    }
    if (bookingsResponse.ok) setBookings(bookingsResult);
    else { setMessage(bookingsResult.error || "Unable to load bookings."); setMessageTone("error"); }
    if (faresResult.properties) setProperties(faresResult.properties);
    if (diagnosticsResponse.ok) setDiagnostics(diagnosticsResult);
  }, [signOut]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void load(token), 0);
    const refresh = window.setInterval(() => void load(token), 30000);
    return () => { window.clearTimeout(timer); window.clearInterval(refresh); };
  }, [load, token]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Unable to sign in.");
      setMessageTone("error");
      return;
    }
    sessionStorage.setItem("vayora-admin", result.token);
    setToken(result.token);
    setMessage("");
  }

  async function updateBooking(id: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const response = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        id,
        status: data.get("status"),
        driverName: data.get("driverName"),
        driverPhone: data.get("driverPhone"),
        adminNote: data.get("adminNote"),
        minimumBookingAmount: data.get("minimumBookingAmount"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Unable to update booking.");
      setMessageTone("error");
      return;
    }
    setMessage(result.reminderSent
      ? "Booking updated. An Aadhaar-email deletion reminder was sent to the admin mailbox."
      : "Booking updated.");
    setMessageTone("success");
    await load(token);
    setSelectedBooking(null);
  }

  async function findBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBillBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/bills?bookingId=${encodeURIComponent(billSearch)}`, { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to find that booking.");
      const booking = result.booking as BillBooking;
      const breakdown = (booking.details?.fareBreakdown || {}) as Record<string, number>;
      const defaults: BillLine[] = breakdown.total ? [
        { label: "Full-day cab charge", amount: Number(breakdown.dayFare || 0) },
        { label: "Fuel and distance charge", amount: Number(breakdown.distanceCharge || 0) },
        { label: "Driver allowance", amount: Number(breakdown.driverAllowance || 0) },
        { label: "Driver overnight stay", amount: Number(breakdown.driverStay || 0) },
        { label: "Booking and support fee", amount: Number(breakdown.bookingFee || 0) },
        { label: `GST (${Number(breakdown.gstPercent || 5)}%)`, amount: Number(breakdown.tax || 0) },
      ] : [{ label: "Estimated trip fare", amount: Number(booking.fare_total || 0) }];
      setBillBooking(booking);
      setBillLines(result.draft ? JSON.parse(result.draft.summary_json) : defaults);
      setBillExtras(result.draft ? JSON.parse(result.draft.items_json) : []);
      setMessage(result.draft?.delete_after ? `Draft scheduled for deletion on ${new Date(result.draft.delete_after).toLocaleString("en-IN")}. Editing it will restart retention.` : "Booking loaded. Review every charge before downloading.");
      setMessageTone("info");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load bill."); setMessageTone("error"); }
    finally { setBillBusy(false); }
  }

  async function saveBillDraft(showMessage = true) {
    if (!billBooking) return false;
    const response = await fetch("/api/admin/bills", { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ bookingId: billBooking.id, summary: billLines, items: billExtras }) });
    const result = await response.json();
    if (showMessage) { setMessage(result.message || result.error); setMessageTone(response.ok ? "success" : "error"); }
    return response.ok;
  }

  async function downloadBill() {
    if (!billBooking) return; setBillBusy(true);
    try {
      if (!await saveBillDraft(false)) throw new Error("The draft could not be saved.");
      const [{ jsPDF }, tableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF();
      doc.setFillColor(24, 79, 58); doc.roundedRect(14, 12, 18, 18, 3, 3, "F");
      doc.setFillColor(249, 115, 22); doc.rect(27, 12, 5, 18, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text("V", 20, 24);
      doc.setTextColor(9, 34, 53); doc.setFontSize(22); doc.text("Vayora", 38, 22);
      doc.setFontSize(10); doc.setTextColor(70, 85, 78); doc.text("Every journey, cared for like family.", 38, 28);
      doc.setFontSize(16); doc.setTextColor(9, 34, 53); doc.text("Trip Fare Statement", 14, 43);
      const details = [
        ["Booking ID", billBooking.id], ["Customer", billBooking.customer_name],
        ["Route", `${billBooking.pickup} to ${billBooking.destination}`],
        ["Travel", `${billBooking.travel_date} ${billBooking.pickup_time || ""}`], ["Vehicle", billBooking.vehicle],
      ];
      tableModule.default(doc, { startY: 48, body: details, theme: "plain", styles: { fontSize: 9 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } } });
      const summaryTotal = billLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      const extraTotal = billExtras.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      const grandTotal = summaryTotal + extraTotal;
      const balance = grandTotal - Number(billBooking.minimum_booking_amount || 0);
      tableModule.default(doc, { startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4, head: [["Fare summary", "Amount"]], body: [...billLines.map((line) => [line.label, `₹${Number(line.amount || 0).toLocaleString("en-IN")}`]), ["Additional actual charges", `₹${extraTotal.toLocaleString("en-IN")}`], ["Grand total", `₹${grandTotal.toLocaleString("en-IN")}`], ["Booking amount received", `₹${Number(billBooking.minimum_booking_amount || 0).toLocaleString("en-IN")}`], ["Balance due", `₹${balance.toLocaleString("en-IN")}`]], theme: "grid", headStyles: { fillColor: [24, 79, 58] } });
      if (billExtras.length) tableModule.default(doc, { startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8, head: [["Date", "Type / place", "Note", "Amount"]], body: billExtras.map((line) => [line.date, `${line.type}${line.location ? ` — ${line.location}` : ""}`, line.note, `₹${Number(line.amount || 0).toLocaleString("en-IN")}`]), theme: "striped", headStyles: { fillColor: [9, 34, 53] } });
      const y = Math.min(282, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14);
      doc.setFontSize(10); doc.setTextColor(24, 79, 58); doc.text("Thank you for travelling with Vayora. Your safety and comfort travel with us.", 14, y);
      doc.save(`Vayora-${billBooking.id}-Trip-Fare-Statement.pdf`);
      const response = await fetch("/api/admin/bills", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ bookingId: billBooking.id }) });
      const result = await response.json(); setMessage(result.message || "PDF downloaded."); setMessageTone(response.ok ? "success" : "error");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to download the PDF."); setMessageTone("error"); }
    finally { setBillBusy(false); }
  }

  async function saveFares() {
    const response = await fetch("/api/admin/fares", {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ properties }),
    });
    const result = await response.json();
    setMessage(result.message || result.error || "Unable to save fares.");
    setMessageTone(response.ok ? "success" : "error");
  }

  async function testEmail() {
    setTestingEmail(true);
    try {
      const response = await fetch("/api/admin/diagnostics", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      setMessage(result.message || result.error || "Unable to send the test email.");
      setMessageTone(response.ok ? "success" : "error");
      await load(token);
    } catch {
      setMessage("Unable to reach the email test. Please try again.");
      setMessageTone("error");
    } finally {
      setTestingEmail(false);
    }
  }

  const calendar = useMemo(
    () => bookings.filter((booking) => booking.status === "approved").sort((first, second) => first.travel_date.localeCompare(second.travel_date)),
    [bookings],
  );
  const visibleBookings = useMemo(() => bookings.filter((booking) => requestFilter === "all" || (requestFilter === "action" ? ["pending", "amendment_requested"].includes(booking.status) : booking.status === requestFilter)), [bookings, requestFilter]);

  if (!token) {
    return (
      <main className="portal-page">
        <section className="admin-login">
          <Brand href="/" />
          <p className="eyebrow">Private administration</p>
          <h1>Admin sign in</h1>
          <form className="lookup-card" onSubmit={login}>
            <label><span>Admin email</span><input name="email" type="email" defaultValue="natul0636@gmail.com" required /></label>
            <label><span>Password</span><input name="password" type="password" required /></label>
            <button className="primary-button">Sign in securely</button>
          </form>
          <StatusMessage tone={messageTone}>{message}</StatusMessage>
          <div className="admin-credential-note"><strong>Where is the password stored?</strong>Your password is an encrypted Cloudflare secret named ADMIN_PASSWORD. It is never saved in this website or GitHub.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><Brand href="/" name="Vayora Admin" /><div className="admin-header-actions"><Link href="/">Back to website</Link><button onClick={signOut}>Sign out</button></div></header>
      <div className="admin-tabs">
        {(["requests", "calendar", "bills", "fares", "system"] as const).map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
            {item[0].toUpperCase() + item.slice(1)}
            {item === "requests" && <span>{bookings.filter((booking) => ["pending", "amendment_requested"].includes(booking.status)).length}</span>}
          </button>
        ))}
      </div>
      <StatusMessage className="admin-message" tone={messageTone}>{message}</StatusMessage>

      {tab === "requests" && (
        <section className="request-workspace">
          <div className="request-toolbar"><div><p className="eyebrow">Booking operations</p><h2>Requests by travel date</h2></div><label><span>Show</span><select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}><option value="action">Needs action</option><option value="approved">Approved</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="all">All bookings</option></select></label></div>
          <div className="booking-table" role="table">
            <div className="booking-table-head" role="row"><span>Date</span><span>Route</span><span>Customer</span><span>Fare</span><span>Status</span></div>
            {visibleBookings.map((booking) => <button className="booking-row" key={booking.id} onClick={() => setSelectedBooking(booking)} role="row">
              <span><strong>{new Date(`${booking.travel_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</strong><small>{booking.pickup_time || "Time pending"}</small></span>
              <span><strong>{booking.pickup} → {booking.destination}</strong><small>{booking.id}</small></span>
              <span><strong>{booking.customer_name}</strong><small>{booking.phone}</small></span>
              <span>₹{Number(booking.fare_total).toLocaleString("en-IN")}</span>
              <span className={`status-pill status-${booking.status}`}>{booking.status.replaceAll("_", " ")}</span>
            </button>)}
            {!visibleBookings.length && <p className="empty-list">No bookings in this view.</p>}
          </div>
        </section>
      )}

      {selectedBooking && <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setSelectedBooking(null)}><section className="admin-modal" role="dialog" aria-modal="true" aria-label={`Manage ${selectedBooking.id}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelectedBooking(null)} aria-label="Close">×</button>
        <div className="record-heading"><div><p>{selectedBooking.id}</p><h2>{selectedBooking.pickup} → {selectedBooking.destination}</h2></div><span className={`status-pill status-${selectedBooking.status}`}>{selectedBooking.status.replaceAll("_", " ")}</span></div>
        <p>{selectedBooking.customer_name} · {selectedBooking.phone} · {selectedBooking.travel_date} {selectedBooking.pickup_time}</p>
        <p>{selectedBooking.vehicle} · Estimated ₹{Number(selectedBooking.fare_total).toLocaleString("en-IN")}</p>
        <a className="whatsapp-link" href={whatsappUrl(selectedBooking)} target="_blank" rel="noreferrer">Open pre-filled WhatsApp message ↗</a>
        <form onSubmit={(event) => { event.preventDefault(); void updateBooking(selectedBooking.id, event.currentTarget); }}>
          <div className="admin-fields">
            <label><span>Status</span><select name="status" defaultValue={selectedBooking.status}><option value="pending">Pending</option><option value="approved">Approved</option><option value="amendment_requested">Amendment requested</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></label>
            <label><span>Minimum booking amount</span><input name="minimumBookingAmount" type="number" min="0" defaultValue={selectedBooking.minimum_booking_amount || 0} /></label>
            <label><span>Driver name</span><input name="driverName" defaultValue={selectedBooking.driver_name || ""} /></label>
            <label><span>Driver phone</span><input name="driverPhone" defaultValue={selectedBooking.driver_phone || ""} /></label>
            <label className="full-field"><span>Admin note</span><textarea name="adminNote" defaultValue={selectedBooking.admin_note || ""} /></label>
          </div>
          <p className={`retention-reminder ${terminalStatuses.has(selectedBooking.status) ? "due" : "active"}`}>{terminalStatuses.has(selectedBooking.status) ? `Delete the original identity-document email by ${selectedBooking.delete_after ? new Date(selectedBooking.delete_after).toLocaleDateString("en-IN") : "seven days after this decision"}.` : "The identity-document email remains available while this booking is active."}</p>
          <button className="primary-button">Save booking</button>
        </form>
      </section></div>}

      {tab === "calendar" && (
        <section className="calendar-list">
          <h2>Approved journey calendar</h2>
          {calendar.length ? calendar.map((booking) => (
            <article key={booking.id}>
              <time>{new Date(`${booking.travel_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</time>
              <div><h3>{booking.pickup} → {booking.destination}</h3><p>{booking.pickup_time} · {booking.customer_name} · {booking.vehicle}</p></div>
            </article>
          )) : <p>No approved bookings yet.</p>}
        </section>
      )}

      {tab === "bills" && <section className="bill-workspace">
        <div className="fare-editor-intro"><p className="eyebrow">Trip Fare Statement</p><h2>Build a clear, shareable bill</h2><p>The PDF is generated only in your browser and is never stored. The editable draft is deleted two days after download.</p></div>
        <form className="bill-search" onSubmit={findBill}><label><span>Booking ID</span><input value={billSearch} onChange={(event) => setBillSearch(event.target.value.toUpperCase())} placeholder="VAY-260716-ABC123" required /></label><button className="primary-button" disabled={billBusy}>{billBusy ? "Searching…" : "Search booking"}</button></form>
        {billBooking && <div className="bill-editor">
          <div className="bill-booking-summary"><div><small>Customer</small><strong>{billBooking.customer_name}</strong></div><div><small>Route</small><strong>{billBooking.pickup} → {billBooking.destination}</strong></div><div><small>Travel</small><strong>{billBooking.travel_date}</strong></div><div><small>Vehicle</small><strong>{billBooking.vehicle}</strong></div></div>
          <section className="bill-card"><div className="bill-section-title"><div><h3>Original fare charges</h3><p>Everything is editable before download.</p></div><button type="button" onClick={() => setBillLines((lines) => [...lines, { label: "Other fare charge", amount: 0 }])}>+ Add charge</button></div>
            {billLines.map((line, index) => <div className="bill-line" key={`${line.label}-${index}`}><input aria-label="Charge name" value={line.label} onChange={(event) => setBillLines((lines) => lines.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><input aria-label="Charge amount" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setBillLines((lines) => lines.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) } : item))} /><button aria-label="Remove charge" onClick={() => setBillLines((lines) => lines.filter((_, i) => i !== index))}>×</button></div>)}
          </section>
          <section className="bill-card"><div className="bill-section-title"><div><h3>Actual tolls, parking and permits</h3><p>Add each transaction in the correct order. No extra GST is added to these actual amounts.</p></div><button type="button" onClick={() => setBillExtras((lines) => [...lines, { date: new Date().toISOString().slice(0, 10), type: "Toll", location: "", amount: 0, note: "" }])}>+ Add transaction</button></div>
            {billExtras.map((line, index) => <div className="bill-extra" key={index}><input aria-label="Date" type="date" value={line.date} onChange={(event) => setBillExtras((lines) => lines.map((item, i) => i === index ? { ...item, date: event.target.value } : item))} /><select aria-label="Type" value={line.type} onChange={(event) => setBillExtras((lines) => lines.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}><option>Toll</option><option>Parking</option><option>Permit</option><option>State entry</option><option>Other</option></select><input aria-label="Place" placeholder="Plaza or place" value={line.location} onChange={(event) => setBillExtras((lines) => lines.map((item, i) => i === index ? { ...item, location: event.target.value } : item))} /><input aria-label="Amount" type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setBillExtras((lines) => lines.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) } : item))} /><input aria-label="Note" placeholder="Reference or note" value={line.note} onChange={(event) => setBillExtras((lines) => lines.map((item, i) => i === index ? { ...item, note: event.target.value } : item))} /><button aria-label="Remove transaction" onClick={() => setBillExtras((lines) => lines.filter((_, i) => i !== index))}>×</button></div>)}
            {!billExtras.length && <p className="empty-list">No additional actual charges yet.</p>}
          </section>
          <div className="bill-total"><span>Fare charges <b>₹{billLines.reduce((sum, line) => sum + Number(line.amount || 0), 0).toLocaleString("en-IN")}</b></span><span>Actual additions <b>₹{billExtras.reduce((sum, line) => sum + Number(line.amount || 0), 0).toLocaleString("en-IN")}</b></span><strong>Grand total ₹{(billLines.reduce((sum, line) => sum + Number(line.amount || 0), 0) + billExtras.reduce((sum, line) => sum + Number(line.amount || 0), 0)).toLocaleString("en-IN")}</strong></div>
          <div className="bill-actions"><button onClick={() => void saveBillDraft()} disabled={billBusy}>Save draft</button><button className="primary-button" onClick={() => void downloadBill()} disabled={billBusy}>{billBusy ? "Preparing…" : "Download PDF"}</button></div>
        </div>}
      </section>}

      {tab === "fares" && (
        <section className="fare-editor-friendly">
          <div className="fare-editor-intro"><p className="eyebrow">Simple price controls</p><h2>Update fares without touching code</h2><p>Change only the amount you need. Each field explains where it appears in the customer estimate.</p></div>
          <div className="fare-section-list">
            {fareSections.map((section) => <section className="fare-section-card" key={section.title}>
              <div><h3>{section.title}</h3><p>{section.description}</p></div>
              <div className="fare-field-grid">{section.fields.map((field) => <label className="fare-field" key={field.key}>
                <span>{field.label}</span><small>{field.help}</small>
                <div className="fare-input-wrap">{field.prefix && <b>{field.prefix}</b>}<input type="number" min="0" step={field.step || "1"} value={readProperty(properties, field)} onChange={(event) => setProperties((current) => writeProperty(current, field.key, event.target.value))} />{field.suffix && <em>{field.suffix}</em>}</div>
              </label>)}</div>
            </section>)}
          </div>
          <details className="advanced-properties"><summary>Advanced: view the property file</summary><p>This is the same configuration in developer format. Use the simple fields above unless you know these property names.</p><textarea value={properties} onChange={(event) => setProperties(event.target.value)} spellCheck={false} /></details>
          <div className="fare-save-bar"><span>Changes become active immediately after saving.</span><button className="primary-button" onClick={saveFares}>Save and publish fares</button></div>
        </section>
      )}

      {tab === "system" && (
        <section className="system-panel">
          <p className="eyebrow">Connection check</p>
          <h2>Email and database</h2>
          <p>Use this page to diagnose booking-email delivery without creating a customer booking.</p>
          <div className="diagnostic-grid">
            <div className={`diagnostic-card ${diagnostics?.databaseConfigured ? "ok" : "problem"}`}><span>D1 booking database</span><strong>{diagnostics?.databaseConfigured ? "Connected" : "Not connected"}</strong></div>
            <div className={`diagnostic-card ${diagnostics?.email.apiKeyConfigured ? "ok" : "problem"}`}><span>Resend API key</span><strong>{diagnostics?.email.apiKeyConfigured ? "Configured" : "Missing"}</strong></div>
            <div className="diagnostic-card"><span>Notification recipient</span><strong>{diagnostics?.email.notificationEmail || "Loading…"}</strong></div>
            <div className="diagnostic-card"><span>Sender</span><strong>{diagnostics?.email.fromEmail || "Loading…"}</strong></div>
          </div>
          <button className="primary-button" onClick={testEmail} disabled={testingEmail}>{testingEmail ? "Sending test…" : "Send test email"}</button>
        </section>
      )}
    </main>
  );
}
