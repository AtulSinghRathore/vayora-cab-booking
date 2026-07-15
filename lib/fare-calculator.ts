import type { FareConfig, VehicleKey } from "./fare-config";

export type FareInput = {
  vehicle: VehicleKey;
  oneWayDistanceKm: number;
  tripType: "one-way" | "round-trip";
  days: number;
  overnightStays: number;
  tollCharges: number;
};

export type FareBreakdown = {
  billableDistanceKm: number;
  dayFare: number;
  distanceCharge: number;
  driverAllowance: number;
  driverStay: number;
  tollCharges: number;
  bookingFee: number;
  tax: number;
  total: number;
  perKmRate: number;
  gstPercent: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateFare(input: FareInput, config: FareConfig): FareBreakdown {
  const days = Math.max(1, Math.floor(input.days || 1));
  const nights = Math.max(0, Math.floor(input.overnightStays || 0));
  const distanceMultiplier = input.tripType === "round-trip" ? 2 : 1;
  const measuredDistance = Math.max(0, input.oneWayDistanceKm) * distanceMultiplier;
  const billableDistanceKm = Math.max(config.minimumDistanceKm, Math.round(measuredDistance));
  const perKmRate = config.perKm[input.vehicle];

  const dayFare = config.baseDayFare[input.vehicle] * days;
  const distanceCharge = billableDistanceKm * perKmRate;
  const driverAllowance = config.driverDayAllowance * days;
  const driverStay = config.driverOvernightStay * nights;
  const tollCharges = Math.max(0, input.tollCharges || config.defaultToll);
  const bookingFee = config.bookingFee;
  const subtotal = dayFare + distanceCharge + driverAllowance + driverStay + tollCharges + bookingFee;
  const tax = subtotal * (config.taxPercent / 100);

  return {
    billableDistanceKm,
    dayFare: roundMoney(dayFare),
    distanceCharge: roundMoney(distanceCharge),
    driverAllowance: roundMoney(driverAllowance),
    driverStay: roundMoney(driverStay),
    tollCharges: roundMoney(tollCharges),
    bookingFee: roundMoney(bookingFee),
    tax: roundMoney(tax),
    total: roundMoney(subtotal + tax),
    perKmRate,
    gstPercent: config.taxPercent,
  };
}

export function estimateRoadDistanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  roadFactor: number,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const startLatitude = toRadians(from.lat);
  const endLatitude = toRadians(to.lat);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const straightLineDistance = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(straightLineDistance * Math.max(1, roadFactor)));
}
