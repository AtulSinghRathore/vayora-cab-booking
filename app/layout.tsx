import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vayora-cab-booking.anup-travels.workers.dev";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#184f3a",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Vayora Cabs | Jamshedpur Outstation & Airport Taxi", template: "%s | Vayora Cabs" },
  description: "Book safe outstation and airport cabs from Jamshedpur to Ranchi, Kolkata and cities across India. Transparent fares, verified drivers and direct support.",
  keywords: ["cab booking Jamshedpur", "Jamshedpur outstation cab", "Jamshedpur to Ranchi taxi", "Jamshedpur to Kolkata cab", "Ranchi airport cab from Jamshedpur"],
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "Vayora Cabs from Jamshedpur",
    description: "Safe outstation and airport journeys with clear fares and caring support.",
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "Vayora Cabs",
    images: [{
      url: "/vayora-social-preview.png",
      width: 1200,
      height: 630,
      alt: "Vayora outstation and airport cab booking from Jamshedpur",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vayora Cabs from Jamshedpur",
    description: "Safe outstation and airport journeys with clear fares and caring support.",
    images: ["/vayora-social-preview.png"],
  },
  robots: { index: true, follow: true },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/vayora-icon.svg?v=3" type="image/svg+xml" />
        <link rel="shortcut icon" href="/vayora-icon.svg?v=3" />
        <link rel="apple-touch-icon" href="/vayora-icon.svg?v=3" />
        <link rel="manifest" href="/site.webmanifest?v=3" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": ["TaxiService", "LocalBusiness"], name: "Vayora Cabs",
          description: "Outstation and airport cab booking from Jamshedpur to destinations across India.",
          telephone: ["+91-80922-53270", "+91-90068-48822"], email: "anupkr9265@gmail.com", areaServed: ["Jamshedpur", "Jharkhand", "India"],
          address: { "@type": "PostalAddress", addressLocality: "Jamshedpur", addressRegion: "Jharkhand", addressCountry: "IN" },
          url: siteUrl,
        }) }} />
        {children}
      </body>
    </html>
  );
}
