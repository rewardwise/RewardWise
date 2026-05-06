/** @format */

export type AvailableCard = {
	id: string;
	name: string;
	program: string;
	logo: string;
	category: "card" | "airline";
};

export const AVAILABLE_CARDS: AvailableCard[] = [
	{
		id: "csr",
		name: "Chase Sapphire Reserve",
		program: "Chase Ultimate Rewards",
		logo: "💳",
		category: "card",
	},
	{
		id: "csp",
		name: "Chase Sapphire Preferred",
		program: "Chase Ultimate Rewards",
		logo: "💳",
		category: "card",
	},
	{
		id: "amex_gold",
		name: "Amex Gold Card",
		program: "Amex Membership Rewards",
		logo: "💳",
		category: "card",
	},
	{
		id: "amex_plat",
		name: "Amex Platinum",
		program: "Amex Membership Rewards",
		logo: "💳",
		category: "card",
	},
	{
		id: "citi_premier",
		name: "Citi Premier",
		program: "Citi ThankYou Points",
		logo: "💳",
		category: "card",
	},
	{
		id: "capital_one",
		name: "Capital One Venture X",
		program: "Capital One Miles",
		logo: "💳",
		category: "card",
	},
	{
		id: "united",
		name: "United Explorer",
		program: "United MileagePlus",
		logo: "✈️",
		category: "card",
	},
	{
		id: "delta",
		name: "Delta SkyMiles Gold",
		program: "Delta SkyMiles",
		logo: "✈️",
		category: "card",
	},
	{
		id: "marriott",
		name: "Marriott Bonvoy Boundless",
		program: "Marriott Bonvoy",
		logo: "🏨",
		category: "card",
	},
	{
		id: "delta_skymiles",
		name: "Delta SkyMiles",
		program: "Delta SkyMiles",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "united_mileageplus",
		name: "United MileagePlus",
		program: "United MileagePlus",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "alaska_mileage_plan",
		name: "Alaska Mileage Plan",
		program: "Alaska Mileage Plan",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "american_aadvantage",
		name: "American AAdvantage",
		program: "American AAdvantage",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "aeroplan",
		name: "Air Canada Aeroplan",
		program: "Air Canada Aeroplan",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "cathay_asia_miles",
		name: "Cathay Asia Miles",
		program: "Cathay Asia Miles",
		logo: "✈️",
		category: "airline",
	},
	{
		id: "ana_mileage_club",
		name: "ANA Mileage Club",
		program: "ANA Mileage Club",
		logo: "✈️",
		category: "airline",
	},
];
