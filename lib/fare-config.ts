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
  taxPercent: number;
  cancellation: {
    freeBeforeDays: number;
    withinWeekPercent: number;
    within48HoursPercent: number;
    maximumWithinWeek: number;
    maximumWithin48Hours: number;
    dateChangeFee: number;
  };
  airport: {
    bookingFee: number;
    baseFare: Record<VehicleKey, number>;
    perKm: Record<VehicleKey, number>;
    freeWaitingMinutes: number;
    waitingPerHour: number;
  };
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
  taxPercent: 5,
  cancellation: { freeBeforeDays: 7, withinWeekPercent: 10, within48HoursPercent: 20, maximumWithinWeek: 500, maximumWithin48Hours: 1000, dateChangeFee: 250 },
  airport: {
    bookingFee: 149,
    baseFare: { go: 1300, plus: 1600, xl: 2200 },
    perKm: { go: 13, plus: 15, xl: 20 },
    freeWaitingMinutes: 30,
    waitingPerHour: 200,
  },
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
    taxPercent: toNumber(properties, "gst.percent", toNumber(properties, "tax.percent", defaultFareConfig.taxPercent)),
    cancellation: {
      freeBeforeDays: toNumber(properties, "cancellation.freeBeforeDays", defaultFareConfig.cancellation.freeBeforeDays),
      withinWeekPercent: toNumber(properties, "cancellation.withinWeek.percent", defaultFareConfig.cancellation.withinWeekPercent),
      within48HoursPercent: toNumber(properties, "cancellation.within48Hours.percent", defaultFareConfig.cancellation.within48HoursPercent),
      maximumWithinWeek: toNumber(properties, "cancellation.withinWeek.maximum", defaultFareConfig.cancellation.maximumWithinWeek),
      maximumWithin48Hours: toNumber(properties, "cancellation.within48Hours.maximum", defaultFareConfig.cancellation.maximumWithin48Hours),
      dateChangeFee: toNumber(properties, "amendment.dateChangeFee", defaultFareConfig.cancellation.dateChangeFee),
    },
    airport: {
      bookingFee: toNumber(properties, "airport.bookingFee", defaultFareConfig.airport.bookingFee),
      baseFare: {
        go: toNumber(properties, "airport.go.baseFare", defaultFareConfig.airport.baseFare.go),
        plus: toNumber(properties, "airport.plus.baseFare", defaultFareConfig.airport.baseFare.plus),
        xl: toNumber(properties, "airport.xl.baseFare", defaultFareConfig.airport.baseFare.xl),
      },
      perKm: {
        go: toNumber(properties, "airport.go.perKm", defaultFareConfig.airport.perKm.go),
        plus: toNumber(properties, "airport.plus.perKm", defaultFareConfig.airport.perKm.plus),
        xl: toNumber(properties, "airport.xl.perKm", defaultFareConfig.airport.perKm.xl),
      },
      freeWaitingMinutes: toNumber(properties, "airport.waiting.freeMinutes", defaultFareConfig.airport.freeWaitingMinutes),
      waitingPerHour: toNumber(properties, "airport.waiting.perHour", defaultFareConfig.airport.waitingPerHour),
    },
  };
}
