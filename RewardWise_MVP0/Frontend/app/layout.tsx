/** @format */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* ADD THESE */
import { AuthProvider } from "@/context/AuthContext";
import { SearchFillProvider } from "@/context/SearchFillContext";
import { ABTestProvider } from "@/context/ABTestContext";
const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "RewardWise",
	description: "One verdict, not 47 options",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				{/* PROVIDERS WRAP CHILDREN */}
				<AuthProvider>
					<ABTestProvider>
						<SearchFillProvider>{children}</SearchFillProvider>
					</ABTestProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
