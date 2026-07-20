/** @format */
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="font-mtw flex min-h-screen flex-col items-center justify-center bg-mtw-surface-mint px-6 text-center text-mtw-ink">
			<p className="text-sm font-semibold uppercase tracking-[0.2em] text-mtw-muted">404</p>
			<h1 className="mt-3 text-3xl font-semibold">That page took a different flight.</h1>
			<p className="mt-2 max-w-md text-mtw-small text-mtw-muted">
				The page you are looking for does not exist or has moved.
			</p>
			<Link
				href="/home"
				className="mt-6 rounded-mtw bg-mtw-emerald px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
			>
				Back to MyTravelWallet
			</Link>
		</div>
	);
}
