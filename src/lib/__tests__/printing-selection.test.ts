import { describe, expect, it, vi } from "vitest";
import type { CardDataProvider } from "../card-data-provider";
import type { Deck } from "../deck-types";
import {
	findAllCanonicalPrintings,
	findAllCheapestPrintings,
	findCheapestPrinting,
	getCheapestPrice,
	updateDeckPrintings,
} from "../printing-selection";
import type {
	Card,
	OracleId,
	ScryfallId,
	VolatileData,
} from "../scryfall-types";
import { asOracleId, asScryfallId } from "../scryfall-types";

function mockVolatileData(overrides: Partial<VolatileData> = {}): VolatileData {
	return {
		edhrecRank: null,
		usd: null,
		usdFoil: null,
		usdEtched: null,
		eur: null,
		eurFoil: null,
		tix: null,
		...overrides,
	};
}

function mockDeck(
	cards: Array<{
		scryfallId: ScryfallId;
		oracleId?: OracleId;
		section?: "mainboard" | "sideboard" | "commander" | "maybeboard";
	}>,
): Deck {
	return {
		$type: "com.deckbelcher.deck.list",
		name: "Test Deck",
		format: "commander",
		cards: cards.map((c) => ({
			scryfallId: c.scryfallId,
			oracleId:
				c.oracleId ?? asOracleId("00000000-0000-0000-0000-000000000000"),
			quantity: 1,
			section: c.section ?? "mainboard",
			tags: [],
		})),
		createdAt: new Date().toISOString(),
	};
}

describe("getCheapestPrice", () => {
	it("returns usd when it's the only price", () => {
		const v = mockVolatileData({ usd: 1.5 });
		expect(getCheapestPrice(v)).toBe(1.5);
	});

	it("returns cheapest among usd/foil/etched", () => {
		const v = mockVolatileData({ usd: 2.0, usdFoil: 1.5, usdEtched: 3.0 });
		expect(getCheapestPrice(v)).toBe(1.5);
	});

	it("returns null when all prices are null", () => {
		const v = mockVolatileData();
		expect(getCheapestPrice(v)).toBeNull();
	});

	it("ignores null values in comparison", () => {
		const v = mockVolatileData({ usdFoil: 5.0 });
		expect(getCheapestPrice(v)).toBe(5.0);
	});

	it("returns etched price when it's cheapest", () => {
		const v = mockVolatileData({ usd: 10.0, usdFoil: 15.0, usdEtched: 5.0 });
		expect(getCheapestPrice(v)).toBe(5.0);
	});

	it("handles zero price correctly", () => {
		const v = mockVolatileData({ usd: 0, usdFoil: 1.0 });
		expect(getCheapestPrice(v)).toBe(0);
	});
});

describe("findCheapestPrinting", () => {
	const id1 = asScryfallId("00000000-0000-0000-0000-000000000001");
	const id2 = asScryfallId("00000000-0000-0000-0000-000000000002");
	const id3 = asScryfallId("00000000-0000-0000-0000-000000000003");

	it("returns printing with lowest price", () => {
		const volatileData = new Map<ScryfallId, VolatileData | null>([
			[id1, mockVolatileData({ usd: 5.0 })],
			[id2, mockVolatileData({ usd: 1.0 })],
			[id3, mockVolatileData({ usd: 3.0 })],
		]);
		expect(findCheapestPrinting([id1, id2, id3], volatileData)).toBe(id2);
	});

	it("considers foil prices", () => {
		const volatileData = new Map<ScryfallId, VolatileData | null>([
			[id1, mockVolatileData({ usd: 5.0 })],
			[id2, mockVolatileData({ usdFoil: 0.5 })],
		]);
		expect(findCheapestPrinting([id1, id2], volatileData)).toBe(id2);
	});

	it("returns null when no prices available", () => {
		const volatileData = new Map<ScryfallId, VolatileData | null>([
			[id1, mockVolatileData()],
		]);
		expect(findCheapestPrinting([id1], volatileData)).toBeNull();
	});

	it("returns null for empty printing list", () => {
		expect(findCheapestPrinting([], new Map())).toBeNull();
	});

	it("skips printings with null volatile data", () => {
		const volatileData = new Map<ScryfallId, VolatileData | null>([
			[id1, null],
			[id2, mockVolatileData({ usd: 2.0 })],
		]);
		expect(findCheapestPrinting([id1, id2], volatileData)).toBe(id2);
	});

	it("skips printings not in volatile data map", () => {
		const volatileData = new Map<ScryfallId, VolatileData | null>([
			[id2, mockVolatileData({ usd: 2.0 })],
		]);
		expect(findCheapestPrinting([id1, id2], volatileData)).toBe(id2);
	});
});

