/** @format */

export default function TropicalBackground() {
	return (
		<div className="absolute inset-0">
			{/* Image */}
			<div
				className="absolute inset-0 bg-cover bg-center"
				style={{
					backgroundImage:
						"url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')",
				}}
			/>

			{/* Blue gradient overlay (THIS is what you're missing) */}
			<div className="absolute inset-0 bg-gradient-to-b from-[#0b1220]/70 via-[#0a1a2f]/60 to-[#0a1a2f]/80" />
		</div>
	);
}
