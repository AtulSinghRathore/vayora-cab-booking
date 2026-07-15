import { NextRequest, NextResponse } from "next/server";
import { searchFallbackCities } from "../../../lib/indian-cities";

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state_district?: string;
    state?: string;
  };
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json([]);

  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("countrycodes", "in");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "10");
  endpoint.searchParams.set("featuretype", "city");

  try {
    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "VayoraCabBooking/1.0 (monukr283@gmail.com)",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok) return NextResponse.json(searchFallbackCities(query));

    const places = (await response.json()) as NominatimResult[];
    const unique = new Map<string, ReturnType<typeof normalizePlace>>();
    for (const place of places) {
      const normalized = normalizePlace(place);
      if (normalized.city) unique.set(`${normalized.city}-${normalized.state}`, normalized);
    }
    const onlineResults = Array.from(unique.values()).slice(0, 8);
    return NextResponse.json(onlineResults.length ? onlineResults : searchFallbackCities(query));
  } catch {
    return NextResponse.json(searchFallbackCities(query));
  }
}

function normalizePlace(place: NominatimResult) {
  const address = place.address || {};
  const city = address.city || address.town || address.village || address.municipality || address.state_district || "";
  return {
    id: String(place.place_id),
    city,
    state: address.state || "",
    displayName: place.display_name,
    lat: Number(place.lat),
    lon: Number(place.lon),
  };
}
