/** @format */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
	try {
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.SUPABASE_SERVICE_ROLE_KEY!,
		);

		// Read Authorization header
		const authHeader = request.headers.get("authorization");

		if (!authHeader) {
			return NextResponse.json(
				{ error: "Missing authorization header" },
				{ status: 401 },
			);
		}

		// Extract token
		const token = authHeader.replace("Bearer ", "");

		// Validate user using token
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser(token);

		if (userError || !user) {
			return NextResponse.json(
				{ error: "Invalid or expired session" },
				{ status: 401 },
			);
		}

		// Delete user using Admin API
		const { error: deleteError } = await supabase.auth.admin.deleteUser(
			user.id,
		);

		if (deleteError) {
			return NextResponse.json({ error: deleteError.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: "Account deleted successfully",
		});
	} catch (error) {
		console.error("Delete account error:", error);

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
