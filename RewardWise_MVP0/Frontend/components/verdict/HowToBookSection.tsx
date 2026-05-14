/** @format */
"use client";

type Recommendation = "use_points" | "pay_cash" | "wait";

type Props = {
  recommendation: Recommendation;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string | null;
  travelers: number;
  cabin?: string;
  programName: string | null;
  operatingAirline: string | null;
  points: number | null;
  taxes: number | null;
  seatsRemaining?: number | null;
  cashPrice: number | null;
};

function fmtShortDate(d: string) {
  const [year, month, day] = d.split("-").map(Number);
  if (!year || !month || !day) return d;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function cabinLabel(cabin?: string) {
  return (cabin || "economy").replace(/_/g, " ");
}

function travelerLabel(n: number) {
  return `${n} traveler${n !== 1 ? "s" : ""}`;
}

export default function HowToBookSection({
  recommendation,
  origin,
  destination,
  date,
  returnDate,
  travelers,
  cabin,
  programName,
  operatingAirline,
  points,
  taxes,
  seatsRemaining,
  cashPrice,
}: Props) {
  if (recommendation === "wait") return null;

  const dateStr = fmtShortDate(date);
  const returnStr = returnDate ? fmtShortDate(returnDate) : null;
  const routeStr = `${origin} to ${destination}`;
  const tripDates = returnStr ? `${dateStr} returning ${returnStr}` : dateStr;

  if (recommendation === "use_points") {
    if (!programName) return null;
    const pointsStr = points != null ? `${points.toLocaleString()} points` : "the required points";
    const taxesStr = taxes != null && taxes > 0 ? ` plus about $${Number(taxes).toFixed(0)} in taxes and fees` : "";
    const seatsStr = seatsRemaining != null && seatsRemaining > 0
      ? `Only ${seatsRemaining} seat${seatsRemaining !== 1 ? "s" : ""} reported at this level, so do not wait long.`
      : "Award availability can change quickly, so book once you have confirmed the price.";
    const operatingStr = operatingAirline && operatingAirline.toLowerCase() !== programName.toLowerCase()
      ? `The flight is operated by ${operatingAirline}, but you book through ${programName}.`
      : null;

    return (
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          How to book
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-200 marker:font-bold marker:text-emerald-300">
          <li>
            Sign in to your <span className="font-semibold text-white">{programName}</span> account.
            {operatingStr ? <span className="text-slate-400"> {operatingStr}</span> : null}
          </li>
          <li>
            Search award flights for <span className="font-semibold text-white">{routeStr}</span> on{" "}
            <span className="font-semibold text-white">{tripDates}</span>, {travelerLabel(travelers)},{" "}
            <span className="capitalize">{cabinLabel(cabin)}</span> class.
          </li>
          <li>
            Confirm the price shows around <span className="font-semibold text-white">{pointsStr}</span>
            {taxesStr}. If it is materially higher, the seat may have already moved.
          </li>
          <li>{seatsStr}</li>
          <li>
            Complete the booking and save the confirmation. Verify the award on{" "}
            <span className="font-semibold text-white">{programName}</span>&apos;s site before transferring
            any points.
          </li>
        </ol>
      </section>
    );
  }

  const priceStr = cashPrice != null
    ? `around $${cashPrice % 1 === 0 ? cashPrice.toFixed(0) : cashPrice.toFixed(2)}`
    : "the displayed price";
  const airlineForBooking = operatingAirline || "the operating airline";

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        How to book
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-200 marker:font-bold marker:text-emerald-300">
        <li>
          Go to <span className="font-semibold text-white">{airlineForBooking}</span>&apos;s site (booking
          direct usually means smoother changes and refunds).
        </li>
        <li>
          Search <span className="font-semibold text-white">{routeStr}</span> on{" "}
          <span className="font-semibold text-white">{tripDates}</span>, {travelerLabel(travelers)},{" "}
          <span className="capitalize">{cabinLabel(cabin)}</span> class.
        </li>
        <li>
          Confirm the fare is <span className="font-semibold text-white">{priceStr}</span> and complete the
          booking. If the price has moved materially, re-check before committing.
        </li>
      </ol>
    </section>
  );
}
