import { type DeckCard, getCardsInSection } from "@/lib/deck-types";
import type { Card } from "@/lib/scryfall-types";
import {
	asRuleNumber,
	type Rule,
	type ValidationContext,
	type Violation,
	violation,
} from "../types";
import { getOracleText, getTypeLine } from "../utils";

/**
 * Get cards in "starting deck" for companion purposes.
 * Per 702.139b, in Commander this includes the commander zone.
 */
function getStartingDeckCards(ctx: ValidationContext): DeckCard[] {
	const mainboard = getCardsInSection(ctx.deck, "mainboard");
	const commander = getCardsInSection(ctx.deck, "commander");
	return [...mainboard, ...commander];
}

/**
 * Companion rule - validates deck meets companion's deck-building restriction
 *
 * Companions go in sideboard. If a card has the Companion keyword,
 * the deck must satisfy its specific restriction.
 *
 * Rule 702.139: Companion is a keyword ability that imposes a deck-building
 * restriction on cards in your starting deck.
 */
export const companionRule: Rule<"companion"> = {
	id: "companion",
	rule: asRuleNumber("702.139a"),
	ruleText:
		"Companion is a keyword ability that functions outside the game. It's written as \"Companion—[Condition].\" Before the game begins, you may reveal one card you own from outside the game with a companion ability whose condition is fulfilled by your starting deck. (See rule 103.2b.) Once during the game, any time you have priority and the stack is empty, but only during a main phase of your turn, you may pay {3} and put that card into your hand. This is a special action that doesn't use the stack (see rule 116.2g). This is a change from previous rules.",
	category: "structure",
	description: "Deck must meet companion's deck-building restriction",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup } = ctx;
		const violations: Violation[] = [];

		const sideboard = getCardsInSection(deck, "sideboard");

		for (const entry of sideboard) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			const keywords = card.keywords?.map((k) => k.toLowerCase()) ?? [];
			if (!keywords.includes("companion")) continue;

			const companionViolations = validateCompanionRestriction(card, ctx);
			violations.push(...companionViolations);
		}

		return violations;
	},
};

function validateCompanionRestriction(
	companion: Card,
	ctx: ValidationContext,
): Violation[] {
	const name = companion.name.toLowerCase();

	if (name.includes("lurrus")) {
		return validateLurrus(companion, ctx);
	}
	if (name.includes("gyruda")) {
		return validateGyruda(companion, ctx);
	}
	if (name.includes("obosh")) {
		return validateObosh(companion, ctx);
	}
	if (name.includes("kaheera")) {
		return validateKaheera(companion, ctx);
	}
	if (name.includes("umori")) {
		return validateUmori(companion, ctx);
	}
	if (name.includes("jegantha")) {
		return validateJegantha(companion, ctx);
	}
	if (name.includes("keruga")) {
		return validateKeruga(companion, ctx);
	}
	if (name.includes("yorion")) {
		return validateYorion(companion, ctx);
	}
	if (name.includes("zirda")) {
		return validateZirda(companion, ctx);
	}
	if (name.includes("lutri")) {
		return validateLutri(companion, ctx);
	}

	return [];
}

