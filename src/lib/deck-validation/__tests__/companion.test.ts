import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "@/lib/__tests__/test-card-lookup";
import type { Deck, DeckCard, Section } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { companionRule } from "../rules/base";
import type { ValidationContext } from "../types";

describe("companion rules", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	function makeDeck(deckCards: DeckCard[], format = "modern"): Deck {
		return {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format,
			cards: deckCards,
			createdAt: new Date().toISOString(),
		};
	}

	function makeCard(card: Card, section: Section, quantity = 1): DeckCard {
		return {
			scryfallId: card.id,
			oracleId: card.oracle_id,
			section,
			quantity,
			tags: [],
		};
	}

	function makeContext(deck: Deck, cardList: Card[]): ValidationContext {
		const cardMap = new Map<ScryfallId, Card>();
		const oracleMap = new Map<OracleId, Card>();

		for (const card of cardList) {
			cardMap.set(card.id, card);
			oracleMap.set(card.oracle_id, card);
		}

		return {
			deck,
			cardLookup: (id) => cardMap.get(id),
			oracleLookup: (id) => oracleMap.get(id),
			getPrintings: () => [],
			format: deck.format,
			commanderColors: undefined,
			config: { legalityField: "modern" },
		};
	}

	describe("Lurrus of the Dream-Den", () => {
		it("rejects deck with permanents over 2 mana value", async () => {
			const lurrus = await cards.get("Lurrus of the Dream-Den");
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([
				makeCard(lurrus, "sideboard"),
				makeCard(selvala, "mainboard"),
			]);
			const ctx = makeContext(deck, [lurrus, selvala]);
			const violations = companionRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("Lurrus");
			expect(violations[0].message).toContain("mana value");
		});

		it("allows deck with only low mana value permanents", async () => {
			const lurrus = await cards.get("Lurrus of the Dream-Den");
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([
				makeCard(lurrus, "sideboard"),
				makeCard(solRing, "mainboard"),
			]);
			const ctx = makeContext(deck, [lurrus, solRing]);
			const violations = companionRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});
});
