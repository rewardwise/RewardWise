/** @format */

export function getPmTesterEmails() {
	return (process.env.PM_TESTER_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function isPmTesterEmail(email?: string | null) {
	if (!email) return false;
	return getPmTesterEmails().includes(email.trim().toLowerCase());
}