describe("updateDeckPrintings", () => {
	const oldId = asScryfallId("00000000-0000-0000-0000-000000000001");
	const newId = asScryfallId("00000000-0000-0000-0000-000000000002");
	const keepId = asScryfallId("00000000-0000-0000-0000-000000000003");

	it("updates scryfallIds based on mapping", () => {
		const deck = mockDeck([{ scryfallId: oldId }]);
		const updates = new Map([[oldId, newId]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0].scryfallId).toBe(newId);
	});

	it("preserves cards not in update map", () => {
		const deck = mockDeck([{ scryfallId: keepId }]);
		const result = updateDeckPrintings(deck, new Map());

		expect(result.cards[0].scryfallId).toBe(keepId);
	});

	it("handles empty deck", () => {
		const deck = mockDeck([]);
		const result = updateDeckPrintings(deck, new Map());

		expect(result.cards).toEqual([]);
	});

	it("updates only cards in the map", () => {
		const deck = mockDeck([{ scryfallId: oldId }, { scryfallId: keepId }]);
		const updates = new Map([[oldId, newId]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0].scryfallId).toBe(newId);
		expect(result.cards[1].scryfallId).toBe(keepId);
	});

	it("preserves other card properties", () => {
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "commander",
			cards: [
				{
					scryfallId: oldId,
					oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
					quantity: 4,
					section: "sideboard",
					tags: ["removal", "instant"],
				},
			],
			createdAt: new Date().toISOString(),
		};
		const updates = new Map([[oldId, newId]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0]).toEqual({
			scryfallId: newId,
			oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
			quantity: 4,
			section: "sideboard",
			tags: ["removal", "instant"],
		});
	});

	it("returns same deck reference when no updates", () => {
		const deck = mockDeck([{ scryfallId: keepId }]);
		const result = updateDeckPrintings(deck, new Map());

		expect(result).toBe(deck);
	});

	it("sets updatedAt when changes are made", () => {
		const deck = mockDeck([{ scryfallId: oldId }]);
		const originalUpdatedAt = deck.updatedAt;
		const updates = new Map([[oldId, newId]]);

		const result = updateDeckPrintings(deck, updates);

		expect(result.updatedAt).not.toBe(originalUpdatedAt);
	});
});

describe("findAllCheapestPrintings", () => {
	const oracle1 = asOracleId("11111111-1111-1111-1111-111111111111");
	const oracle2 = asOracleId("22222222-2222-2222-2222-222222222222");

	const card1a = asScryfallId("1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a");
	const card1b = asScryfallId("1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b");
	const card2a = asScryfallId("2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a");

	function mockProvider(config: {
		cards: Record<string, { oracle_id: OracleId }>;
		printings: Record<string, ScryfallId[]>;
		volatileData: Record<string, VolatileData | null>;
		canonical?: Record<string, ScryfallId>;
	}): CardDataProvider {
		return {
			getCardById: vi.fn(async (id: ScryfallId) => {
				const data = config.cards[id];
				if (!data) return undefined;
				return { id, oracle_id: data.oracle_id, name: "Test Card" } as Card;
			}),
			getPrintingsByOracleId: vi.fn(
				async (oracleId: OracleId) => config.printings[oracleId] ?? [],
			),
			getVolatileData: vi.fn(
				async (id: ScryfallId) => config.volatileData[id] ?? null,
			),
			getCanonicalPrinting: vi.fn(
				async (oracleId: OracleId) => config.canonical?.[oracleId],
			),
			getMetadata: vi.fn(async () => ({ version: "test", cardCount: 100 })),
		};
	}

	it("finds cheapest printing for each card", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			printings: {
				[oracle1]: [card1a, card1b],
			},
			volatileData: {
				[card1a]: mockVolatileData({ usd: 10.0 }),
				[card1b]: mockVolatileData({ usd: 2.0 }),
			},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCheapestPrintings(deck, provider);

		expect(updates.get(card1a)).toBe(card1b);
	});

	it("skips cards already at cheapest", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			printings: {
				[oracle1]: [card1a, card1b],
			},
			volatileData: {
				[card1a]: mockVolatileData({ usd: 1.0 }),
				[card1b]: mockVolatileData({ usd: 10.0 }),
			},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCheapestPrintings(deck, provider);

		expect(updates.size).toBe(0);
	});

	it("handles multiple cards with same oracle", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
				[card1b]: { oracle_id: oracle1 },
			},
			printings: {
				[oracle1]: [card1a, card1b],
			},
			volatileData: {
				[card1a]: mockVolatileData({ usd: 10.0 }),
				[card1b]: mockVolatileData({ usd: 2.0 }),
			},
		});

		const deck = mockDeck([
			{ scryfallId: card1a, oracleId: oracle1 },
			{ scryfallId: card1a, oracleId: oracle1, section: "sideboard" },
		]);
		const updates = await findAllCheapestPrintings(deck, provider);

		expect(updates.get(card1a)).toBe(card1b);
	});

	it("handles cards with no price data", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			printings: {
				[oracle1]: [card1a, card1b],
			},
			volatileData: {
				[card1a]: mockVolatileData(),
				[card1b]: mockVolatileData(),
			},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCheapestPrintings(deck, provider);

		expect(updates.size).toBe(0);
	});

	it("handles multiple different cards", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
				[card2a]: { oracle_id: oracle2 },
			},
			printings: {
				[oracle1]: [card1a, card1b],
				[oracle2]: [card2a],
			},
			volatileData: {
				[card1a]: mockVolatileData({ usd: 10.0 }),
				[card1b]: mockVolatileData({ usd: 2.0 }),
				[card2a]: mockVolatileData({ usd: 5.0 }),
			},
		});

		const deck = mockDeck([
			{ scryfallId: card1a, oracleId: oracle1 },
			{ scryfallId: card2a, oracleId: oracle2 },
		]);
		const updates = await findAllCheapestPrintings(deck, provider);

		expect(updates.get(card1a)).toBe(card1b);
		expect(updates.has(card2a)).toBe(false);
	});
});

