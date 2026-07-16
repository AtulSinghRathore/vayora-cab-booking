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
};

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

export default function AdminPage() {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("vayora-admin") || "");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState(defaultProperties);
  const [tab, setTab] = useState<"requests" | "calendar" | "fares" | "system">("requests");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<StatusTone>("info");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [testingEmail, setTestingEmail] = useState(false);

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
        {(["requests", "calendar", "fares", "system"] as const).map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
            {item[0].toUpperCase() + item.slice(1)}
            {item === "requests" && <span>{bookings.filter((booking) => ["pending", "amendment_requested"].includes(booking.status)).length}</span>}
          </button>
        ))}
      </div>
      <StatusMessage className="admin-message" tone={messageTone}>{message}</StatusMessage>

      {tab === "requests" && (
        <section className="admin-grid">
          {bookings.map((booking) => (
            <form className="admin-booking-card" key={booking.id} onSubmit={(event) => { event.preventDefault(); void updateBooking(booking.id, event.currentTarget); }}>
              <div className="record-heading">
                <div><p>{booking.id}</p><h3>{booking.pickup} → {booking.destination}</h3></div>
                <span className={`status-pill status-${booking.status}`}>{booking.status.replaceAll("_", " ")}</span>
              </div>
              <p>{booking.customer_name} · {booking.phone} · {booking.travel_date} {booking.pickup_time}</p>
              <p>{booking.vehicle} · ₹{Number(booking.fare_total).toLocaleString("en-IN")}</p>
              <a className="whatsapp-link" href={`https://wa.me/${booking.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Message customer on WhatsApp ↗</a>
              <p className={`retention-reminder ${terminalStatuses.has(booking.status) ? "due" : "active"}`}>
                {terminalStatuses.has(booking.status)
                  ? `Delete the original Aadhaar email by ${booking.delete_after ? new Date(booking.delete_after).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "seven days after this decision"}.`
                  : "The Aadhaar email remains available while this booking is active."}
              </p>
              <div className="admin-fields">
                <label><span>Status</span><select name="status" defaultValue={booking.status}><option value="pending">pending</option><option value="approved">approved</option><option value="amendment_requested">amendment requested</option><option value="rejected">rejected</option><option value="cancelled">cancelled</option><option value="completed">completed</option></select></label>
                <label><span>Driver name</span><input name="driverName" defaultValue={booking.driver_name || ""} /></label>
                <label><span>Driver phone</span><input name="driverPhone" defaultValue={booking.driver_phone || ""} /></label>
                <label className="full-field"><span>Admin note</span><textarea name="adminNote" defaultValue={booking.admin_note || ""} /></label>
              </div>
              <button className="primary-button">Save decision</button>
            </form>
          ))}
        </section>
      )}

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
