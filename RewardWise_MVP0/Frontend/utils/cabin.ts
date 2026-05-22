export type Cabin = "economy" | "premium_economy" | "business" | "first";

export const CABIN_LABELS: Record<Cabin, string> = {
	economy: "Economy",
	premium_economy: "Premium Economy",
	business: "Business",
	first: "First",
};

export function cabinLabel(cabin?: string | null): string {
	if (!cabin) return "Economy";
	return CABIN_LABELS[cabin as Cabin] ?? cabin;
}
