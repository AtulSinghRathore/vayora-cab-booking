"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CityAutocomplete, { type CitySuggestion } from "../../components/CityAutocomplete";
import FareBreakdownPanel from "../../components/FareBreakdownPanel";
import Brand from "../../components/Brand";
import StatusMessage, { type StatusTone } from "../../components/StatusMessage";
import { calculateFare, estimateRoadDistanceKm } from "../../lib/fare-calculator";
import { defaultFareConfig, parseFareProperties, type FareConfig, type VehicleKey } from "../../lib/fare-config";

type Direction = "to-airport" | "from-airport";
type AirportKey = "ranchi" | "kolkata";

const jamshedpur = { lat: 22.8046, lon: 86.2029 };
const airports: Record<AirportKey, { city: string; state: string; code: string; name: string; lat: number; lon: number }> = {
  ranchi: { city: "Ranchi", state: "Jharkhand", code: "IXR", name: "Birsa Munda Airport", lat: 23.3143, lon: 85.3217 },
  kolkata: { city: "Kolkata", state: "West Bengal", code: "CCU", name: "Netaji Subhas Chandra Bose International Airport", lat: 22.6547, lon: 88.4467 },
};
const vehicles: Array<{ key: VehicleKey; name: string; type: string; seats: string }> = [
  { key: "go", name: "Vayora Go", type: "Hatchback", seats: "4 seats" },
  { key: "plus", name: "Vayora Plus", type: "Sedan", seats: "4 seats" },
  { key: "xl", name: "Vayora XL", type: "SUV", seats: "6 seats" },
];
const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export default function AirportPage() {
  const [direction, setDirection] = useState<Direction>("to-airport");
  const [airportKey, setAirportKey] = useState<AirportKey>("ranchi");
  const [cityText, setCityText] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [travelDate, setTravelDate] = useState(tomorrow);
  const [pickupTime, setPickupTime] = useState("08:00");
  const [flightNumber, setFlightNumber] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(1);
  const [fareConfig, setFareConfig] = useState<FareConfig>(defaultFareConfig);
  const [selectedCab, setSelectedCab] = useState<VehicleKey | "">("");
  const [showFares, setShowFares] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [bookingTone, setBookingTone] = useState<StatusTone>("info");
  const [submitting, setSubmitting] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const bookingRequestToken = useRef(crypto.randomUUID());

  useEffect(() => {
    fetch("/api/fares")
      .then((response) => response.ok ? response.text() : fetch("/config/fare.properties").then((fallback) => fallback.text()))
      .then((source) => setFareConfig(parseFareProperties(source)))
      .catch(() => setFareConfig(defaultFareConfig));
  }, []);

  const airport = airports[airportKey];
  const routeCity = direction === "to-airport"
    ? { lat: airport.lat, lon: airport.lon }
    : selectedCity ? { lat: selectedCity.lat, lon: selectedCity.lon } : null;
  const routeStart = direction === "to-airport" ? jamshedpur : { lat: airport.lat, lon: airport.lon };
  const estimatedDistance = routeCity
    ? estimateRoadDistanceKm(routeStart, routeCity, fareConfig.roadFactor)
    : 0;
  const airportPricing = useMemo(() => ({
    ...fareConfig,
    bookingFee: fareConfig.airport.bookingFee,
    baseDayFare: fareConfig.airport.baseFare,
    perKm: fareConfig.airport.perKm,
  }), [fareConfig]);
  const fareBreakdown = useMemo(() => {
    if (!selectedCab || !estimatedDistance) return null;
    return calculateFare({
      vehicle: selectedCab,
      oneWayDistanceKm: estimatedDistance,
      tripType: "one-way",
      days: 1,
      overnightStays: 0,
    }, airportPricing);
  }, [selectedCab, estimatedDistance, airportPricing]);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === selectedCab);
  const pickupLabel = direction === "to-airport" ? "Jamshedpur" : `${airport.name}, ${airport.city}`;
  const destinationLabel = direction === "to-airport" ? `${airport.name}, ${airport.city}` : selectedCity?.displayName || cityText;

  function changeDirection(next: Direction) {
    setDirection(next);
    setShowFares(false);
    setSelectedCab("");
    setNotice("");
  }

  async function checkAirportFares(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setNotice("");
    if (direction === "from-airport" && !selectedCity) {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(cityText.trim())}`);
        const matches = response.ok ? ((await response.json()) as CitySuggestion[]) : [];
        if (!matches.length) throw new Error("No city");
        setSelectedCity(matches[0]);
        setCityText(matches[0].city);
      } catch {
        setNotice("Choose a destination city from the suggestions.");
        setChecking(false);
        return;
      }
    }
    setShowFares(true);
    setSelectedCab("");
    setBookingStatus("");
    setBookingSubmitted(false);
    bookingRequestToken.current = crypto.randomUUID();
    setChecking(false);
    window.setTimeout(() => document.getElementById("airport-fares")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fareBreakdown || !selectedVehicle) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setBookingStatus("");
    try {
      const booking = {
          name: form.get("name"), phone: form.get("phone"), email: form.get("email"),
          pickup: pickupLabel, destination: destinationLabel, travelDate, pickupTime,
          tripType: direction === "to-airport" ? "To airport" : "From airport",
          vehicle: selectedVehicle.name, days: 1, overnightStays: 0,
          distanceKm: fareBreakdown.billableDistanceKm, fareTotal: fareBreakdown.total,
          airport: `${airport.name} (${airport.code})`, flightNumber: flightNumber || "Not provided",
          passengers, luggage, pickupAddress: form.get("pickupAddress"), note: form.get("note"),
          requestToken: bookingRequestToken.current,
        };
      const payload = new FormData(); payload.set("booking", JSON.stringify(booking)); payload.set("identityDocument", form.get("identityDocument") as File);
      const response = await fetch("/api/bookings", { method: "POST", body: payload });
      const result = await response.json();
      setBookingStatus(result.message || result.error || "Unable to send the airport booking request.");
      setBookingTone(response.ok ? "success" : "error");
      if (response.ok) setBookingSubmitted(true);
    } catch {
      setBookingStatus("Unable to send the request. Please call +91 93045 91415.");
      setBookingTone("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="airport-page">
      <header className="site-header">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation"><Link href="/#book">Outstation</Link><Link className="active" href="/airport">Airport</Link><Link href="/booking">Find booking</Link></nav>
        <div className="header-actions"><a className="phone-link" href="tel:+919304591415"><span>●</span> +91 93045 91415</a><Link className="login-link" href="/admin">Admin</Link></div>
      </header>

      <section className="airport-hero">
        <div className="airport-shell">
          <div className="airport-intro">
            <p className="eyebrow">Dedicated airport transfers</p>
            <h1>Flights feel easier when the road is sorted.</h1>
            <p>Book reliable transfers to or from Ranchi and Kolkata airports with flight-aware pickup details and transparent pricing.</p>
            <div className="airport-badges"><span>IXR · Ranchi</span><span>CCU · Kolkata</span><span>30 min free waiting</span></div>
          </div>

          <form className="booking-card airport-card" onSubmit={checkAirportFares}>
            <div className="trip-toggle airport-toggle" role="group" aria-label="Airport trip direction">
              <button type="button" className={direction === "to-airport" ? "selected" : ""} onClick={() => changeDirection("to-airport")}>To airport</button>
              <button type="button" className={direction === "from-airport" ? "selected" : ""} onClick={() => changeDirection("from-airport")}>From airport</button>
            </div>

            <div className="airport-choice" role="group" aria-label="Choose airport">
              {(Object.keys(airports) as AirportKey[]).map((key) => {
                const item = airports[key];
                return <button type="button" key={key} className={airportKey === key ? "selected" : ""} onClick={() => { setAirportKey(key); setShowFares(false); }}><b>{item.code}</b><span>{item.city}</span><small>{item.name}</small></button>;
              })}
            </div>

            <div className="airport-route-grid">
              <label className="field"><span>Pickup</span><input value={pickupLabel} readOnly /></label>
              <label className="field destination-field"><span>Destination</span>
                {direction === "to-airport" ? <input value={destinationLabel} readOnly /> : <CityAutocomplete value={cityText} onChange={(value) => { setCityText(value); setSelectedCity(null); }} onSelect={(city) => { setCityText(city.city); setSelectedCity(city); setNotice(""); }} />}
              </label>
              {direction === "from-airport" && <label className="field"><span>State</span><input value={selectedCity?.state || ""} placeholder="Auto-filled" readOnly /></label>}
            </div>

            <div className="airport-details-grid">
              <label><span>{direction === "to-airport" ? "Travel date" : "Arrival date"}</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={travelDate} onChange={(event) => setTravelDate(event.target.value)} required /></label>
              <label><span>{direction === "to-airport" ? "Pickup time" : "Flight arrival time"}</span><input type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} required /></label>
              <label><span>Flight number</span><input value={flightNumber} onChange={(event) => setFlightNumber(event.target.value.toUpperCase())} placeholder="Optional" /></label>
              <label><span>Passengers</span><input type="number" min="1" max="6" value={passengers} onChange={(event) => setPassengers(Math.max(1, Number(event.target.value)))} /></label>
              <label><span>Luggage</span><input type="number" min="0" max="10" value={luggage} onChange={(event) => setLuggage(Math.max(0, Number(event.target.value)))} /></label>
            </div>
            <p className="extras-notice">Tolls, airport parking, permits and state-entry charges are added later at actual cost against receipts.</p>
            <button className="primary-button airport-submit" type="submit" disabled={checking}>{checking ? "Finding airport fares…" : "Check airport fares →"}</button>
            <StatusMessage tone="warning">{notice}</StatusMessage>
          </form>
        </div>
      </section>

      {showFares && (
        <section className="fare-results" id="airport-fares">
          <div className="section-shell">
            <div className="fare-heading-row"><div><p className="section-kicker">Airport ride options</p><h2>{direction === "to-airport" ? "Jamshedpur" : airport.city} → {direction === "to-airport" ? `${airport.city} Airport` : cityText}</h2><p>{estimatedDistance} km estimated road distance.</p></div></div>
            <div className="fare-grid">
              {vehicles.map((cab) => <article className={`fare-card ${selectedCab === cab.key ? "chosen" : ""}`} key={cab.key}>
                <div className="car-silhouette"><span /></div><div><p className="cab-type">{cab.type} · {cab.seats}</p><h3>{cab.name}</h3><p>Airport transfer</p></div>
                <div className="fare-price"><strong>₹{fareConfig.airport.baseFare[cab.key].toLocaleString("en-IN")} base</strong><span>airport cab charge</span><strong>₹{fareConfig.airport.perKm[cab.key]}/km</strong><span>fuel & running</span></div>
                <button type="button" onClick={() => setSelectedCab(cab.key)}>{selectedCab === cab.key ? "Selected ✓" : "Select cab"}</button>
              </article>)}
            </div>
            {selectedVehicle && fareBreakdown && <div className="booking-completion">
              <FareBreakdownPanel
                breakdown={fareBreakdown}
                vehicleName={selectedVehicle.name}
                destination={destinationLabel}
                baseFareLabel="Airport cab charge"
                bookingFeeLabel="Airport coordination fee"
                bookingFeeNote="Covers flight-detail handling, pickup scheduling and airport transfer coordination. It is shown separately and included in the displayed total."
              />
              <form className="customer-form" onSubmit={submitBooking}>
                <div className="customer-form-heading"><p>Request airport transfer</p><h3>Passenger and pickup details</h3></div>
                <div className="customer-fields">
                  <label><span>Full name *</span><input name="name" required /></label><label><span>Mobile number *</span><input name="phone" type="tel" required placeholder="+91" /></label>
                  <label><span>Email</span><input name="email" type="email" /></label><label><span>Exact pickup/drop address *</span><input name="pickupAddress" required /></label>
                  <label className="full-field"><span>Instructions</span><textarea name="note" rows={3} placeholder="Terminal, luggage, stops or accessibility needs" /></label>
                  <label className="full-field identity-upload"><span>Identity document (Aadhaar or government ID) *</span><input name="identityDocument" type="file" accept="image/jpeg,image/png" required /><small>Normal or masked Aadhaar accepted. JPG or PNG, maximum 5 MB. No third-party validation.</small></label>
                </div>
                <label className="consent-row"><input type="checkbox" required /><span>I consent to this identity document being emailed privately to Vayora for booking verification. It is not stored in the website database. Vayora will delete the admin-mailbox copy within seven days after the booking is completed, cancelled or rejected.</span></label>
                <p className="waiting-note">From-airport rides include {fareConfig.airport.freeWaitingMinutes} minutes free waiting. Additional waiting: ₹{fareConfig.airport.waitingPerHour}/hour.</p>
                <button className={`primary-button booking-submit ${submitting ? "is-sending" : ""} ${bookingSubmitted ? "is-sent" : ""}`} type="submit" disabled={submitting || bookingSubmitted}>{bookingSubmitted ? "Request sent ✓" : submitting ? "Sending request…" : `Request booking for ₹${Math.round(fareBreakdown.total).toLocaleString("en-IN")}`}</button>
                <StatusMessage tone={bookingTone}>{bookingStatus}</StatusMessage>
              </form>
            </div>}
          </div>
        </section>
      )}

      <footer className="airport-footer"><div className="footer-brand"><Brand className="footer-logo" /><p>Airport transfers for Ranchi and Kolkata.</p></div><div><p className="footer-title">Contact</p><a href="tel:+919304591415">+91 93045 91415</a><a href="mailto:natul0636@gmail.com">natul0636@gmail.com</a></div></footer>
    </main>
  );
}