describe("findAllCheapestPrintings edge cases", () => {
	const oracle1 = asOracleId("11111111-1111-1111-1111-111111111111");

	const cardExpensive = asScryfallId("eeee-eeee-eeee-eeee-eeeeeeeeeeee");
	const cardCheap = asScryfallId("cccc-cccc-cccc-cccc-cccccccccccc");
	const cardMid = asScryfallId("mmmm-mmmm-mmmm-mmmm-mmmmmmmmmmmm");

	function mockProvider(): CardDataProvider {
		return {
			getCardById: vi.fn(async (id: ScryfallId) => {
				// All cards have the same oracle_id
				return { id, oracle_id: oracle1, name: "Lightning Bolt" } as Card;
			}),
			getPrintingsByOracleId: vi.fn(async () => [
				cardExpensive,
				cardCheap,
				cardMid,
			]),
			getVolatileData: vi.fn(async (id: ScryfallId) => {
				if (id === cardExpensive) return mockVolatileData({ usd: 100.0 });
				if (id === cardCheap) return mockVolatileData({ usd: 0.25 });
				if (id === cardMid) return mockVolatileData({ usd: 5.0 });
				return null;
			}),
			getCanonicalPrinting: vi.fn(async () => cardExpensive),
			getMetadata: vi.fn(async () => ({ version: "test", cardCount: 100 })),
		};
	}

	it("updates multiple cards with different printings of same oracle to same cheapest", async () => {
		const provider = mockProvider();
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				// Same oracle, different printings in same section
				{
					scryfallId: cardExpensive,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: [],
				},
				{
					scryfallId: cardMid,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: ["burn"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = await findAllCheapestPrintings(deck, provider);

		// Both should update to the cheapest
		expect(updates.get(cardExpensive)).toBe(cardCheap);
		expect(updates.get(cardMid)).toBe(cardCheap);
	});

	it("handles same card in different sections with different printings", async () => {
		const provider = mockProvider();
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: cardExpensive,
					oracleId: oracle1,
					quantity: 4,
					section: "mainboard",
					tags: [],
				},
				{
					scryfallId: cardMid,
					oracleId: oracle1,
					quantity: 2,
					section: "sideboard",
					tags: ["sb"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = await findAllCheapestPrintings(deck, provider);

		// Both should update to cheapest
		expect(updates.get(cardExpensive)).toBe(cardCheap);
		expect(updates.get(cardMid)).toBe(cardCheap);
	});

	it("handles same printing in same section with different tag entries", async () => {
		const provider = mockProvider();
		// Note: This is technically invalid deck state (same scryfallId+section twice)
		// but we should handle it gracefully
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: cardExpensive,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: ["burn"],
				},
				{
					scryfallId: cardExpensive,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: ["removal"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = await findAllCheapestPrintings(deck, provider);

		// Both entries should get the update mapping
		expect(updates.get(cardExpensive)).toBe(cardCheap);
	});

	it("preserves card already at cheapest among mixed printings", async () => {
		const provider = mockProvider();
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: cardCheap,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: [],
				},
				{
					scryfallId: cardExpensive,
					oracleId: oracle1,
					quantity: 2,
					section: "mainboard",
					tags: [],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = await findAllCheapestPrintings(deck, provider);

		// cardCheap should NOT be in updates (it's already cheapest)
		expect(updates.has(cardCheap)).toBe(false);
		// cardExpensive should update to cardCheap
		expect(updates.get(cardExpensive)).toBe(cardCheap);
	});
});

describe("updateDeckPrintings edge cases", () => {
	const oldPrinting = asScryfallId("oooo-oooo-oooo-oooo-oooooooooooo");
	const newPrinting = asScryfallId("nnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn");

	it("updates all instances of a printing regardless of section", () => {
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: oldPrinting,
					oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
					quantity: 4,
					section: "mainboard",
					tags: [],
				},
				{
					scryfallId: oldPrinting,
					oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
					quantity: 2,
					section: "sideboard",
					tags: ["sb"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = new Map([[oldPrinting, newPrinting]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0].scryfallId).toBe(newPrinting);
		expect(result.cards[1].scryfallId).toBe(newPrinting);
	});

	it("preserves tags when updating printings", () => {
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: oldPrinting,
					oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
					quantity: 4,
					section: "mainboard",
					tags: ["burn", "instant"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = new Map([[oldPrinting, newPrinting]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0].tags).toEqual(["burn", "instant"]);
	});

	it("preserves quantity when updating printings", () => {
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: oldPrinting,
					oracleId: asOracleId("00000000-0000-0000-0000-000000000000"),
					quantity: 4,
					section: "mainboard",
					tags: [],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = new Map([[oldPrinting, newPrinting]]);
		const result = updateDeckPrintings(deck, updates);

		expect(result.cards[0].quantity).toBe(4);
	});

	it("does NOT merge separate entries that end up with same printing", () => {
		const printingA = asScryfallId("aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
		const printingB = asScryfallId("bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
		const cheapest = asScryfallId("cccc-cccc-cccc-cccc-cccccccccccc");
		const oracle = asOracleId("00000000-0000-0000-0000-000000000000");

		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "modern",
			cards: [
				{
					scryfallId: printingA,
					oracleId: oracle,
					quantity: 2,
					section: "mainboard",
					tags: ["burn"],
				},
				{
					scryfallId: printingB,
					oracleId: oracle,
					quantity: 3,
					section: "mainboard",
					tags: ["removal"],
				},
			],
			createdAt: new Date().toISOString(),
		};

		const updates = new Map([
			[printingA, cheapest],
			[printingB, cheapest],
		]);
		const result = updateDeckPrintings(deck, updates);

		// Should have 2 separate entries, NOT merged into 1
		expect(result.cards.length).toBe(2);
		expect(result.cards[0].scryfallId).toBe(cheapest);
		expect(result.cards[0].quantity).toBe(2);
		expect(result.cards[0].tags).toEqual(["burn"]);
		expect(result.cards[1].scryfallId).toBe(cheapest);
		expect(result.cards[1].quantity).toBe(3);
		expect(result.cards[1].tags).toEqual(["removal"]);
	});
});

describe("findAllCanonicalPrintings", () => {
	const oracle1 = asOracleId("11111111-1111-1111-1111-111111111111");

	const card1a = asScryfallId("1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a");
	const card1b = asScryfallId("1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b");

	function mockProvider(config: {
		cards: Record<string, { oracle_id: OracleId }>;
		canonical: Record<string, ScryfallId>;
	}): CardDataProvider {
		return {
			getCardById: vi.fn(async (id: ScryfallId) => {
				const data = config.cards[id];
				if (!data) return undefined;
				return { id, oracle_id: data.oracle_id, name: "Test Card" } as Card;
			}),
			getPrintingsByOracleId: vi.fn(async () => []),
			getVolatileData: vi.fn(async () => null),
			getCanonicalPrinting: vi.fn(
				async (oracleId: OracleId) => config.canonical[oracleId],
			),
			getMetadata: vi.fn(async () => ({ version: "test", cardCount: 100 })),
		};
	}

	it("finds canonical printing for each card", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			canonical: {
				[oracle1]: card1b,
			},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCanonicalPrintings(deck, provider);

		expect(updates.get(card1a)).toBe(card1b);
	});

	it("skips cards already at canonical", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			canonical: {
				[oracle1]: card1a,
			},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCanonicalPrintings(deck, provider);

		expect(updates.size).toBe(0);
	});

	it("handles cards with no canonical printing", async () => {
		const provider = mockProvider({
			cards: {
				[card1a]: { oracle_id: oracle1 },
			},
			canonical: {},
		});

		const deck = mockDeck([{ scryfallId: card1a, oracleId: oracle1 }]);
		const updates = await findAllCanonicalPrintings(deck, provider);

		expect(updates.size).toBe(0);
	});
});
