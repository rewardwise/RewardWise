/** @format */

import { createClient } from "@/utils/supabase/server";
import { isThankYouEmail } from "@/utils/auth/thank-you-accounts";
import SubscribeClient from "./SubscribeClient";

export default async function SubscribePage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	const isThankYou = isThankYouEmail(user?.email);

	return <SubscribeClient isThankYou={isThankYou} />;
}
