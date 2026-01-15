import { getCardsInSection, isKnownSection } from "@/lib/deck-types";
import type { OracleId } from "@/lib/scryfall-types";
import { getCopyLimit } from "../exceptions";
import {
	asRuleNumber,
	type Rule,
	type ValidationContext,
	type Violation,
	violation,
} from "../types";

/**
 * Check card legality via Scryfall's legalities field
 */
export const cardLegalityRule: Rule<"cardLegality"> = {
	id: "cardLegality",
	rule: asRuleNumber("100.2a"),
	category: "legality",
	description: "Card must be legal in format",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup, config } = ctx;
		const violations: Violation[] = [];
		const field = config.legalityField;

		for (const entry of deck.cards) {
			if (entry.section === "maybeboard") continue;

			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const legality = card.legalities?.[field];
			if (legality === "not_legal") {
				violations.push(
					violation(this, `${card.name} is not legal in ${field}`, "error", {
						cardName: card.name,
						oracleId: entry.oracleId,
						section: isKnownSection(entry.section) ? entry.section : undefined,
					}),
				);
			}
		}

		return violations;
	},
};

/**
 * Check for banned cards
 */
export const bannedRule: Rule<"banned"> = {
	id: "banned",
	rule: asRuleNumber("100.6a"),
	category: "legality",
	description: "Card is banned in format",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup, config } = ctx;
		const violations: Violation[] = [];
		const field = config.legalityField;

		for (const entry of deck.cards) {
			if (entry.section === "maybeboard") continue;

			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const legality = card.legalities?.[field];
			if (legality === "banned") {
				violations.push(
					violation(this, `${card.name} is banned in ${field}`, "error", {
						cardName: card.name,
						oracleId: entry.oracleId,
						section: isKnownSection(entry.section) ? entry.section : undefined,
					}),
				);
			}
		}

		return violations;
	},
};

/**
 * Check for restricted cards (Vintage - max 1 copy)
 */
export const restrictedRule: Rule<"restricted"> = {
	id: "restricted",
	rule: asRuleNumber("100.6b"),
	category: "quantity",
	description: "Restricted cards limited to 1 copy",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, oracleLookup, config } = ctx;
		const violations: Violation[] = [];
		const field = config.legalityField;

		const oracleCounts = new Map<OracleId, number>();

		for (const entry of deck.cards) {
			if (entry.section === "maybeboard") continue;

			const current = oracleCounts.get(entry.oracleId) ?? 0;
			oracleCounts.set(entry.oracleId, current + entry.quantity);
		}

		for (const [oracleId, count] of oracleCounts) {
			if (count <= 1) continue;

			const card = oracleLookup(oracleId);
			if (!card) continue;

			const legality = card.legalities?.[field];
			if (legality === "restricted") {
				violations.push(
					violation(
						this,
						`${card.name} is restricted to 1 copy, deck has ${count}`,
						"error",
						{
							cardName: card.name,
							oracleId: card.oracle_id,
							quantity: count,
						},
					),
				);
			}
		}

		return violations;
	},
};

/**
 * Singleton rule - max 1 copy (Commander variants)
 */
export const singletonRule: Rule<"singleton"> = {
	id: "singleton",
	rule: asRuleNumber("903.5b"),
	category: "quantity",
	description: "Maximum 1 copy of each card (except basics and exceptions)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, oracleLookup } = ctx;
		const violations: Violation[] = [];

		const oracleCounts = new Map<OracleId, number>();

		for (const entry of deck.cards) {
			if (entry.section === "maybeboard") continue;

			const current = oracleCounts.get(entry.oracleId) ?? 0;
			oracleCounts.set(entry.oracleId, current + entry.quantity);
		}

		for (const [oracleId, count] of oracleCounts) {
			const card = oracleLookup(oracleId);
			if (!card) continue;

			const limit = getCopyLimit(card, 1);
			if (count > limit) {
				violations.push(
					violation(
						this,
						`${card.name} exceeds singleton limit (${count}/${limit})`,
						"error",
						{
							cardName: card.name,
							oracleId: card.oracle_id,
							quantity: count,
						},
					),
				);
			}
		}

		return violations;
	},
};

/**
 * Playset rule - max 4 copies (60-card formats)
 */
export const playsetRule: Rule<"playset"> = {
	id: "playset",
	rule: asRuleNumber("100.2a"),
	category: "quantity",
	description: "Maximum 4 copies of each card (except basics and exceptions)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, oracleLookup } = ctx;
		const violations: Violation[] = [];

		const oracleCounts = new Map<OracleId, number>();

		for (const entry of deck.cards) {
			if (entry.section === "maybeboard") continue;

			const current = oracleCounts.get(entry.oracleId) ?? 0;
			oracleCounts.set(entry.oracleId, current + entry.quantity);
		}

		for (const [oracleId, count] of oracleCounts) {
			const card = oracleLookup(oracleId);
			if (!card) continue;

			const limit = getCopyLimit(card, 4);
			if (count > limit) {
				violations.push(
					violation(
						this,
						`${card.name} exceeds playset limit (${count}/${limit})`,
						"error",
						{
							cardName: card.name,
							oracleId: card.oracle_id,
							quantity: count,
						},
					),
				);
			}
		}

		return violations;
	},
};

