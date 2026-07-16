import assert from "node:assert/strict";
import test from "node:test";

test("amendment and cancellation update D1 and email the admin once", async () => {
  const sentEmails = [];
  globalThis.fetch = async (_input, init) => {
    sentEmails.push(JSON.parse(String(init?.body || "{}")));
    return new Response(null, { status: 200 });
  };
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("booking-actions", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const booking = {
    id: "VAY-TEST-123", status: "approved", customer_name: "Test Customer", phone: "+919999999999",
    pickup: "Jamshedpur", destination: "Ranchi", travel_date: "2026-08-30", pickup_time: "08:00", fare_total: 2000,
  };
  const statements = [];
  const db = {
    prepare(query) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async run() { statements.push({ query, values: this.values }); return { success: true }; },
        async all() { return { results: [] }; },
        async first() {
          if (query.includes("SELECT * FROM bookings")) return { ...booking };
          if (query.includes("SELECT value FROM settings")) return null;
          return null;
        },
      };
    },
    async batch() { return []; },
  };
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: db,
    RESEND_API_KEY: "test-key",
    BOOKING_NOTIFICATION_EMAIL: "admin@example.com",
  };
  const context = { waitUntil() {}, passThroughOnException() {} };

  const amendmentResponse = await worker.fetch(new Request("http://localhost/api/bookings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: booking.id, phone: booking.phone, action: "amend", travelDate: "2026-09-02", pickupTime: "09:30", note: "Move pickup to the new date" }),
  }), env, context);
  assert.equal(amendmentResponse.status, 200);
  const amendment = await amendmentResponse.json();
  assert.equal(amendment.amendmentFee, 25);
  assert.equal(amendment.updatedFare, 2025);
  assert.match(sentEmails[0].subject, /Amendment VAY-TEST-123/);

  const cancellationResponse = await worker.fetch(new Request("http://localhost/api/bookings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: booking.id, phone: booking.phone, action: "cancel" }),
  }), env, context);
  assert.equal(cancellationResponse.status, 200);
  assert.match(sentEmails[1].subject, /Cancellation VAY-TEST-123/);
  assert.ok(statements.some(({ query }) => query.includes("status='amendment_requested'")));
  assert.ok(statements.some(({ query }) => query.includes("status='cancelled'")));
});
