export {
	anteCardRule,
	bannedRule,
	cardLegalityRule,
	conspiracyCardRule,
	deckSizeExactRule,
	deckSizeMinRule,
	illegalCardTypeRule,
	playsetRule,
	restrictedRule,
	sideboardSizeRule,
	singletonRule,
} from "./base";

export {
	colorIdentityRule,
	commanderLegendaryRule,
	commanderPartnerRule,
	commanderPlaneswalkerRule,
	commanderRequiredRule,
	isValidCommanderType,
	signatureSpellRule,
} from "./commander";
export { companionRule } from "./companion";
export { commanderUncommonRule } from "./rarity";

import {
	anteCardRule,
	bannedRule,
	cardLegalityRule,
	conspiracyCardRule,
	deckSizeExactRule,
	deckSizeMinRule,
	illegalCardTypeRule,
	playsetRule,
	restrictedRule,
	sideboardSizeRule,
	singletonRule,
} from "./base";

import {
	colorIdentityRule,
	commanderLegendaryRule,
	commanderPartnerRule,
	commanderPlaneswalkerRule,
	commanderRequiredRule,
	signatureSpellRule,
} from "./commander";

import { companionRule } from "./companion";
import { commanderUncommonRule } from "./rarity";

/**
 * All available rules, keyed by rule ID.
 * Use `keyof typeof RULES` for typed rule IDs.
 */
export const RULES = {
	// Card pool rules
	cardLegality: cardLegalityRule,
	banned: bannedRule,
	restricted: restrictedRule,

	// Illegal card types
	conspiracyCard: conspiracyCardRule,
	illegalCardType: illegalCardTypeRule,
	anteCard: anteCardRule,

	// Copy limit rules
	singleton: singletonRule,
	playset: playsetRule,

	// Structure rules
	deckSizeMin: deckSizeMinRule,
	deckSizeExact: deckSizeExactRule,
	sideboardSize: sideboardSizeRule,

	// Commander rules
	colorIdentity: colorIdentityRule,
	commanderRequired: commanderRequiredRule,
	commanderPartner: commanderPartnerRule,
	commanderLegendary: commanderLegendaryRule,
	commanderUncommon: commanderUncommonRule,
	commanderPlaneswalker: commanderPlaneswalkerRule,
	signatureSpell: signatureSpellRule,

	// Companion rule (sideboard)
	companion: companionRule,
} as const;

export type RuleId = keyof typeof RULES;
