import type { NextConfig } from "next";
import path from "path";

const ContentSecurityPolicy = `
	default-src 'self';
	script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com;
	style-src 'self' 'unsafe-inline';
	img-src 'self' blob: data: https://*.stripe.com;
	font-src 'self' data:;
	frame-src https://js.stripe.com https://checkout.stripe.com;
	connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.stripe.com wss://*.supabase.co https://script.google.com https://script.googleusercontent.com ${process.env.NEXT_PUBLIC_API_URL || ""};
	object-src 'none';
	base-uri 'self';
	form-action 'self' https://checkout.stripe.com;
	frame-ancestors 'none';
	upgrade-insecure-requests;
`
	.replace(/\s{2,}/g, " ")
	.trim();

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: ContentSecurityPolicy,
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "X-XSS-Protection",
		value: "1; mode=block",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), payment=(self)",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{
		key: "X-DNS-Prefetch-Control",
		value: "on",
	},
];

const nextConfig: NextConfig = {
	turbopack: {
		root: path.resolve(__dirname),
	},
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
