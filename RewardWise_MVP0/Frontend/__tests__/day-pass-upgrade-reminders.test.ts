/** @format */

import { describe, expect, it } from "vitest";
import {
	DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS,
	formatDayPassTimeLeft,
	getDayPassMsLeft,
	getNextDayPassUpgradeReminderAt,
	shouldShowDayPassUpgradeReminder,
} from "@/utils/entitlements/day-pass-reminders";

describe("day pass upgrade reminders", () => {
	const now = new Date("2026-05-14T12:00:00.000Z").getTime();
	const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

	it("shows reminders for active day pass users who are not Pro", () => {
		expect(
			shouldShowDayPassUpgradeReminder({
				expiresAt,
				isPro: false,
				nowMs: now,
				snoozedUntilMs: null,
			}),
		).toBe(true);
	});

	it("does not show reminders to Pro users", () => {
		expect(
			shouldShowDayPassUpgradeReminder({
				expiresAt,
				isPro: true,
				nowMs: now,
				snoozedUntilMs: null,
			}),
		).toBe(false);
	});

	it("does not show reminders after the day pass expires", () => {
		expect(
			shouldShowDayPassUpgradeReminder({
				expiresAt: now - 1,
				isPro: false,
				nowMs: now,
				snoozedUntilMs: null,
			}),
		).toBe(false);
	});

	it("snoozes the next reminder for the configured interval", () => {
		const nextReminderAt = getNextDayPassUpgradeReminderAt(now);
		expect(nextReminderAt - now).toBe(DAY_PASS_UPGRADE_REMINDER_INTERVAL_MS);

		expect(
			shouldShowDayPassUpgradeReminder({
				expiresAt,
				isPro: false,
				nowMs: now,
				snoozedUntilMs: nextReminderAt,
			}),
		).toBe(false);

		expect(
			shouldShowDayPassUpgradeReminder({
				expiresAt,
				isPro: false,
				nowMs: nextReminderAt,
				snoozedUntilMs: nextReminderAt,
			}),
		).toBe(true);
	});

	it("formats the remaining pass time", () => {
		expect(getDayPassMsLeft(expiresAt, now)).toBe(24 * 60 * 60 * 1000);
		expect(formatDayPassTimeLeft(24 * 60 * 60 * 1000)).toBe("24h left");
		expect(formatDayPassTimeLeft(90 * 60 * 1000)).toBe("1h 30m left");
		expect(formatDayPassTimeLeft(25 * 60 * 1000)).toBe("25m left");
	});
});
