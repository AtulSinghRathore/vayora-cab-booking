import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://vayora.anup-travels.workers.dev"),
  title: { default: "Vayora Cabs | Jamshedpur Outstation & Airport Taxi", template: "%s | Vayora Cabs" },
  description: "Book safe outstation and airport cabs from Jamshedpur to Ranchi, Kolkata and cities across India. Transparent fares, verified drivers and direct support.",
  keywords: ["cab booking Jamshedpur", "Jamshedpur outstation cab", "Jamshedpur to Ranchi taxi", "Jamshedpur to Kolkata cab", "Ranchi airport cab from Jamshedpur"],
  alternates: { canonical: "/" },
  openGraph: { title: "Vayora Cabs from Jamshedpur", description: "Safe outstation and airport journeys with clear fares and caring support.", type: "website", locale: "en_IN", url: "/" },
  robots: { index: true, follow: true },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": ["TaxiService", "LocalBusiness"], name: "Vayora Cabs",
          description: "Outstation and airport cab booking from Jamshedpur to destinations across India.",
          telephone: "+91-93045-91415", email: "natul0636@gmail.com", areaServed: ["Jamshedpur", "Jharkhand", "India"],
          address: { "@type": "PostalAddress", addressLocality: "Jamshedpur", addressRegion: "Jharkhand", addressCountry: "IN" },
          url: process.env.NEXT_PUBLIC_SITE_URL || "https://vayora.anup-travels.workers.dev",
        }) }} />
        {children}
      </body>
    </html>
  );
}
