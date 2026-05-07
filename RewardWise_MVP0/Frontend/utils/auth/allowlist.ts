/** @format */

/**
 * App access is now open to all authenticated users.
 * PM-only surfaces should use PM_TESTER_EMAILS via utils/auth/pm-testers.ts.
 */
export function getAllowedTeamEmails() {
	return [];
}

export function isAllowedTeamEmail(email?: string | null) {
	return Boolean(email);
}
