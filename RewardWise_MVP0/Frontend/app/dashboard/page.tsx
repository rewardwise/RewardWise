/** @format */

"use client";

import { Plane, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";

export default function DashboardPage() {
	const { user, signOut } = useAuth();

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm">
				<div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
					<Link href="/" className="flex items-center gap-2 text-gray-900">
						<Plane className="w-6 h-6" />
						<span className="font-bold text-lg">MyTravelWallet</span>
					</Link>
					<div className="flex items-center gap-4">
						<span className="text-gray-600 text-sm">{user?.email}</span>
						<button
							onClick={signOut}
							className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
						>
							<LogOut className="w-4 h-4" />
							Log Out
						</button>
					</div>
				</div>
			</header>
			<main className="max-w-7xl mx-auto px-6 py-12">
				<h1 className="text-2xl font-bold text-gray-900">
					Welcome
					{user?.user_metadata?.full_name
						? `, ${user.user_metadata.full_name}`
						: ""}
					!
				</h1>
				<p className="text-gray-600 mt-2">
					Your MyTravelWallet dashboard is ready.
				</p>
			</main>
		</div>
	);
}
