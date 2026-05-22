export function shiftIsoDate(iso: string, days: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	if (!y || !m || !d) return iso;
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() + days);
	return dt.toISOString().slice(0, 10);
}

export function clampToToday(iso: string): string {
	const today = new Date().toISOString().slice(0, 10);
	return iso < today ? today : iso;
}

export interface SearchQueryInputs {
	origin: string;
	destination: string;
	departDate: string;
	dateMode: "exact" | "flexible";
	returnDate: string;
	tripType: string;
	cabin: string;
	travelers: number;
}

export function buildSearchQueryParams(input: SearchQueryInputs): URLSearchParams {
	const {
		origin,
		destination,
		departDate,
		dateMode,
		returnDate,
		tripType,
		cabin,
		travelers,
	} = input;
	const isFlexible = dateMode === "flexible" && Boolean(departDate);
	const flexibleStart = isFlexible
		? clampToToday(shiftIsoDate(departDate, -7))
		: departDate;
	const flexibleEnd = isFlexible ? shiftIsoDate(departDate, 7) : null;

	const params = new URLSearchParams({
		origin,
		destination,
		date: flexibleStart,
		cabin,
		travelers: travelers.toString(),
	});
	if (flexibleEnd) {
		params.append("date_end", flexibleEnd);
	}
	if (tripType === "roundtrip" && returnDate) {
		params.append("return_date", returnDate);
		if (isFlexible) {
			params.append("return_date_end", shiftIsoDate(returnDate, 7));
		}
	}
	return params;
}
