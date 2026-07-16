# Vayora Cab Booking

Vayora is a responsive cab-booking website for trips starting in Jamshedpur and travelling across India.

## Features

- Searchable Indian city autocomplete with mouse and keyboard selection
- One-way and round-trip bookings
- Configurable full-day, per-kilometre, driver allowance, overnight stay, booking and GST charges
- Transparent fare breakdown before booking
- Customer booking form that sends ride details to the business email
- Responsive desktop and mobile design
- Dedicated Ranchi and Kolkata airport booking
- Identity-document upload delivered directly to the private admin email without database or object storage
- Booking ID lookup, amendments and configurable cancellation fees
- Password-protected admin approval, driver assignment, calendar and live fare editor

## Cloudflare production services

The complete workflow uses Cloudflare's free allowances. Create and bind:

- A **D1 database** with binding name `DB`

The application creates its tables on first use. Identity documents are attached directly to the private admin notification email and are never written to D1 or R2. Active bookings remain available without a deletion deadline. Completed, cancelled and rejected booking records are deleted after seven days by a daily Cloudflare cleanup job. When a booking becomes terminal, the admin receives a reminder to delete the original email and identity attachment by the same deadline.

## Configure fares

All editable fare values are in [`public/config/fare.properties`](public/config/fare.properties).

```properties
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

# Airport transfers
# Coordination fee is displayed separately to customers and can be set to 0.
airport.bookingFee=149
airport.go.baseFare=1300
airport.plus.baseFare=1600
airport.xl.baseFare=2200
airport.go.perKm=13
airport.plus.perKm=15
airport.xl.perKm=20
airport.waiting.freeMinutes=30
airport.waiting.perHour=200
```

The calculation logic is isolated in `lib/fare-calculator.ts`. The UI never contains hard-coded fare amounts.

## Email notifications

Create a [Resend](https://resend.com) account and configure these secrets and variables in the Cloudflare Worker. A verified sender domain is required before sending to arbitrary customer addresses; `onboarding@resend.dev` can be used for initial admin-only testing.

```text
RESEND_API_KEY=your_api_key
BOOKING_FROM_EMAIL=Vayora Bookings <onboarding@resend.dev>
BOOKING_NOTIFICATION_EMAIL=natul0636@gmail.com
BOOKING_PHONE=+919304591415
ADMIN_EMAIL=natul0636@gmail.com
ADMIN_PASSWORD=choose_a_strong_password
ADMIN_SESSION_SECRET=generate_a_long_random_secret
```

Never commit the real API key. `.env.example` contains only safe placeholders.

## Local development

```bash
npm ci
npm run dev
```

## Validation and deployment

```bash
npm run lint
npm run build:vercel
```

Vercel uses `vercel.json` and the `build:vercel` script. The existing `build` script remains available for the ChatGPT Sites deployment.
