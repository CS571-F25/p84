export interface FormatGroup {
	label: string;
	formats: { value: string; label: string }[];
}

export const FORMAT_GROUPS: FormatGroup[] = [
	{
		label: "Constructed",
		formats: [
			{ value: "standard", label: "Standard" },
			{ value: "pioneer", label: "Pioneer" },
			{ value: "modern", label: "Modern" },
			{ value: "legacy", label: "Legacy" },
			{ value: "vintage", label: "Vintage" },
			{ value: "pauper", label: "Pauper" },
		],
	},
	{
		label: "Commander",
		formats: [
			{ value: "commander", label: "Commander" },
			{ value: "duel", label: "Duel Commander" },
			{ value: "paupercommander", label: "Pauper Commander" },
			{ value: "predh", label: "PreDH" },
			{ value: "oathbreaker", label: "Oathbreaker" },
		],
	},
	{
		label: "Brawl",
		formats: [
			{ value: "brawl", label: "Brawl" },
			{ value: "standardbrawl", label: "Standard Brawl" },
		],
	},
	{
		label: "Arena",
		formats: [
			{ value: "historic", label: "Historic" },
			{ value: "timeless", label: "Timeless" },
			{ value: "alchemy", label: "Alchemy" },
			{ value: "gladiator", label: "Gladiator" },
		],
	},
	{
		label: "Retro",
		formats: [
			{ value: "premodern", label: "Premodern" },
			{ value: "oldschool", label: "Old School" },
		],
	},
	{
		label: "Other",
		formats: [
			{ value: "penny", label: "Penny Dreadful" },
			{ value: "cube", label: "Cube" },
		],
	},
];

const FORMAT_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
	FORMAT_GROUPS.flatMap((group) =>
		group.formats.map((fmt) => [fmt.value, fmt.label]),
	),
);

export function formatDisplayName(format: string | undefined): string {
	if (!format) return "";
	return FORMAT_DISPLAY_NAMES[format] ?? format;
}