/**
 * Minimum deck size (60-card formats)
 */
export const deckSizeMinRule: Rule<"deckSizeMin"> = {
	id: "deckSizeMin",
	rule: asRuleNumber("100.2a"),
	category: "structure",
	description: "Deck must meet minimum size",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, config } = ctx;
		const minDeckSize = config.minDeckSize;

		if (minDeckSize === undefined) return [];

		const mainboard = getCardsInSection(deck, "mainboard");
		const mainboardCount = mainboard.reduce((sum, c) => sum + c.quantity, 0);

		if (mainboardCount < minDeckSize) {
			return [
				violation(
					this,
					`Deck has ${mainboardCount} cards, minimum is ${minDeckSize}`,
					"error",
				),
			];
		}

		return [];
	},
};

/**
 * Exact deck size (Commander = 100)
 */
export const deckSizeExactRule: Rule<"deckSizeExact"> = {
	id: "deckSizeExact",
	rule: asRuleNumber("903.5a"),
	category: "structure",
	description: "Deck must be exactly the specified size",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, config } = ctx;
		const deckSize = config.deckSize;

		if (deckSize === undefined) return [];

		const commander = getCardsInSection(deck, "commander");
		const mainboard = getCardsInSection(deck, "mainboard");

		const commanderCount = commander.reduce((sum, c) => sum + c.quantity, 0);
		const mainboardCount = mainboard.reduce((sum, c) => sum + c.quantity, 0);
		const totalCount = commanderCount + mainboardCount;

		if (totalCount !== deckSize) {
			return [
				violation(
					this,
					`Deck has ${totalCount} cards, must be exactly ${deckSize}`,
					"error",
				),
			];
		}

		return [];
	},
};

/**
 * Sideboard size limit
 */
export const sideboardSizeRule: Rule<"sideboardSize"> = {
	id: "sideboardSize",
	rule: asRuleNumber("100.4a"),
	category: "structure",
	description: "Sideboard cannot exceed maximum size",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, config } = ctx;
		const sideboardSize = config.sideboardSize;

		if (sideboardSize === undefined) return [];

		const sideboard = getCardsInSection(deck, "sideboard");
		const sideboardCount = sideboard.reduce((sum, c) => sum + c.quantity, 0);

		if (sideboardCount > sideboardSize) {
			return [
				violation(
					this,
					`Sideboard has ${sideboardCount} cards, maximum is ${sideboardSize}`,
					"error",
				),
			];
		}

		return [];
	},
};

/**
 * Conspiracy cards are only legal in Conspiracy Draft
 */
export const conspiracyCardRule: Rule<"conspiracyCard"> = {
	id: "conspiracyCard",
	rule: asRuleNumber("905.2"),
	category: "legality",
	description: "Conspiracy cards are not legal in constructed formats",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];

		for (const entry of deck.cards) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const typeLine = card.type_line?.toLowerCase() ?? "";
			if (typeLine.includes("conspiracy")) {
				violations.push(
					violation(
						this,
						`${card.name} is a Conspiracy card and not legal in constructed formats`,
						"error",
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
 * Silver-bordered and acorn-stamped cards are not tournament legal
 */
export const illegalCardTypeRule: Rule<"illegalCardType"> = {
	id: "illegalCardType",
	rule: asRuleNumber("100.2a"),
	category: "legality",
	description: "Silver-bordered and acorn cards are not tournament legal",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];

		for (const entry of deck.cards) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			if (card.border_color === "silver") {
				violations.push(
					violation(
						this,
						`${card.name} is a silver-bordered card and not tournament legal`,
						"error",
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

			if (card.security_stamp === "acorn") {
				violations.push(
					violation(
						this,
						`${card.name} is an acorn card and not tournament legal`,
						"error",
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
 * Ante cards are banned in all sanctioned formats
 */
export const anteCardRule: Rule<"anteCard"> = {
	id: "anteCard",
	rule: asRuleNumber("100.6a"),
	category: "legality",
	description: "Ante cards are banned in all sanctioned formats",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];

		for (const entry of deck.cards) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const oracleText = card.oracle_text?.toLowerCase() ?? "";
			if (oracleText.includes("playing for ante")) {
				violations.push(
					violation(
						this,
						`${card.name} is an ante card and banned in all sanctioned formats`,
						"error",
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
