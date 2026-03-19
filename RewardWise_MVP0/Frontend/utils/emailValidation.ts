/** @format */

const BLOCKED_DOMAINS = new Set([
  // Generic fake/test domains
  "xyz.com",
  "test.com",
  "example.com",
  "fake.com",
  "fakemail.com",
  "invalid.com",
  "noemail.com",
  "nomail.com",
  "noreply.com",
  // Disposable / temp mail services
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "grr.la",
  "sharklasers.com",
  "spam4.me",
  "trashmail.com",
  "throwam.com",
  "throwaway.email",
  "tempmail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "yopmail.com",
  "dispostable.com",
  "mailnull.com",
  "spamgourmet.com",
  "maildrop.cc",
  "10minutemail.com",
  "minutemail.com",
  "discard.email",
  "spamhereplease.com",
]);

/**
 * Returns an error message string if the email is invalid, or null if it's ok.
 * Only intended for use on signup — login should not block existing users.
 */
export function validateSignupEmail(email: string): string | null {
  if (!email) return "Email address is required";

  // Basic format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Please enter a valid email address";
  }

  const domain = email.split("@")[1].toLowerCase();

  if (BLOCKED_DOMAINS.has(domain)) {
    return "Please use a real email address to sign up";
  }

  return null;
}
