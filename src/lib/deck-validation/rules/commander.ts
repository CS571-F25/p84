import { getCardsInSection, isKnownSection } from "@/lib/deck-types";
import type { Card } from "@/lib/scryfall-types";
import {
	asRuleNumber,
	type Rule,
	type ValidationContext,
	type Violation,
	violation,
} from "../types";

/**
 * Commander required - at least one commander
 */
export const commanderRequiredRule: Rule<"commanderRequired"> = {
	id: "commanderRequired",
	rule: asRuleNumber("903.3"),
	category: "structure",
	description: "Deck must have at least one commander",
	validate(ctx: ValidationContext): Violation[] {
		const { deck } = ctx;
		const commanders = getCardsInSection(deck, "commander");
		const commanderCount = commanders.reduce((sum, c) => sum + c.quantity, 0);

		if (commanderCount === 0) {
			return [violation(this, "Deck must have a commander", "error")];
		}

		return [];
	},
};

/**
 * Commander must be legendary creature (or planeswalker with "can be your commander")
 */
export const commanderLegendaryRule: Rule<"commanderLegendary"> = {
	id: "commanderLegendary",
	rule: asRuleNumber("903.3"),
	category: "structure",
	description: "Commander must be a legendary creature",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];
		const commanders = getCardsInSection(deck, "commander");

		for (const entry of commanders) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const typeLine = getTypeLine(card).toLowerCase();
			const oracleText = getOracleText(card).toLowerCase();

			const isLegendaryCreature =
				typeLine.includes("legendary") && typeLine.includes("creature");
			const canBeCommander = oracleText.includes("can be your commander");

			if (!isLegendaryCreature && !canBeCommander) {
				violations.push(
					violation(this, `${card.name} is not a legendary creature`, "error", {
						cardName: card.name,
						oracleId: entry.oracleId,
						section: "commander",
					}),
				);
			}
		}

		return violations;
	},
};

/**
 * Partner rule - validates commander pairing is legal
 *
 * Legal pairings:
 * - Both have generic "Partner" (not "Partner with X")
 * - Both have "Friends forever"
 * - One has "Partner with [NAME]" and the other is that NAME
 * - One has "Choose a Background" and other is a Background enchantment
 */
export const commanderPartnerRule: Rule<"commanderPartner"> = {
	id: "commanderPartner",
	rule: asRuleNumber("702.124"),
	category: "structure",
	description: "Multiple commanders must have valid partner pairing",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const commanders = getCardsInSection(deck, "commander");

		// Expand commanders by quantity
		const commanderCards: Card[] = [];
		for (const entry of commanders) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;
			for (let i = 0; i < entry.quantity; i++) {
				commanderCards.push(card);
			}
		}

		if (commanderCards.length <= 1) return [];

		if (commanderCards.length > 2) {
			return [
				violation(
					this,
					`Deck has ${commanderCards.length} commanders, maximum is 2`,
					"error",
				),
			];
		}

		const [card1, card2] = commanderCards;
		const pairingResult = validatePairing(card1, card2);

		if (!pairingResult.valid) {
			return [
				violation(
					this,
					`${card1.name} and ${card2.name} cannot be paired: ${pairingResult.reason}`,
					"error",
				),
			];
		}

		return [];
	},
};

/**
 * Validate if two cards can legally be paired as commanders
 */
function validatePairing(
	card1: Card,
	card2: Card,
): { valid: true } | { valid: false; reason: string } {
	const info1 = getPartnerInfo(card1);
	const info2 = getPartnerInfo(card2);

	// Generic partner: both must have it
	if (info1.hasGenericPartner && info2.hasGenericPartner) {
		return { valid: true };
	}

	// Friends forever: both must have it
	if (info1.hasFriendsForever && info2.hasFriendsForever) {
		return { valid: true };
	}

	// Partner with: check if they name each other (case-insensitive)
	if (
		info1.partnerWithName &&
		info1.partnerWithName.toLowerCase() === card2.name.toLowerCase()
	) {
		return { valid: true };
	}
	if (
		info2.partnerWithName &&
		info2.partnerWithName.toLowerCase() === card1.name.toLowerCase()
	) {
		return { valid: true };
	}

	// Background pairing: one chooses background, other is background
	if (info1.choosesBackground && info2.isBackground) {
		return { valid: true };
	}
	if (info2.choosesBackground && info1.isBackground) {
		return { valid: true };
	}

	// Doctor's companion: can pair with a Doctor (Time Lord Doctor creature)
	if (info1.hasDoctorsCompanion && isDoctor(card2)) {
		return { valid: true };
	}
	if (info2.hasDoctorsCompanion && isDoctor(card1)) {
		return { valid: true };
	}

	// No valid pairing found
	const getAbilityName = (info: PartnerInfo): string => {
		if (info.hasGenericPartner) return "Partner";
		if (info.hasFriendsForever) return "Friends forever";
		if (info.partnerWithName) return `Partner with ${info.partnerWithName}`;
		if (info.choosesBackground) return "Choose a Background";
		if (info.isBackground) return "Background";
		if (info.hasDoctorsCompanion) return "Doctor's companion";
		return "no partner ability";
	};

	return {
		valid: false,
		reason: `${getAbilityName(info1)} cannot pair with ${getAbilityName(info2)}`,
	};
}

