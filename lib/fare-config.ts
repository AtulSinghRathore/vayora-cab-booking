export type VehicleKey = "go" | "plus" | "xl";

export type FareConfig = {
  currency: string;
  baseDayFare: Record<VehicleKey, number>;
  bookingFee: number;
  perKm: Record<VehicleKey, number>;
  driverDayAllowance: number;
  driverOvernightStay: number;
  roadFactor: number;
  minimumDistanceKm: number;
  defaultToll: number;
  taxPercent: number;
};

export const defaultFareConfig: FareConfig = {
  currency: "INR",
  baseDayFare: { go: 1300, plus: 1600, xl: 2200 },
  bookingFee: 99,
  perKm: { go: 13, plus: 15, xl: 20 },
  driverDayAllowance: 350,
  driverOvernightStay: 800,
  roadFactor: 1.18,
  minimumDistanceKm: 20,
  defaultToll: 0,
  taxPercent: 5,
};

function toNumber(properties: Record<string, string>, key: string, fallback: number) {
  const value = Number(properties[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function parseFareProperties(source: string): FareConfig {
  const properties = source.split(/\r?\n/).reduce<Record<string, string>>((result, line) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith("#")) return result;
    const separator = cleanLine.indexOf("=");
    if (separator === -1) return result;
    result[cleanLine.slice(0, separator).trim()] = cleanLine.slice(separator + 1).trim();
    return result;
  }, {});

  return {
    currency: properties.currency || defaultFareConfig.currency,
    baseDayFare: {
      go: toNumber(properties, "vehicle.go.baseDayFare", toNumber(properties, "base.dayFare", defaultFareConfig.baseDayFare.go)),
      plus: toNumber(properties, "vehicle.plus.baseDayFare", toNumber(properties, "base.dayFare", defaultFareConfig.baseDayFare.plus)),
      xl: toNumber(properties, "vehicle.xl.baseDayFare", toNumber(properties, "base.dayFare", defaultFareConfig.baseDayFare.xl)),
    },
    bookingFee: toNumber(properties, "booking.fee", defaultFareConfig.bookingFee),
    perKm: {
      go: toNumber(properties, "vehicle.go.perKm", defaultFareConfig.perKm.go),
      plus: toNumber(properties, "vehicle.plus.perKm", defaultFareConfig.perKm.plus),
      xl: toNumber(properties, "vehicle.xl.perKm", defaultFareConfig.perKm.xl),
    },
    driverDayAllowance: toNumber(properties, "driver.dayAllowance", defaultFareConfig.driverDayAllowance),
    driverOvernightStay: toNumber(properties, "driver.overnightStay", defaultFareConfig.driverOvernightStay),
    roadFactor: toNumber(properties, "distance.roadFactor", defaultFareConfig.roadFactor),
    minimumDistanceKm: toNumber(properties, "distance.minimumKm", defaultFareConfig.minimumDistanceKm),
    defaultToll: toNumber(properties, "toll.default", defaultFareConfig.defaultToll),
    taxPercent: toNumber(properties, "gst.percent", toNumber(properties, "tax.percent", defaultFareConfig.taxPercent)),
  };
}
