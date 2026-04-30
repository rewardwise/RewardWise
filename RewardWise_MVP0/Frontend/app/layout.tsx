/** @format */

import { WalletProvider } from "@/context/WalletContext";
import { AlertProvider } from "@/context/AlertContext";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthProvider";
import { SearchFillProvider } from "@/context/SearchFillContext";
import { ABTestProvider } from "@/context/ABTestContext";
import NavbarWrapper from "@/components/NavbarWrapper";
import PaymentNotificationBanner from "@/components/PaymentNotificationBanner";
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
									<NavbarWrapper />
									<PaymentNotificationBanner />
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