import type { FareBreakdown } from "../lib/fare-calculator";

type Props = {
  breakdown: FareBreakdown;
  vehicleName: string;
  destination: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function FareBreakdownPanel({ breakdown, vehicleName, destination }: Props) {
  const rows = [
    ["Full-day cab charge", breakdown.dayFare],
    [`Fuel & distance (${breakdown.billableDistanceKm} km × ${money(breakdown.perKmRate)})`, breakdown.distanceCharge],
    ["Driver allowance", breakdown.driverAllowance],
    ["Driver overnight stay", breakdown.driverStay],
    ["Estimated tolls", breakdown.tollCharges],
    ["Booking fee", breakdown.bookingFee],
    [`GST (${breakdown.gstPercent}%)`, breakdown.tax],
  ] as const;

  return (
    <div className="breakdown-panel">
      <div className="breakdown-title">
        <div><p>Transparent fare estimate</p><h3>{vehicleName} to {destination}</h3></div>
        <strong>{money(breakdown.total)}</strong>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>
        ))}
      </dl>
      <p className="estimate-note">Final toll and parking charges are confirmed against actual receipts.</p>
    </div>
  );
}
