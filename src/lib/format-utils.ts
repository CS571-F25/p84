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
	supportsAlchemy: boolean;
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
			supportsAlchemy: false,
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
			supportsAlchemy: false,
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
		supportsAlchemy: config.supportsAlchemy ?? false,
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

/**
 * Deck characteristics for format suggestion
 */
export interface DeckCharacteristics {
	deckSize: number;
	hasCommander: boolean;
	/** Deck contains alchemy cards (A- prefix or alchemy set codes) that failed to resolve */
	hasAlchemyCards: boolean;
}

// Pre-computed format info for all formats (avoids repeated getFormatInfo calls)
const ALL_FORMATS: Array<{ id: string; info: FormatInfo }> =
	FORMAT_GROUPS.flatMap((group) =>
		group.formats.map((fmt) => ({
			id: fmt.value,
			info: getFormatInfo(fmt.value),
		})),
	);

/**
 * Suggest formats that match the deck's characteristics better than the current format.
 * Returns format IDs sorted by relevance (max 3).
 *
 * Scoring:
 * - +100 for alchemy support (when deck has alchemy cards)
 * - +50 for commander support (when deck has commander)
 * - +30 for matching deck size (within 20%)
 * - +10 for close deck size (within 50%)
 *
 * Exclusions:
 * - Formats that don't support alchemy when deck has alchemy cards (hard filter)
 * - Formats with commander mismatch (deck has commander but format doesn't, or vice versa)
 * - Cube (too specific, user knows if they're building a cube)
 *
 * Falls back to Kitchen Table if no other formats match.
 */
export function suggestFormats(
	characteristics: DeckCharacteristics,
	currentFormat: string,
): string[] {
	const { deckSize, hasCommander, hasAlchemyCards } = characteristics;

	const candidates: Array<{ format: string; score: number }> = [];

	for (const { id, info } of ALL_FORMATS) {
		if (id === currentFormat) continue;

		// Skip cube (too specific) and kitchentable (handled as fallback)
		if (info.isCube || id === "kitchentable") continue;

		let score = 0;

		// Alchemy support is a hard requirement if deck has alchemy cards
		if (hasAlchemyCards) {
			if (info.supportsAlchemy) {
				score += 100;
			} else {
				continue;
			}
		}

		// Commander mismatch is a hard exclusion - the format fundamentally
		// doesn't fit the deck structure. We exclude rather than penalize because
		// a 60-card commander deck in "Modern" shouldn't see "Standard" suggested
		// just because it has a slightly less negative score.
		const commanderMismatch =
			(hasCommander && info.commanderType === null) ||
			(!hasCommander && info.commanderType !== null);

		if (commanderMismatch) continue;

		if (hasCommander && info.commanderType !== null) {
			score += 50;
		}

		// Deck size matching (within ~20% tolerance)
		const expectedSize = info.deckSize === "variable" ? null : info.deckSize;
		if (expectedSize) {
			const sizeDiff = Math.abs(deckSize - expectedSize);
			const tolerance = expectedSize * 0.2;
			if (sizeDiff <= tolerance) {
				score += 30;
			} else if (sizeDiff <= expectedSize * 0.5) {
				score += 10;
			}
		}

		if (score > 0) {
			candidates.push({ format: id, score });
		}
	}

	const results = candidates
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((c) => c.format);

	// Fall back to Kitchen Table if nothing else matches
	if (results.length === 0 && currentFormat !== "kitchentable") {
		return ["kitchentable"];
	}

	return results;
}

/**
 * Format a list of format suggestions as a readable string.
 * e.g., ["brawl", "standardbrawl"] → "Brawl or Standard Brawl"
 */
export function formatSuggestionList(formats: string[]): string {
	if (formats.length === 0) return "";
	if (formats.length === 1) return formatDisplayName(formats[0]);
	if (formats.length === 2) {
		return `${formatDisplayName(formats[0])} or ${formatDisplayName(formats[1])}`;
	}
	const last = formats[formats.length - 1];
	const rest = formats.slice(0, -1);
	return `${rest.map(formatDisplayName).join(", ")}, or ${formatDisplayName(last)}`;
}
