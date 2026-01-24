import type { RuleId } from "./rules";
import type { FormatConfig, Preset } from "./types";

/**
 * Reusable rule sets for common format patterns
 */
const SIXTY_CARD_RULES = [
	"cardLegality",
	"banned",
	"playset",
	"deckSizeMin",
	"sideboardSize",
] as const satisfies readonly RuleId[];

const COMMANDER_CORE_RULES = [
	"cardLegality",
	"banned",
	"singleton",
	"colorIdentity",
	"deckSizeExact",
	"commanderRequired",
	"commanderPartner",
] as const satisfies readonly RuleId[];

/**
 * Format preset definitions
 *
 * Each preset combines:
 * - rules: Which validation rules to apply
 * - config: Parameters for those rules (legality field, deck sizes, etc.)
 */
export const PRESETS = {
	// 60-card constructed formats
	standard: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "standard", minDeckSize: 60, sideboardSize: 15 },
	},
	pioneer: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "pioneer", minDeckSize: 60, sideboardSize: 15 },
	},
	modern: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "modern", minDeckSize: 60, sideboardSize: 15 },
	},
	legacy: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "legacy", minDeckSize: 60, sideboardSize: 15 },
	},
	vintage: {
		rules: [...SIXTY_CARD_RULES, "restricted"] as const,
		config: { legalityField: "vintage", minDeckSize: 60, sideboardSize: 15 },
	},
	pauper: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "pauper", minDeckSize: 60, sideboardSize: 15 },
	},

	// Commander variants (100-card singleton)
	commander: {
		rules: [...COMMANDER_CORE_RULES, "commanderLegendary"] as const,
		config: { legalityField: "commander", deckSize: 100 },
	},
	paupercommander: {
		rules: [...COMMANDER_CORE_RULES, "commanderUncommon"] as const,
		config: { legalityField: "paupercommander", deckSize: 100 },
	},
	duel: {
		rules: [...COMMANDER_CORE_RULES, "commanderLegendary"] as const,
		config: { legalityField: "duel", deckSize: 100 },
	},
	predh: {
		rules: [...COMMANDER_CORE_RULES, "commanderLegendary"] as const,
		config: { legalityField: "predh", deckSize: 100 },
	},

	// Oathbreaker (60-card singleton with planeswalker commander)
	oathbreaker: {
		rules: [
			"cardLegality",
			"banned",
			"singleton",
			"colorIdentity",
			"deckSizeExact",
			"commanderPlaneswalker",
			"signatureSpell",
		] as const,
		config: { legalityField: "legacy", deckSize: 60 },
	},

	// Brawl variants (singleton with commander)
	brawl: {
		rules: [
			"cardLegality",
			"banned",
			"singleton",
			"colorIdentity",
			"deckSizeExact",
			"commanderRequired",
			"commanderPartner",
			"commanderLegendary",
		] as const,
		config: { legalityField: "brawl", deckSize: 100 },
	},
	standardbrawl: {
		rules: [
			"cardLegality",
			"banned",
			"singleton",
			"colorIdentity",
			"deckSizeExact",
			"commanderRequired",
			"commanderLegendary",
		] as const,
		config: { legalityField: "standardbrawl", deckSize: 60 },
	},

	// Arena formats
	historic: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "historic", minDeckSize: 60, sideboardSize: 15 },
	},
	timeless: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "timeless", minDeckSize: 60, sideboardSize: 15 },
	},
	alchemy: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "alchemy", minDeckSize: 60, sideboardSize: 15 },
	},
	gladiator: {
		rules: ["cardLegality", "banned", "singleton", "deckSizeMin"] as const,
		config: { legalityField: "gladiator", minDeckSize: 100 },
	},

	// Retro formats
	premodern: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "premodern", minDeckSize: 60, sideboardSize: 15 },
	},
	oldschool: {
		rules: [...SIXTY_CARD_RULES, "restricted"] as const,
		config: { legalityField: "oldschool", minDeckSize: 60, sideboardSize: 15 },
	},

	// Other
	penny: {
		rules: SIXTY_CARD_RULES,
		config: { legalityField: "penny", minDeckSize: 60, sideboardSize: 15 },
	},

	// Limited
	draft: {
		rules: ["deckSizeMin"] as const,
		config: { minDeckSize: 40 },
	},

	// Casual
	kitchentable: {
		rules: [] as const,
		config: {},
	},
} as const satisfies Record<string, Preset<RuleId>>;

export type FormatId = keyof typeof PRESETS;

/**
 * Get the preset for a format, if one exists
 */
export function getPreset(format: string): Preset<RuleId> | undefined {
	return PRESETS[format as FormatId];
}

/**
 * Get the config for a format, if one exists
 */
export function getFormatConfig(format: string): FormatConfig | undefined {
	return getPreset(format)?.config;
}
