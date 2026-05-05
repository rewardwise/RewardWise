/** @format */

export function getAllowedTeamEmails() {
	return (process.env.TEAM_ALLOWED_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

/**
 * When `TEAM_ALLOWED_EMAILS` is unset or empty, any signed-in email is allowed (open access).
 * When set (comma-separated), only those addresses may use the app.
 */
export function isAllowedTeamEmail(email?: string | null) {
	if (!email) return false;

	const allowedEmails = getAllowedTeamEmails();
	if (allowedEmails.length === 0) return true;

	return allowedEmails.includes(email.trim().toLowerCase());
}