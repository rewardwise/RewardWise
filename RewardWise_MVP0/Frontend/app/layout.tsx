/** @format */

import { WalletProvider } from "@/context/WalletContext";
import { AlertProvider } from "@/context/AlertContext";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthProvider";
import { SearchFillProvider } from "@/context/SearchFillContext";
import { ABTestProvider } from "@/context/ABTestContext";
import NavbarWrapper from "@/components/NavbarWrapper";
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

export const metadata: Metadata = {
	title: "MyTravelWallet",
	description:
		"Travel smarter. Spend wiser. Join the MyTravelWallet early access waitlist.",
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
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
									<NavbarWrapper />
									<PaymentNotificationBanner />
									<DayPassUpgradeReminder />
									{children}
								</SearchFillProvider>
							</ABTestProvider>
						</AlertProvider>
					</WalletProvider>
				</AuthProvider>
			</body>
		</html>
	);
}