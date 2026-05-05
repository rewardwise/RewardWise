/** @format */

export default function TropicalBackground() {
	return (
		<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
			{/* Image */}
			<div
				className="absolute inset-0 bg-cover bg-center"
				style={{
					backgroundImage: "url('/beach-hero.png')",
				}}
			/>

			{/* Blue gradient overlay */}
			<div className="absolute inset-0 bg-gradient-to-b from-[#0b1220]/70 via-[#0a1a2f]/60 to-[#0a1a2f]/80" />
		</div>
	);
}