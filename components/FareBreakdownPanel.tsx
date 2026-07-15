import type { FareBreakdown } from "../lib/fare-calculator";

type Props = {
  breakdown: FareBreakdown;
  vehicleName: string;
  destination: string;
  baseFareLabel?: string;
  bookingFeeLabel?: string;
  bookingFeeNote?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function FareBreakdownPanel({
  breakdown,
  vehicleName,
  destination,
  baseFareLabel = "Full-day cab charge",
  bookingFeeLabel = "Booking & support fee",
  bookingFeeNote,
}: Props) {
  const rows = [
    [baseFareLabel, breakdown.dayFare],
    [`Fuel & distance (${breakdown.billableDistanceKm} km × ${money(breakdown.perKmRate)})`, breakdown.distanceCharge],
    ["Driver allowance", breakdown.driverAllowance],
    ["Driver overnight stay", breakdown.driverStay],
    [bookingFeeLabel, breakdown.bookingFee],
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
      {bookingFeeNote && <p className="fee-explanation"><b>{bookingFeeLabel}:</b> {bookingFeeNote}</p>}
      <p className="estimate-note">Tolls, parking and permit/state-entry charges are not included. They are added later at actual cost against receipts.</p>
    </div>
  );
}
