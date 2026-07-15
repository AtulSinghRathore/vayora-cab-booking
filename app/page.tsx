"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import CityAutocomplete, { type CitySuggestion } from "../components/CityAutocomplete";
import FareBreakdownPanel from "../components/FareBreakdownPanel";
import { calculateFare, estimateRoadDistanceKm } from "../lib/fare-calculator";
import {
  defaultFareConfig,
  parseFareProperties,
  type FareConfig,
  type VehicleKey,
} from "../lib/fare-config";

type TripType = "one-way" | "round-trip";

const jamshedpurCoordinates = { lat: 22.8046, lon: 86.2029 };
const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};
const vehicles: Array<{ key: VehicleKey; name: string; type: string; seats: string; note: string }> = [
  { key: "go", name: "Vayora Go", type: "Hatchback", seats: "4 seats", note: "Easy on the pocket" },
  { key: "plus", name: "Vayora Plus", type: "Sedan", seats: "4 seats", note: "Extra boot space" },
  { key: "xl", name: "Vayora XL", type: "SUV", seats: "6 seats", note: "Room for everyone" },
];

export default function Home() {
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [destination, setDestination] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [notice, setNotice] = useState("");
  const [showFares, setShowFares] = useState(false);
  const [checkingFares, setCheckingFares] = useState(false);
  const [selectedCab, setSelectedCab] = useState<VehicleKey | "">("");
  const [fareConfig, setFareConfig] = useState<FareConfig>(defaultFareConfig);
  const [days, setDays] = useState(1);
  const [overnightStays, setOvernightStays] = useState(0);
  const [tollCharges, setTollCharges] = useState(0);
  const [travelDate, setTravelDate] = useState(getTomorrowDate);
  const [pickupTime, setPickupTime] = useState("08:00");
  const [bookingStatus, setBookingStatus] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  useEffect(() => {
    fetch("/config/fare.properties")
      .then((response) => response.text())
      .then((source) => setFareConfig(parseFareProperties(source)))
      .catch(() => setFareConfig(defaultFareConfig));
  }, []);

  const estimatedDistance = useMemo(() => {
    if (!selectedCity) return 0;
    return estimateRoadDistanceKm(
      jamshedpurCoordinates,
      { lat: selectedCity.lat, lon: selectedCity.lon },
      fareConfig.roadFactor,
    );
  }, [selectedCity, fareConfig.roadFactor]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.key === selectedCab);
  const fareBreakdown = useMemo(() => {
    if (!selectedCab || !estimatedDistance) return null;
    return calculateFare(
      {
        vehicle: selectedCab,
        oneWayDistanceKm: estimatedDistance,
        tripType,
        days,
        overnightStays,
        tollCharges,
      },
      fareConfig,
    );
  }, [selectedCab, estimatedDistance, tripType, days, overnightStays, tollCharges, fareConfig]);

  async function checkFares(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const place = destination.trim();
    if (!place) {
      setShowFares(false);
      setNotice("Tell us where you want to go to check available rides.");
      return;
    }

    setCheckingFares(true);
    setNotice("");
    let resolvedCity = selectedCity;
    if (!resolvedCity) {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(place)}`);
        const matches = response.ok ? ((await response.json()) as CitySuggestion[]) : [];
        resolvedCity = matches[0] || null;
      } catch {
        resolvedCity = null;
      }
    }

    if (!resolvedCity) {
      setShowFares(false);
      setNotice("We could not find that city. Please choose a destination from the suggestions.");
      setCheckingFares(false);
      return;
    }

    setSelectedCity(resolvedCity);
    setDestination(resolvedCity.city);
    setShowFares(true);
    setSelectedCab("");
    setBookingStatus("");
    setCheckingFares(false);
    window.setTimeout(() => {
      document.getElementById("fares")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fareBreakdown || !selectedVehicle || !selectedCity) return;
    const form = new FormData(event.currentTarget);
    setSubmittingBooking(true);
    setBookingStatus("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), phone: form.get("phone"), email: form.get("email"),
          pickup: form.get("pickup"), destination: selectedCity.displayName,
          travelDate, pickupTime, tripType, vehicle: selectedVehicle.name, days,
          overnightStays, distanceKm: fareBreakdown.billableDistanceKm,
          fareTotal: fareBreakdown.total, note: form.get("note"),
        }),
      });
      const result = await response.json();
      setBookingStatus(result.message || result.error || "Unable to send the booking request.");
    } catch {
      setBookingStatus("Unable to send the booking request. Please call +91 80922 53270.");
    } finally {
      setSubmittingBooking(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Vayora home">
          <span className="brand-mark" aria-hidden="true">
            V
          </span>
          <span>Vayora</span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="active" href="#book">
            Outstation
          </a>
          <a href="#fleet">Local</a>
          <a href="#fleet">Airport</a>
          <a href="#business">Corporate</a>
        </nav>

        <div className="header-actions">
          <a className="phone-link" href="tel:+918092253270">
            <span aria-hidden="true">●</span> +91 80922 53270
          </a>
          <a className="login-link" href="#account">
            Sign in
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="route-art" aria-hidden="true">
          <span className="route-dot route-dot-one" />
          <span className="route-dot route-dot-two" />
          <span className="route-dot route-dot-three" />
          <span className="route-line route-line-one" />
          <span className="route-line route-line-two" />
        </div>

        <div className="hero-content">
          <p className="eyebrow">Outstation cabs from Jamshedpur</p>
          <h1>
            Jamshedpur to <span>anywhere in India.</span>
          </h1>
          <p className="hero-copy">
            Comfortable cabs, verified drivers and clear pricing—wherever the
            road takes you.
          </p>

          <form className="booking-card" id="book" onSubmit={checkFares}>
            <div className="trip-toggle" role="group" aria-label="Trip type">
              <button
                className={tripType === "one-way" ? "selected" : ""}
                type="button"
                onClick={() => setTripType("one-way")}
                aria-pressed={tripType === "one-way"}
              >
                One-way
              </button>
              <button
                className={tripType === "round-trip" ? "selected" : ""}
                type="button"
                onClick={() => setTripType("round-trip")}
                aria-pressed={tripType === "round-trip"}
              >
                Round-trip
              </button>
            </div>

            <div className="location-row">
              <label className="field pickup-field">
                <span>Pickup</span>
                <input value="Jamshedpur" aria-label="Pickup city" readOnly />
              </label>
              <span className="field-arrow" aria-hidden="true">
                →
              </span>
              <label className="field destination-field">
                <span>Destination</span>
                <CityAutocomplete
                  value={destination}
                  onChange={(value) => {
                    setDestination(value);
                    setSelectedCity(null);
                  }}
                  onSelect={(city) => {
                    setDestination(city.city);
                    setSelectedCity(city);
                    setNotice("");
                  }}
                />
              </label>
              <label className="field state-field">
                <span>State</span>
                <input
                  value={selectedCity?.state || ""}
                  placeholder="Auto-filled"
                  aria-label="Destination state"
                  readOnly
                />
              </label>
            </div>

            <div className="schedule-row">
              <label className="field compact-field">
                <span>Travel date</span>
                <input
                  type="date"
                  value={travelDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setTravelDate(event.target.value)}
                  aria-label="Travel date"
                  required
                />
              </label>
              <label className="field compact-field">
                <span>Pickup time</span>
                <input
                  type="time"
                  value={pickupTime}
                  onChange={(event) => setPickupTime(event.target.value)}
                  aria-label="Pickup time"
                  required
                />
              </label>
              <button className="primary-button" type="submit" disabled={checkingFares}>
                {checkingFares ? "Finding fares…" : "Check fares"} <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="trip-details-row">
              <label>
                <span>Number of days</span>
                <input type="number" min="1" max="30" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value)))} />
              </label>
              <label>
                <span>Driver overnight stays</span>
                <input type="number" min="0" max="29" value={overnightStays} onChange={(event) => setOvernightStays(Math.max(0, Number(event.target.value)))} />
              </label>
              <label>
                <span>Estimated tolls (₹)</span>
                <input type="number" min="0" value={tollCharges} onChange={(event) => setTollCharges(Math.max(0, Number(event.target.value)))} />
              </label>
            </div>
            <p className="form-notice" role="status" aria-live="polite">
              {notice}
            </p>
          </form>

          <div className="trust-row" aria-label="Vayora benefits">
            <span><b>✓</b> Verified drivers</span>
            <span><b>₹</b> Transparent fares</span>
            <span><b>◔</b> 24×7 support</span>
          </div>
        </div>
      </section>

      {showFares && (
        <section className="fare-results" id="fares" aria-labelledby="fare-heading">
          <div className="section-shell">
            <div className="fare-heading-row">
              <div>
                <p className="section-kicker">Available ride types</p>
                <h2 id="fare-heading">Choose your ride to {destination.trim()}</h2>
                <p>{estimatedDistance} km estimated road distance. Every charge is shown before you book.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setShowFares(false)}>
                Close results
              </button>
            </div>

            <div className="fare-grid">
              {vehicles.map((cab) => (
                <article className={`fare-card ${selectedCab === cab.key ? "chosen" : ""}`} key={cab.key}>
                  <div className="car-silhouette" aria-hidden="true"><span /></div>
                  <div>
                    <p className="cab-type">{cab.type} · {cab.seats}</p>
                    <h3>{cab.name}</h3>
                    <p>{cab.note}</p>
                  </div>
                  <div className="fare-price">
                    <strong>₹{fareConfig.perKm[cab.key]}/km</strong>
                    <span>fuel & running</span>
                  </div>
                  <button type="button" onClick={() => setSelectedCab(cab.key)}>
                    {selectedCab === cab.key ? "Selected ✓" : "Select cab"}
                  </button>
                </article>
              ))}
            </div>

            {selectedVehicle && fareBreakdown && (
              <div className="booking-completion">
                <FareBreakdownPanel
                  breakdown={fareBreakdown}
                  vehicleName={selectedVehicle.name}
                  destination={destination.trim()}
                />
                <form className="customer-form" onSubmit={submitBooking}>
                  <div className="customer-form-heading">
                    <p>Request this ride</p>
                    <h3>Where should we contact you?</h3>
                  </div>
                  <div className="customer-fields">
                    <label><span>Full name *</span><input name="name" required placeholder="Your name" /></label>
                    <label><span>Mobile number *</span><input name="phone" type="tel" required placeholder="+91" /></label>
                    <label><span>Email</span><input name="email" type="email" placeholder="you@example.com" /></label>
                    <label><span>Pickup address *</span><input name="pickup" required placeholder="Area or full address in Jamshedpur" /></label>
                    <label className="full-field"><span>Anything we should know?</span><textarea name="note" rows={3} placeholder="Luggage, stops, accessibility needs…" /></label>
                  </div>
                  <button className="primary-button booking-submit" type="submit" disabled={submittingBooking}>
                    {submittingBooking ? "Sending request…" : `Request booking for ₹${Math.round(fareBreakdown.total).toLocaleString("en-IN")}`}
                  </button>
                  <p className="booking-status" role="status" aria-live="polite">{bookingStatus}</p>
                  <p className="privacy-note">Your details are sent only to Vayora booking support at monukr283@gmail.com.</p>
                </form>
                <div className="selection-bar" role="status" aria-live="polite">
                  <span><b>{selectedVehicle.name}</b> selected for Jamshedpur → {destination.trim()}</span>
                  <a href="tel:+918092253270">Call +91 80922 53270 →</a>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="services-section" id="fleet" aria-labelledby="services-heading">
        <div className="section-shell">
          <div className="section-intro split-intro">
            <div>
              <p className="section-kicker">One city. Every road.</p>
              <h2 id="services-heading">A cab for every kind of journey</h2>
            </div>
            <p>
              From a quick airport drop to a week-long family road trip, choose a
              ride that fits your plans—not the other way around.
            </p>
          </div>

          <div className="service-grid">
            <article className="service-card featured-service">
              <span className="service-number">01</span>
              <div>
                <p className="mini-label">Most booked</p>
                <h3>Outstation one-way</h3>
                <p>Pay for the distance you travel, with no return fare added.</p>
              </div>
              <a href="#book">Plan a one-way ride →</a>
            </article>
            <article className="service-card">
              <span className="service-number">02</span>
              <div>
                <p className="mini-label">Take your time</p>
                <h3>Round trips</h3>
                <p>Keep the same cab and driver with you throughout the journey.</p>
              </div>
              <a href="#book">Plan a round trip →</a>
            </article>
            <article className="service-card">
              <span className="service-number">03</span>
              <div>
                <p className="mini-label">Never miss a flight</p>
                <h3>Airport transfers</h3>
                <p>Reliable pickup for Ranchi and Kolkata airport connections.</p>
              </div>
              <a href="#book">Book an airport cab →</a>
            </article>
          </div>
        </div>
      </section>

      <section className="routes-section" aria-labelledby="routes-heading">
        <div className="section-shell">
          <div className="section-intro">
            <p className="section-kicker light-kicker">Popular from Jamshedpur</p>
            <h2 id="routes-heading">Start local. Go anywhere.</h2>
          </div>
          <div className="route-grid">
            {[
              ["Ranchi", "City & airport rides"],
              ["Kolkata", "Business & weekend trips"],
              ["Dhanbad", "Direct intercity rides"],
              ["Bhubaneswar", "Comfortable long journeys"],
              ["Patna", "Door-to-door travel"],
              ["Varanasi", "Family & pilgrimage trips"],
            ].map(([city, description]) => (
              <a className="route-card" href="#book" key={city}>
                <span className="route-pin" aria-hidden="true">●</span>
                <div>
                  <h3>Jamshedpur → {city}</h3>
                  <p>{description}</p>
                </div>
                <b aria-hidden="true">↗</b>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="promise-section" aria-labelledby="promise-heading">
        <div className="section-shell promise-grid">
          <div className="promise-copy">
            <p className="section-kicker">The Vayora promise</p>
            <h2 id="promise-heading">The road feels better when everything is clear.</h2>
            <p>
              We put safety, honest pricing and responsive support at the centre
              of every ride—before pickup, on the road and after drop-off.
            </p>
            <div className="promise-stats">
              <div><strong>24×7</strong><span>booking support</span></div>
              <div><strong>100%</strong><span>driver verification</span></div>
              <div><strong>Upfront</strong><span>fare details</span></div>
            </div>
          </div>
          <div className="steps-card">
            <p className="mini-label">Book in three simple steps</p>
            <ol>
              <li><span>1</span><div><b>Tell us your route</b><p>Choose your destination, date and pickup time.</p></div></li>
              <li><span>2</span><div><b>Pick the right cab</b><p>Compare cab sizes and transparent fare details.</p></div></li>
              <li><span>3</span><div><b>Meet your driver</b><p>Receive driver and vehicle details before pickup.</p></div></li>
            </ol>
            <a className="dark-button" href="#book">Book your journey →</a>
          </div>
        </div>
      </section>

      <section className="faq-section" aria-labelledby="faq-heading">
        <div className="section-shell faq-grid">
          <div>
            <p className="section-kicker">Good to know</p>
            <h2 id="faq-heading">Questions before you go?</h2>
            <p className="faq-lead">Clear answers make for calmer journeys.</p>
            <a className="support-link" href="tel:+918092253270">Talk to travel support →</a>
          </div>
          <div className="faq-list">
            <details open>
              <summary>Can I book a cab from Jamshedpur to any Indian city?</summary>
              <p>Yes. Enter your destination to request an outstation cab. For very long routes, our team confirms availability and the best travel plan.</p>
            </details>
            <details>
              <summary>What is included in the quoted fare?</summary>
              <p>Your quote shows the cab fare and applicable driver allowance. Tolls, state taxes and parking are displayed separately before confirmation.</p>
            </details>
            <details>
              <summary>Can I make stops during the trip?</summary>
              <p>Yes. Share planned stops while confirming the ride so the driver and fare can be arranged correctly.</p>
            </details>
            <details>
              <summary>How do you verify drivers?</summary>
              <p>Driver identity, licence and vehicle documents are checked before a driver can accept Vayora rides.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="final-cta" id="business">
        <div>
          <p className="section-kicker light-kicker">Your next road starts here</p>
          <h2>Where do you want to go?</h2>
        </div>
        <a href="#book">Check fares from Jamshedpur →</a>
      </section>

      <footer id="account">
        <div className="footer-brand">
          <a className="brand footer-logo" href="#top"><span className="brand-mark">V</span><span>Vayora</span></a>
          <p>Thoughtful road travel from Jamshedpur to anywhere in India.</p>
        </div>
        <div>
          <p className="footer-title">Services</p>
          <a href="#fleet">Outstation</a><a href="#fleet">Local</a><a href="#fleet">Airport</a><a href="#business">Corporate</a>
        </div>
        <div>
          <p className="footer-title">Contact</p>
          <a href="tel:+918092253270">+91 80922 53270</a>
          <a href="mailto:monukr283@gmail.com">monukr283@gmail.com</a>
          <span>Jamshedpur, Jharkhand</span>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Vayora. All rights reserved.</span>
          <span>Designed for safer, simpler road journeys.</span>
        </div>
      </footer>

      <a className="mobile-book" href="#book">Book a cab</a>
    </main>
  );
}
