/** @format */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthProvider";
import { useSearchFill } from "@/context/SearchFillContext";

import TropicalBackground from "@/components/TropicalBackground";

import {
	ArrowLeft,
	Plane,
	Mail,
	Lock,
	Eye,
	EyeOff,
	Loader2,
	Sparkles,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
export default function LoginPage() {
	const router = useRouter();
	const { signInWithEmail, signInWithGoogle, user } = useAuth();
	const { pendingSearch } = useSearchFill();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<any>({});
	const [loading, setLoading] = useState(false);
	useEffect(() => {
		if (user) {
			router.replace(pendingSearch ? "/search" : "/home");
		}
	}, [user, pendingSearch, router]);
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const errs: any = {};
		if (!email) errs.email = "Email address is required";
		if (!password) errs.password = "Password is required";

		setErrors(errs);
		if (Object.keys(errs).length > 0) return;

		setLoading(true);

		const { error } = await signInWithEmail(email, password);

		if (error) {
			setErrors({ general: error.message });
			setLoading(false);
			return;
		}

		// allow auth state to update before redirect
		setTimeout(() => {
			router.push(pendingSearch ? "/search" : "/home");
		}, 100);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10 min-h-screen flex items-center justify-center p-6">
				<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 w-full max-w-md shadow-2xl">
					<button
						onClick={() => router.push("/")}
						className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
					>
						<ArrowLeft className="w-4 h-4" /> Back
					</button>

					<div className="flex items-center gap-2 mb-6">
						<Plane className="w-6 h-6 text-blue-400" />
						<span className="font-bold text-lg text-white">RewardWise</span>
					</div>

					<h1 id="main-content" className="text-2xl font-bold text-white mb-2">
						Welcome back
					</h1>

					<p className="text-gray-400 mb-6">
						{pendingSearch
							? "Log in to see your search results"
							: "Log in to access your rewards dashboard"}
					</p>

					{pendingSearch && (
						<div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 flex items-center gap-3">
							<Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
							<div>
								<p className="text-white text-sm font-medium">
									{pendingSearch.origin} → {pendingSearch.destination} results
									waiting
								</p>
								<p className="text-gray-400 text-xs">
									Log in to unlock your full verdict
								</p>
							</div>
						</div>
					)}

					{Object.keys(errors).length > 0 && (
						<div
							role="alert"
							className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4"
						>
							<ul className="text-red-300 text-sm list-disc list-inside">
								{Object.values(errors).map((error: any, i) => (
									<li key={i}>{error}</li>
								))}
							</ul>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4" noValidate>
						<div>
							<label className="block text-sm text-gray-300 mb-1">
								Email <span className="text-red-400">*</span>
							</label>

							<div className="relative">
								<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />

								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="name@example.com"
									className={`w-full bg-gray-800/80 border ${
										errors.email ? "border-red-500" : "border-gray-700"
									} rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 
focus:outline-none focus:ring-2 focus:ring-emerald-500`}
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm text-gray-300 mb-1">
								Password <span className="text-red-400">*</span>
							</label>

							<div className="relative">
								<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />

								<input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									className={`w-full bg-gray-800/80 border ${
										errors.password ? "border-red-500" : "border-gray-700"
									} rounded-lg py-3 pl-10 pr-12 text-white placeholder-gray-500 
focus:outline-none focus:ring-2 focus:ring-emerald-500`}
								/>

								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
								>
									{showPassword ? (
										<EyeOff className="w-5 h-5" />
									) : (
										<Eye className="w-5 h-5" />
									)}
								</button>
							</div>
						</div>

						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => router.push("/forgot-password")}
								className="text-emerald-400 hover:text-emerald-300 text-sm"
							>
								Forgot password?
							</button>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
						>
							{loading ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" /> Logging in...
								</>
							) : (
								"Log In"
							)}
						</button>
					</form>

					<p className="mt-4 text-center text-gray-400 text-sm">
						Don't have an account?{" "}
						<button
							onClick={() => router.push("/signup")}
							className="text-emerald-400 hover:text-emerald-300"
						>
							Sign Up
						</button>
					</p>
					<div className="mt-6">
						<div className="flex items-center mb-4">
							<div className="flex-1 border-t border-gray-700"></div>
							<span className="px-3 text-gray-400 text-sm">
								Or continue with
							</span>
							<div className="flex-1 border-t border-gray-700"></div>
						</div>

						<button
							onClick={signInWithGoogle}
							className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-3 transition-colors"
						>
							<FcGoogle size={20} />
							Sign in with Google
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
