import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "@/lib/__tests__/test-card-lookup";
import type { Deck, DeckCard, Section } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import {
	anteCardRule,
	conspiracyCardRule,
	illegalCardTypeRule,
} from "../rules/base";
import type { ValidationContext } from "../types";

describe("illegal card type rules", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	function makeDeck(deckCards: DeckCard[], format = "commander"): Deck {
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
			config: { legalityField: "commander" },
		};
	}

	describe("conspiracyCardRule", () => {
		it("rejects conspiracy cards in constructed formats", async () => {
			const conspiracy = await cards.get("Adriana's Valor");
			const deck = makeDeck([makeCard(conspiracy, "mainboard")], "legacy");
			const ctx = makeContext(deck, [conspiracy]);
			const violations = conspiracyCardRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("Conspiracy");
		});
	});

	describe("illegalCardTypeRule (silver-border/acorn)", () => {
		it("rejects silver-bordered cards", async () => {
			const silverBorder = await cards.get("Alexander Clamilton");
			const deck = makeDeck([makeCard(silverBorder, "mainboard")]);
			const ctx = makeContext(deck, [silverBorder]);
			const violations = illegalCardTypeRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("silver");
		});

		it("rejects acorn-stamped cards", async () => {
			const acornCard = await cards.get("Aardwolf's Advantage");
			const deck = makeDeck([makeCard(acornCard, "mainboard")]);
			const ctx = makeContext(deck, [acornCard]);
			const violations = illegalCardTypeRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("acorn");
		});

		it("allows normal cards", async () => {
			const normalCard = await cards.get("Sol Ring");
			const deck = makeDeck([makeCard(normalCard, "mainboard")]);
			const ctx = makeContext(deck, [normalCard]);
			const violations = illegalCardTypeRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("anteCardRule", () => {
		it("rejects ante cards", async () => {
			const anteCard = await cards.get("Contract from Below");
			const deck = makeDeck([makeCard(anteCard, "mainboard")], "vintage");
			const ctx = makeContext(deck, [anteCard]);
			const violations = anteCardRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("ante");
		});
	});
});