function validateLurrus(_companion: Card, ctx: ValidationContext): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (!isPermanent(card)) continue;

		const mv = card.cmc ?? 0;
		if (mv > 2) {
			violations.push(
				violation(
					companionRule,
					`Lurrus companion requires all permanents to have mana value 2 or less, but ${card.name} has mana value ${mv}`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateGyruda(_companion: Card, ctx: ValidationContext): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (isLand(card)) continue;

		const mv = card.cmc ?? 0;
		if (mv % 2 !== 0) {
			violations.push(
				violation(
					companionRule,
					`Gyruda companion requires all nonland cards to have even mana value, but ${card.name} has mana value ${mv}`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateObosh(_companion: Card, ctx: ValidationContext): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (isLand(card)) continue;

		const mv = card.cmc ?? 0;
		if (mv % 2 === 0) {
			violations.push(
				violation(
					companionRule,
					`Obosh companion requires all nonland cards to have odd mana value, but ${card.name} has mana value ${mv}`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateKaheera(
	_companion: Card,
	ctx: ValidationContext,
): Violation[] {
	const { deck, cardLookup } = ctx;
	const violations: Violation[] = [];
	const mainboard = getCardsInSection(deck, "mainboard");

	const allowedTypes = ["cat", "elemental", "nightmare", "dinosaur", "beast"];

	for (const entry of mainboard) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		const typeLine = getTypeLine(card).toLowerCase();
		if (!typeLine.includes("creature")) continue;

		const hasAllowedType = allowedTypes.some((t) => typeLine.includes(t));
		if (!hasAllowedType) {
			violations.push(
				violation(
					companionRule,
					`Kaheera companion requires all creatures to be Cat, Elemental, Nightmare, Dinosaur, or Beast, but ${card.name} is not`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateUmori(_companion: Card, ctx: ValidationContext): Violation[] {
	const { deck, cardLookup } = ctx;
	const mainboard = getCardsInSection(deck, "mainboard");

	const cardTypes = [
		"creature",
		"artifact",
		"enchantment",
		"planeswalker",
		"instant",
		"sorcery",
	];
	const typePresent = new Set<string>();

	for (const entry of mainboard) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (isLand(card)) continue;

		const typeLine = getTypeLine(card).toLowerCase();
		for (const t of cardTypes) {
			if (typeLine.includes(t)) {
				typePresent.add(t);
			}
		}
	}

	if (typePresent.size > 1) {
		return [
			violation(
				companionRule,
				`Umori companion requires all nonland cards to share a card type, but deck has multiple types: ${[...typePresent].join(", ")}`,
				"error",
			),
		];
	}

	return [];
}

function validateJegantha(
	_companion: Card,
	ctx: ValidationContext,
): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		const manaCost = card.mana_cost ?? "";
		if (hasRepeatedManaSymbol(manaCost)) {
			violations.push(
				violation(
					companionRule,
					`Jegantha companion requires no card to have more than one of the same mana symbol, but ${card.name} has repeated symbols in ${manaCost}`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function hasRepeatedManaSymbol(manaCost: string): boolean {
	const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
	const counts = new Map<string, number>();

	for (const sym of symbols) {
		const normalized = sym.toLowerCase();
		if (normalized === "{x}") continue;
		const current = counts.get(normalized) ?? 0;
		counts.set(normalized, current + 1);
	}

	for (const count of counts.values()) {
		if (count > 1) return true;
	}

	return false;
}

function validateKeruga(_companion: Card, ctx: ValidationContext): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		const typeLine = getTypeLine(card).toLowerCase();
		const isCreatureOrPlaneswalker =
			typeLine.includes("creature") || typeLine.includes("planeswalker");

		if (!isCreatureOrPlaneswalker) continue;

		const mv = card.cmc ?? 0;
		if (mv < 3) {
			violations.push(
				violation(
					companionRule,
					`Keruga companion requires all creatures and planeswalkers to have mana value 3 or greater, but ${card.name} has mana value ${mv}`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateYorion(_companion: Card, ctx: ValidationContext): Violation[] {
	const { config } = ctx;
	const startingDeck = getStartingDeckCards(ctx);
	const startingDeckCount = startingDeck.reduce(
		(sum, c) => sum + c.quantity,
		0,
	);

	const minDeckSize = config.minDeckSize ?? config.deckSize ?? 60;
	const requiredSize = minDeckSize + 20;

	if (startingDeckCount < requiredSize) {
		return [
			violation(
				companionRule,
				`Yorion companion requires at least ${requiredSize} cards (20 more than minimum), but deck has ${startingDeckCount}`,
				"error",
			),
		];
	}

	return [];
}

function validateZirda(_companion: Card, ctx: ValidationContext): Violation[] {
	const { cardLookup } = ctx;
	const violations: Violation[] = [];
	const startingDeck = getStartingDeckCards(ctx);

	for (const entry of startingDeck) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (!isPermanent(card)) continue;

		const oracleText = getOracleText(card).toLowerCase();
		const hasActivatedAbility = /\{[^}]*\}.*:/.test(oracleText);

		if (!hasActivatedAbility) {
			violations.push(
				violation(
					companionRule,
					`Zirda companion requires all permanents to have an activated ability, but ${card.name} does not`,
					"error",
					{
						cardName: card.name,
						oracleId: entry.oracleId,
						section: entry.section === "commander" ? "commander" : "mainboard",
					},
				),
			);
		}
	}

	return violations;
}

function validateLutri(_companion: Card, ctx: ValidationContext): Violation[] {
	const { deck, cardLookup } = ctx;
	const mainboard = getCardsInSection(deck, "mainboard");

	const namesSeen = new Set<string>();
	const duplicates: string[] = [];

	for (const entry of mainboard) {
		const card = cardLookup(entry.scryfallId);
		if (!card) continue;

		if (isLand(card)) continue;

		if (entry.quantity > 1) {
			duplicates.push(card.name);
			continue;
		}

		if (namesSeen.has(card.name)) {
			duplicates.push(card.name);
		}
		namesSeen.add(card.name);
	}

	if (duplicates.length > 0) {
		return [
			violation(
				companionRule,
				`Lutri companion requires all nonland cards to have different names, but deck has duplicates: ${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? "..." : ""}`,
				"error",
			),
		];
	}

	return [];
}

function isPermanent(card: Card): boolean {
	const typeLine = getTypeLine(card).toLowerCase();
	return (
		typeLine.includes("creature") ||
		typeLine.includes("artifact") ||
		typeLine.includes("enchantment") ||
		typeLine.includes("planeswalker") ||
		typeLine.includes("land") ||
		typeLine.includes("battle")
	);
}

function isLand(card: Card): boolean {
	const typeLine = getTypeLine(card).toLowerCase();
	return typeLine.includes("land");
}
