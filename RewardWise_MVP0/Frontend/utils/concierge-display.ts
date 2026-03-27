/** @format */

export type TravelRequestListFields = {
	id: string;
	tier: string;
	status: string;
	origin: string;
	destination: string;
	departure_date: string;
	quoted_price: number | null;
	currency: string | null;
	sla_hours: number | null;
	created_at: string;
};

export function orderDisplayId(row: Pick<TravelRequestListFields, "id" | "created_at">) {
	const y = new Date(row.created_at).getFullYear();
	const tail = row.id.replace(/-/g, "").slice(-5).toUpperCase();
	return `RW-${y}-${tail}`;
}

export function tierLabel(tier: string) {
	if (tier === "premium") return "Premium Concierge";
	return "Standard Concierge";
}

export function turnaroundLabel(sla: number | null, tier: string) {
	if (sla != null && sla > 0) {
		if (sla <= 24) return `${sla} hours`;
		return `${sla}–${sla + 24} hours`;
	}
	return tier === "premium" ? "10 hours (expedited)" : "48–72 hours";
}

export function statusUi(status: string) {
	if (status === "in_progress")
		return { text: "Working on your trip", cls: "text-sky-300" };
	if (status === "delivered") return { text: "Delivered", cls: "text-teal-300" };
	if (status === "paid")
		return { text: "Reviewing your best options", cls: "text-amber-300" };
	if (status === "payment_pending")
		return { text: "Payment pending", cls: "text-orange-300" };
	if (status === "cancelled") return { text: "Cancelled", cls: "text-red-400" };
	return { text: status.replace(/_/g, " "), cls: "text-gray-300" };
}
