"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	Plane,
	Lock,
	Eye,
	EyeOff,
	Loader2,
	CheckCircle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import TropicalBackground from "@/components/TropicalBackground";

export default function ResetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!password || password.length < 8) {
			setError("Password must be at least 8 characters long");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);

		const supabase = createClient();
		const { error: updateError } = await supabase.auth.updateUser({
			password,
		});

		setLoading(false);

		if (updateError) {
			setError(updateError.message);
			return;
		}

		setSuccess(true);
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-cyan-950 relative">
			<TropicalBackground />

			<div className="relative z-10 min-h-screen flex items-center justify-center p-6">
				<div className="bg-gray-900/90 backdrop-blur rounded-xl p-8 w-full max-w-md shadow-2xl">
					<div className="flex items-center gap-2 mb-6">
						<Plane className="w-6 h-6 text-blue-400" />
						<span className="font-bold text-lg text-white">RewardWise</span>
					</div>

					{success ? (
						<div className="text-center py-4">
							<CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
							<h1 className="text-2xl font-bold text-white mb-2">
								Password updated
							</h1>
							<p className="text-gray-400 mb-6">
								Your password has been reset successfully.
							</p>
							<button
								onClick={() => router.push("/login")}
								className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
							>
								Log In
							</button>
						</div>
					) : (
						<>
							<h1 className="text-2xl font-bold text-white mb-2">
								Set new password
							</h1>
							<p className="text-gray-400 mb-6">
								Enter your new password below.
							</p>

							{error && (
								<div
									role="alert"
									className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4"
								>
									<p className="text-red-300 text-sm">{error}</p>
								</div>
							)}

							<form onSubmit={handleSubmit} className="space-y-4" noValidate>
								<div>
									<label className="block text-sm text-gray-300 mb-1">
										New Password <span className="text-red-400">*</span>
									</label>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
										<input
											type={showPassword ? "text" : "password"}
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											placeholder="Min. 8 characters"
											className="w-full bg-gray-800/80 border border-gray-700 rounded-lg py-3 pl-10 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

								<div>
									<label className="block text-sm text-gray-300 mb-1">
										Confirm Password <span className="text-red-400">*</span>
									</label>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
										<input
											type={showPassword ? "text" : "password"}
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											placeholder="Re-enter your password"
											className="w-full bg-gray-800/80 border border-gray-700 rounded-lg py-3 pl-10 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
								</div>

								<button
									type="submit"
									disabled={loading}
									className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
								>
									{loading ? (
										<>
											<Loader2 className="w-5 h-5 animate-spin" /> Updating...
										</>
									) : (
										"Update Password"
									)}
								</button>
							</form>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
