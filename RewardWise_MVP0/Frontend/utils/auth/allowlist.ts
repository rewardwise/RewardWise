/** @format */

export function getAllowedTeamEmails() {
	return (process.env.TEAM_ALLOWED_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isAllowedTeamEmail(email?: string | null) {
	if (!email) return false;

	const allowedEmails = getAllowedTeamEmails();
	return allowedEmails.includes(email.trim().toLowerCase());
}