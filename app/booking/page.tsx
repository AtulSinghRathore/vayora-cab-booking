"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Brand from "../../components/Brand";
import StatusMessage, { type StatusTone } from "../../components/StatusMessage";

type Booking = Record<string, string | number | null>;

export default function FindBookingPage() {
  const [id, setId] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<StatusTone>("info");
  const [amending, setAmending] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function find(event: FormEvent) {
    event.preventDefault(); setMessage(""); setBooking(null);
    const response = await fetch(`/api/bookings?id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phone)}`);
    const result = await response.json();
    if (response.ok) { setBooking(result); setMessageTone("success"); setMessage("Booking found."); }
    else { setMessageTone("error"); setMessage(result.error || "Booking not found."); }
  }
  async function update(action: "cancel" | "amend", form?: HTMLFormElement) {
    if (action === "cancel" && !confirm("Cancel this booking request?")) return;
    setUpdating(true);
    const data = form ? new FormData(form) : null;
    try {
      const response = await fetch("/api/bookings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, phone, action, travelDate: data?.get("travelDate"), pickupTime: data?.get("pickupTime"), note: data?.get("note") }) });
      const result = await response.json();
      setMessage(result.message || result.error); setMessageTone(response.ok ? "success" : "error");
      if (response.ok) {
        setAmending(false);
        setBooking((current) => current ? { ...current, status: action === "cancel" ? "cancelled" : "amendment_requested", travel_date: data?.get("travelDate") || current.travel_date, pickup_time: data?.get("pickupTime") || current.pickup_time, fare_total: result.updatedFare || current.fare_total } : current);
      }
    } finally { setUpdating(false); }
  }

  return <main className="portal-page">
    <header className="site-header"><Brand /><nav className="desktop-nav"><Link href="/#book">Outstation</Link><Link href="/airport">Airport</Link><Link className="active" href="/booking">Find booking</Link></nav><div className="header-actions"><a className="phone-link" href="tel:+919304591415"><span>●</span> +91 93045 91415</a><Link className="login-link" href="/admin">Admin</Link></div></header>
    <section className="portal-shell">
      <p className="eyebrow">Your journey</p><h1>Find your booking.</h1><p className="portal-lead">Enter the request ID from your confirmation and the mobile number used while booking.</p>
      <form className="lookup-card" onSubmit={find}><label><span>Booking / request ID</span><input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="VAY-260716-ABC123" required /></label><label><span>Mobile number</span><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required /></label><button className="primary-button">Find booking →</button></form>
      <StatusMessage tone={messageTone}>{message}</StatusMessage>
      {booking && <article className="booking-record"><div className="record-heading"><div><p>{String(booking.id)}</p><h2>{String(booking.pickup)} → {String(booking.destination)}</h2></div><span className={`status-pill status-${booking.status}`}>{String(booking.status).replaceAll("_", " ")}</span></div><dl>{[["Travel date",booking.travel_date],["Pickup time",booking.pickup_time],["Vehicle",booking.vehicle],["Estimated fare",`₹${Number(booking.fare_total).toLocaleString("en-IN")}`],["Driver",booking.driver_name || "Assigned after approval"],["Driver phone",booking.driver_phone || "Shared after assignment"]].map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{!["cancelled","rejected","completed"].includes(String(booking.status)) && <div className="record-actions"><button type="button" disabled={updating} onClick={() => setAmending(!amending)}>Amend booking</button><button className="danger-button" type="button" disabled={updating} onClick={() => update("cancel")}>{updating ? "Updating…" : "Cancel booking"}</button></div>}{amending && <form className="amend-form" onSubmit={(e) => { e.preventDefault(); update("amend", e.currentTarget); }}><label><span>New travel date</span><input name="travelDate" type="date" defaultValue={String(booking.travel_date)} required /></label><label><span>New pickup time</span><input name="pickupTime" type="time" defaultValue={String(booking.pickup_time || "08:00")} required /></label><label className="full-field"><span>What should be changed?</span><textarea name="note" rows={3} required /></label><p>Every amendment adds ₹25 to the fare. Vayora reviews the request and shares payment instructions on WhatsApp.</p><button className="primary-button" disabled={updating}>{updating ? "Sending amendment…" : "Submit amendment · ₹25"}</button></form>}</article>}
    </section>
  </main>;
}
