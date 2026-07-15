# Vayora Cab Booking

Vayora is a responsive cab-booking website for trips starting in Jamshedpur and travelling across India.

## Features

- Searchable Indian city autocomplete with mouse and keyboard selection
- One-way and round-trip bookings
- Configurable full-day, per-kilometre, driver allowance, overnight stay, booking and GST charges
- Transparent fare breakdown before booking
- Customer booking form that sends ride details to the business email
- Responsive desktop and mobile design

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
```

The calculation logic is isolated in `lib/fare-calculator.ts`. The UI never contains hard-coded fare amounts.

## Email notifications

Create a [Resend](https://resend.com) account, verify a sender domain, and configure these environment variables in Vercel:

```text
RESEND_API_KEY=your_api_key
BOOKING_FROM_EMAIL=Vayora Bookings <onboarding@resend.dev>
BOOKING_NOTIFICATION_EMAIL=natul0636@gmail.com
BOOKING_PHONE=+919304591415
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
