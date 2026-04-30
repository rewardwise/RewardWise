/** @format */

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;
	lastCleanup = now;
	for (const [key, entry] of store) {
		if (entry.resetAt <= now) store.delete(key);
	}
}

export type RateLimitConfig = {
	maxRequests: number;
	windowMs: number;
};

export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig,
): { allowed: boolean; retryAfterMs: number } {
	cleanup();
	const now = Date.now();
	const key = identifier;
	const entry = store.get(key);

	if (!entry || entry.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + config.windowMs });
		return { allowed: true, retryAfterMs: 0 };
	}

	if (entry.count < config.maxRequests) {
		entry.count++;
		return { allowed: true, retryAfterMs: 0 };
	}

	return { allowed: false, retryAfterMs: entry.resetAt - now };
}

export function getClientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	const real = request.headers.get("x-real-ip");
	if (real) return real;
	return "unknown";
}
