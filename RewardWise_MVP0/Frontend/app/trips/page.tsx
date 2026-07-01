/** @format */

import { permanentRedirect } from "next/navigation";

/**
 * Legacy /trips route. Booked trips were folded into History › "What you booked"
 * in 8b, so this permanently redirects (308) to that tab — preserving any inbound
 * links instead of 404-ing.
 */
export default function TripsPage() {
	permanentRedirect("/history?tab=booked");
}
