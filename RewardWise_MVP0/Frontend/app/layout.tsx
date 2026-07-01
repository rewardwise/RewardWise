/** @format */

import { WalletProvider } from "@/context/WalletContext";
import { AlertProvider } from "@/context/AlertContext";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthProvider";
import { SearchFillProvider } from "@/context/SearchFillContext";
import { ABTestProvider } from "@/context/ABTestContext";
import NavbarWrapper from "@/components/NavbarWrapper";
import AppFooter from "@/components/AppFooter";
import PaymentNotificationBanner from "@/components/PaymentNotificationBanner";
import DayPassUpgradeReminder from "@/components/DayPassUpgradeReminder";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Inter — the redesign typeface (prototype spec). Self-hosted by next/font at
// build time, exactly like Geist (no runtime fetch, no FOUT). Exposed as the
// --font-inter CSS var so the redesign tokens (globals.css @theme --font-mtw)
// and new components can opt in WITHOUT changing the app-wide font yet; the
// global Geist→Inter swap lands in the layout PR.
const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "MyTravelWallet",
	description:
		"Travel smarter. Spend wiser. Get travel-rewards tips and product updates from MyTravelWallet.",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	viewportFit: "cover",
	themeColor: "#0f172a",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
				suppressHydrationWarning
			>
				<AuthProvider>
					<WalletProvider>
						<AlertProvider>
							<ABTestProvider>
								<SearchFillProvider>
									<Suspense fallback={null}>
										<AnalyticsTracker />
									</Suspense>
									{/* Light app shell (redesign): white/light-gray behind all
									    logged-in routes. The island lives only in the logged-out
									    landing hero (8c), not here. */}
									<div className="font-mtw flex min-h-screen flex-col bg-mtw-surface">
										<NavbarWrapper />
										<PaymentNotificationBanner />
										<DayPassUpgradeReminder />
										<div className="flex-1">{children}</div>
										<AppFooter />
									</div>
								</SearchFillProvider>
							</ABTestProvider>
						</AlertProvider>
					</WalletProvider>
				</AuthProvider>
			</body>
		</html>
	);
}