interface PartnerInfo {
	hasGenericPartner: boolean;
	hasFriendsForever: boolean;
	partnerWithName: string | null;
	choosesBackground: boolean;
	isBackground: boolean;
	hasDoctorsCompanion: boolean;
}

function getPartnerInfo(card: Card): PartnerInfo {
	const oracleText = getOracleText(card).toLowerCase();
	const typeLine = getTypeLine(card).toLowerCase();
	const keywords = card.keywords?.map((k) => k.toLowerCase()) ?? [];

	// Check for "Partner with [Name]" pattern - extract the name
	const partnerWithMatch = oracleText.match(/partner with ([^(]+)\s*\(/i);
	const partnerWithName = partnerWithMatch ? partnerWithMatch[1].trim() : null;

	// Generic partner has "Partner" keyword but NOT "Partner with X" in oracle text
	const hasPartnerKeyword = keywords.includes("partner");
	const hasGenericPartner = hasPartnerKeyword && !partnerWithName;

	return {
		hasGenericPartner,
		hasFriendsForever: keywords.includes("friends forever"),
		partnerWithName,
		choosesBackground: oracleText.includes("choose a background"),
		isBackground: typeLine.includes("background"),
		hasDoctorsCompanion: keywords.includes("doctor's companion"),
	};
}

function isDoctor(card: Card): boolean {
	const typeLine = getTypeLine(card).toLowerCase();
	return typeLine.includes("time lord") && typeLine.includes("doctor");
}

/**
 * Color identity - all cards must match commander's color identity
 * Errors for main deck, warnings for maybeboard
 */
export const colorIdentityRule: Rule<"colorIdentity"> = {
	id: "colorIdentity",
	rule: asRuleNumber("903.4"),
	category: "identity",
	description: "Cards must match commander color identity",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup, commanderColors } = ctx;

		if (!commanderColors) return [];

		const violations: Violation[] = [];
		const allowedColors = new Set<string>(commanderColors);

		for (const entry of deck.cards) {
			if (entry.section === "commander") continue;

			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const cardIdentity = card.color_identity ?? [];
			const invalidColors = cardIdentity.filter((c) => !allowedColors.has(c));

			if (invalidColors.length > 0) {
				const commanderStr =
					commanderColors.length > 0 ? commanderColors.join("") : "colorless";
				const severity = entry.section === "maybeboard" ? "warning" : "error";

				violations.push(
					violation(
						this,
						`${card.name} has colors outside commander identity (${invalidColors.join("")} not in ${commanderStr})`,
						severity,
						{
							cardName: card.name,
							oracleId: entry.oracleId,
							section: isKnownSection(entry.section)
								? entry.section
								: undefined,
						},
					),
				);
			}
		}

		return violations;
	},
};

/**
 * Commander must be a planeswalker (Oathbreaker)
 */
export const commanderPlaneswalkerRule: Rule<"commanderPlaneswalker"> = {
	id: "commanderPlaneswalker",
	rule: asRuleNumber("903.3"),
	category: "structure",
	description: "Commander must be a planeswalker (Oathbreaker)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];
		const commanders = getCardsInSection(deck, "commander");

		for (const entry of commanders) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const typeLine = getTypeLine(card).toLowerCase();

			// Skip signature spell (instant/sorcery) - that's validated separately
			if (typeLine.includes("instant") || typeLine.includes("sorcery")) {
				continue;
			}

			if (!typeLine.includes("planeswalker")) {
				violations.push(
					violation(this, `${card.name} is not a planeswalker`, "error", {
						cardName: card.name,
						oracleId: entry.oracleId,
						section: "commander",
					}),
				);
			}
		}

		return violations;
	},
};

/**
 * Signature spell requirement (Oathbreaker)
 * Commander section must have exactly one instant or sorcery
 */
export const signatureSpellRule: Rule<"signatureSpell"> = {
	id: "signatureSpell",
	rule: asRuleNumber("903.3"),
	category: "structure",
	description:
		"Oathbreaker requires exactly one signature spell (instant/sorcery)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const commanders = getCardsInSection(deck, "commander");

		let signatureSpellCount = 0;

		for (const entry of commanders) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const typeLine = getTypeLine(card).toLowerCase();
			if (typeLine.includes("instant") || typeLine.includes("sorcery")) {
				signatureSpellCount += entry.quantity;
			}
		}

		if (signatureSpellCount === 0) {
			return [
				violation(
					this,
					"Oathbreaker deck must have a signature spell (instant/sorcery in commander zone)",
					"error",
				),
			];
		}

		if (signatureSpellCount > 1) {
			return [
				violation(
					this,
					`Oathbreaker deck can only have 1 signature spell, found ${signatureSpellCount}`,
					"error",
				),
			];
		}

		return [];
	},
};

/**
 * Get combined oracle text from card, including all faces for DFCs
 */
function getOracleText(card: Card): string {
	if (card.oracle_text) {
		return card.oracle_text;
	}

	if (card.card_faces) {
		return card.card_faces.map((face) => face.oracle_text ?? "").join("\n");
	}

	return "";
}

/**
 * Get type line from card, including all faces for DFCs
 */
function getTypeLine(card: Card): string {
	if (card.type_line) {
		return card.type_line;
	}

	if (card.card_faces) {
		return card.card_faces.map((face) => face.type_line ?? "").join(" // ");
	}

	return "";
}
