"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Brand from "../../components/Brand";

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

const defaultProperties = `booking.fee=99
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
airport.waiting.perHour=200`;

const terminalStatuses = new Set(["completed", "cancelled", "rejected"]);

export default function AdminPage() {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : sessionStorage.getItem("vayora-admin") || "");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState(defaultProperties);
  const [tab, setTab] = useState<"requests" | "calendar" | "fares">("requests");
  const [message, setMessage] = useState("");

  const signOut = useCallback(() => {
    sessionStorage.removeItem("vayora-admin");
    setToken("");
    setBookings([]);
  }, []);

  const load = useCallback(async (auth: string) => {
    const headers = { authorization: `Bearer ${auth}` };
    const [bookingsResponse, faresResponse] = await Promise.all([
      fetch("/api/admin/bookings", { headers }),
      fetch("/api/admin/fares", { headers }),
    ]);
    const bookingsResult = await bookingsResponse.json();
    const faresResult = await faresResponse.json();
    if (bookingsResponse.status === 401 || faresResponse.status === 401) {
      signOut();
      setMessage("Your admin session expired. Please sign in again.");
      return;
    }
    if (bookingsResponse.ok) setBookings(bookingsResult);
    else setMessage(bookingsResult.error || "Unable to load bookings.");
    if (faresResult.properties) setProperties(faresResult.properties);
  }, [signOut]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void load(token), 0);
    return () => window.clearTimeout(timer);
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
      return;
    }
    setMessage(result.reminderSent
      ? "Booking updated. An Aadhaar-email deletion reminder was sent to the admin mailbox."
      : "Booking updated.");
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
  }

  const calendar = useMemo(
    () => bookings.filter((booking) => booking.status === "approved").sort((first, second) => first.travel_date.localeCompare(second.travel_date)),
    [bookings],
  );

  if (!token) {
    return (
      <main className="portal-page">
        <section className="admin-login">
          <Brand />
          <p className="eyebrow">Private administration</p>
          <h1>Admin sign in</h1>
          <form className="lookup-card" onSubmit={login}>
            <label><span>Admin email</span><input name="email" type="email" defaultValue="natul0636@gmail.com" required /></label>
            <label><span>Password</span><input name="password" type="password" required /></label>
            <button className="primary-button">Sign in securely</button>
          </form>
          <p className="booking-status">{message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header"><Brand name="Vayora Admin" /><button onClick={signOut}>Sign out</button></header>
      <div className="admin-tabs">
        {(["requests", "calendar", "fares"] as const).map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
            {item[0].toUpperCase() + item.slice(1)}
            {item === "requests" && <span>{bookings.filter((booking) => booking.status === "pending").length}</span>}
          </button>
        ))}
      </div>
      <p className="booking-status admin-message">{message}</p>

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
        <section className="fare-editor">
          <div><p className="eyebrow">Live configuration</p><h2>Fare properties</h2><p>Edit every fare in one place. Saving creates a live database override; the property file remains the safe default.</p></div>
          <textarea value={properties} onChange={(event) => setProperties(event.target.value)} spellCheck={false} />
          <button className="primary-button" onClick={saveFares}>Save and publish fares</button>
        </section>
      )}
    </main>
  );
}
