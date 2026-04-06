/** @format */

"use client";

import { useAuth } from "@/context/AuthProvider";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function NavbarWrapper() {
	const { user } = useAuth();
	const pathname = usePathname();

	const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password"];

	if (!user || publicRoutes.includes(pathname)) return null;

	return <TopNav />;
}
