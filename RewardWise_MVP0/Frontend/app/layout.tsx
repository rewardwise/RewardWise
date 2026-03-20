/** @format */

import { WalletProvider } from "@/context/WalletContext";
import { AlertProvider } from "@/context/AlertContext";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthProvider";
import { SearchFillProvider } from "@/context/SearchFillContext";
import { ABTestProvider } from "@/context/ABTestContext";
import TopNav from "@/components/TopNav";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
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
	description: "One verdict, not 47 options",
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
								{/* GLOBAL NAVBAR */}

								<NavbarWrapper />
								{/* PAGE CONTENT */}
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
