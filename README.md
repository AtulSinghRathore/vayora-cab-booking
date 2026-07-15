# Vayora Cab Booking

Vayora is a responsive cab-booking website for trips starting in Jamshedpur and travelling across India.

## Features

- Searchable Indian city autocomplete with mouse and keyboard selection
- One-way and round-trip bookings
- Configurable full-day, per-kilometre, driver allowance, overnight stay, toll, booking and tax charges
- Transparent fare breakdown before booking
- Customer booking form that sends ride details to the business email
- Responsive desktop and mobile design

## Configure fares

All editable fare values are in [`public/config/fare.properties`](public/config/fare.properties).

```properties
base.dayFare=1300
booking.fee=99
vehicle.go.perKm=13
vehicle.plus.perKm=15
vehicle.xl.perKm=20
driver.dayAllowance=350
driver.overnightStay=800
distance.roadFactor=1.18
distance.minimumKm=20
toll.default=0
tax.percent=5
```

The calculation logic is isolated in `lib/fare-calculator.ts`. The UI never contains hard-coded fare amounts.

## Email notifications

Create a [Resend](https://resend.com) account, verify a sender domain, and configure these environment variables in Vercel:

```text
RESEND_API_KEY=your_api_key
BOOKING_FROM_EMAIL=Vayora Bookings <onboarding@resend.dev>
BOOKING_NOTIFICATION_EMAIL=monukr283@gmail.com
BOOKING_PHONE=+918092253270
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
