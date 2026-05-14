/** @format */

export const DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS = 3 * 60 * 60 * 1000;

export function getDayPassMsLeft(
	expiresAt: string | number | Date | null | undefined,
	nowMs = Date.now(),
): number {
	if (!expiresAt) return 0;
	const expiryMs =
		typeof expiresAt === "number"
			? expiresAt
			: expiresAt instanceof Date
				? expiresAt.getTime()
				: new Date(expiresAt).getTime();

	if (!Number.isFinite(expiryMs)) return 0;
	return Math.max(0, expiryMs - nowMs);
}

export function formatDayPassTimeLeft(msLeft: number): string {
	if (msLeft <= 0) return "expired";

	const totalMinutes = Math.ceil(msLeft / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours <= 0) return `${minutes}m left`;
	if (minutes === 0) return `${hours}h left`;
	return `${hours}h ${minutes}m left`;
}

export function getNextDayPassUpgradeReminderAt(
	nowMs = Date.now(),
): number {
	return nowMs + DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS;
}

export function shouldShowDayPassUpgradeReminder(params: {
	expiresAt: string | number | Date | null | undefined;
	isPro: boolean;
	nowMs?: number;
	snoozedUntilMs?: number | null;
}): boolean {
	const nowMs = params.nowMs ?? Date.now();
	if (params.isPro) return false;
	if (getDayPassMsLeft(params.expiresAt, nowMs) <= 0) return false;
	if (params.snoozedUntilMs && params.snoozedUntilMs > nowMs) return false;
	return true;
}
