/** @format */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";

import { useAuth } from "@/context/AuthProvider";
import TropicalBackground from "@/components/TropicalBackground";
import { validateSignupEmail } from "@/utils/emailValidation";

import {
	ArrowLeft,
	Plane,
	Mail,
	Lock,
	Eye,
	EyeOff,
	Loader2,
} from "lucide-react";

export default function SignUpPage() {
	const router = useRouter();
	const { signInWithGoogle, signUpWithEmail, user } = useAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);

	const validate = () => {
		const errs: Record<string, string> = {};

		const emailError = validateSignupEmail(email);
		if (emailError) errs.email = emailError;

		if (!password) errs.password = "Password is required";
		else if (password.length < 8)
			errs.password = "Password must be at least 8 characters long";

		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setLoading(true);

		const { error } = await signUpWithEmail(email, password);

		if (error) {
			setErrors({ general: error.message });
		} else {
			setErrors({ general: "Check your email to confirm your account." });
		}
		setLoading(false);
	};
	useEffect(() => {
		if (user) {
			router.replace("/home");
		}
	}, [user, router]);
	if (user) return null;
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
						<span className="font-bold text-lg text-white">MyTravelWallet</span>
					</div>

					<h1 className="text-2xl font-bold text-white mb-2">
						Create your account
					</h1>

					<p className="text-gray-400 mb-6">
						Start your journey to smarter travel rewards
					</p>

					{Object.keys(errors).length > 0 && (
						<div
							role="alert"
							className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4"
						>
							<ul className="text-red-300 text-sm list-disc list-inside">
								{Object.values(errors).map((error, i) => (
									<li key={i}>{error}</li>
								))}
							</ul>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4" noValidate>
						{/* EMAIL */}
						<div>
							<label className="block text-sm text-gray-300 mb-1">
								Email <span className="text-red-400">*</span>
							</label>

							<div className="relative">
								<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

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

						{/* PASSWORD */}
						<div>
							<label className="block text-sm text-gray-300 mb-1">
								Password <span className="text-red-400">*</span>
							</label>

							<div className="relative">
								<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

								<input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Min. 8 characters"
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
									{showPassword ? <EyeOff /> : <Eye />}
								</button>
							</div>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
						>
							{loading ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" />
									Creating account...
								</>
							) : (
								"Create Account"
							)}
						</button>
					</form>

					<p className="mt-4 text-center text-gray-400 text-sm">
						Already have an account?{" "}
						<button
							onClick={() => router.push("/login")}
							className="text-emerald-400 hover:text-emerald-300"
						>
							Log In
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
							type="button"
							onClick={signInWithGoogle}
							className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-3 transition-colors"
						>
							<FcGoogle size={20} />
							Sign up with Google
						</button>
					</div>

					<div className="mt-3 pt-3 border-t border-gray-700/50 text-center">
						<p className="text-gray-500 text-xs mb-1">
							Not planning a trip yet?
						</p>
						<button
							onClick={() => router.push("/home")}
							className="text-emerald-400 hover:text-emerald-300 text-sm"
						>
							Just show me my wallet value →
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
