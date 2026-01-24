import { getPreset } from "@/lib/deck-validation/presets";

export interface FormatGroup {
	label: string;
	formats: { value: string; label: string }[];
}

export type CommanderType =
	| "commander"
	| "oathbreaker"
	| "brawl"
	| "pauper"
	| null;

export interface FormatInfo {
	deckSize: number | "variable";
	singleton: boolean;
	commanderType: CommanderType;
	hasSignatureSpell: boolean;
	hasSideboard: boolean;
	tagline: string;
	isCube: boolean;
}

/**
 * Short taglines describing each format's identity.
 * Focused on what makes formats unique, not rules details.
 */
const FORMAT_TAGLINES: Record<string, string> = {
	// Constructed
	standard: "Rotating · Recent sets",
	pioneer: "Non-rotating · 2012+",
	modern: "Non-rotating · 2003+",
	legacy: "Eternal · All sets",
	vintage: "Eternal · Power allowed",
	pauper: "Commons only",

	// Commander
	commander: "Multiplayer · Casual",
	duel: "1v1 · Competitive",
	paupercommander: "Commons + uncommon commander",
	predh: "Pre-2020 cards only",
	oathbreaker: "Planeswalker + signature spell",

	// Brawl
	brawl: "Arena · Historic card pool",
	standardbrawl: "Arena · Standard card pool",

	// Arena
	historic: "Arena · Non-rotating",
	timeless: "Arena · No bans",
	alchemy: "Arena · Digital cards",
	gladiator: "Arena · 100-card singleton",

	// Retro
	premodern: "1995–2003 cards",
	oldschool: "1993–1994 cards",

	// Limited
	draft: "40-card · Drafted cards + basic lands",

	// Other
	penny: "Budget · Rotating cheapest",
	cube: "Draft · Custom card pool",

	// Casual
	kitchentable: "Anything goes",
};

/**
 * Get stable format info that won't change with rules updates.
 * Used for UI display (deck size badges, singleton indicators, etc.)
 */
export function getFormatInfo(format: string): FormatInfo {
	// Special case: Cube
	if (format === "cube") {
		return {
			deckSize: "variable",
			singleton: true,
			commanderType: null,
			hasSignatureSpell: false,
			hasSideboard: false,
			tagline: FORMAT_TAGLINES.cube,
			isCube: true,
		};
	}

	const preset = getPreset(format);
	if (!preset) {
		return {
			deckSize: 60,
			singleton: false,
			commanderType: null,
			hasSignatureSpell: false,
			hasSideboard: true,
			tagline: "",
			isCube: false,
		};
	}

	const { rules, config } = preset;
	const rulesSet = new Set(rules);

	const deckSize = config.deckSize ?? config.minDeckSize ?? 60;
	const singleton = rulesSet.has("singleton");
	const hasSideboard = (config.sideboardSize ?? 0) > 0;
	const hasSignatureSpell = rulesSet.has("signatureSpell");

	// Determine commander type
	let commanderType: CommanderType = null;
	if (rulesSet.has("commanderPlaneswalker")) {
		commanderType = "oathbreaker";
	} else if (rulesSet.has("commanderRequired")) {
		if (format === "brawl" || format === "standardbrawl") {
			commanderType = "brawl";
		} else if (format === "paupercommander") {
			commanderType = "pauper";
		} else {
			commanderType = "commander";
		}
	}

	return {
		deckSize,
		singleton,
		commanderType,
		hasSignatureSpell,
		hasSideboard,
		tagline: FORMAT_TAGLINES[format] ?? "",
		isCube: false,
	};
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
		label: "Limited",
		formats: [{ value: "draft", label: "Draft" }],
	},
	{
		label: "Other",
		formats: [
			{ value: "penny", label: "Penny Dreadful" },
			{ value: "cube", label: "Cube" },
			{ value: "kitchentable", label: "Kitchen Table" },
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
