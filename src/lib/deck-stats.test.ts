import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/scryfall-types";
import {
	type CardLookup,
	computeManaCurve,
	computeSpeedDistribution,
	computeTypeDistribution,
	countManaSymbols,
	extractManaProduction,
	getSpeedCategory,
	isPermanent,
} from "./deck-stats";
import type { DeckCard } from "./deck-types";

function makeCard(overrides: Partial<Card>): Card {
	return {
		id: "test-id" as Card["id"],
		oracle_id: "test-oracle" as Card["oracle_id"],
		name: "Test Card",
		...overrides,
	};
}

function makeDeckCard(overrides: Partial<DeckCard> = {}): DeckCard {
	return {
		scryfallId: "test-id" as DeckCard["scryfallId"],
		quantity: 1,
		section: "mainboard",
		...overrides,
	};
}

function createTestData(
	items: Array<{ card: Partial<Card>; deckCard?: Partial<DeckCard> }>,
): { cards: DeckCard[]; lookup: CardLookup } {
	const cardMap = new Map<string, Card>();
	const deckCards: DeckCard[] = [];

	items.forEach((item, i) => {
		const id = `test-id-${i}` as DeckCard["scryfallId"];
		const card = makeCard({ ...item.card, id: id as Card["id"] });
		const deckCard = makeDeckCard({ ...item.deckCard, scryfallId: id });

		cardMap.set(id, card);
		deckCards.push(deckCard);
	});

	const lookup: CardLookup = (dc) => cardMap.get(dc.scryfallId);

	return { cards: deckCards, lookup };
}

describe("countManaSymbols", () => {
	it("counts basic mana symbols", () => {
		expect(countManaSymbols("{2}{U}{U}{B}")).toEqual({
			W: 0,
			U: 2,
			B: 1,
			R: 0,
			G: 0,
		});
	});

	it("handles hybrid mana", () => {
		expect(countManaSymbols("{W/U}{W/U}")).toEqual({
			W: 2,
			U: 2,
			B: 0,
			R: 0,
			G: 0,
		});
	});

	it("handles phyrexian mana", () => {
		expect(countManaSymbols("{W/P}{B/P}")).toEqual({
			W: 1,
			U: 0,
			B: 1,
			R: 0,
			G: 0,
		});
	});

	it("handles hybrid phyrexian (2/W)", () => {
		expect(countManaSymbols("{2/W}{2/U}")).toEqual({
			W: 1,
			U: 1,
			B: 0,
			R: 0,
			G: 0,
		});
	});

	it("ignores generic and X costs", () => {
		expect(countManaSymbols("{X}{X}{2}{R}")).toEqual({
			W: 0,
			U: 0,
			B: 0,
			R: 1,
			G: 0,
		});
	});

	it("ignores colorless mana", () => {
		expect(countManaSymbols("{C}{C}{U}")).toEqual({
			W: 0,
			U: 1,
			B: 0,
			R: 0,
			G: 0,
		});
	});

	it("handles empty/undefined", () => {
		expect(countManaSymbols("")).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
		expect(countManaSymbols(undefined)).toEqual({
			W: 0,
			U: 0,
			B: 0,
			R: 0,
			G: 0,
		});
	});

	it("counts all five colors", () => {
		expect(countManaSymbols("{W}{U}{B}{R}{G}")).toEqual({
			W: 1,
			U: 1,
			B: 1,
			R: 1,
			G: 1,
		});
	});
});

describe("extractManaProduction", () => {
	it("extracts from basic land text", () => {
		const card = makeCard({
			oracle_text: "{T}: Add {G}.",
			type_line: "Basic Land — Forest",
		});
		expect(extractManaProduction(card)).toEqual(["G"]);
	});

	it("extracts multiple colors from dual land", () => {
		const card = makeCard({
			oracle_text: "{T}: Add {W} or {U}.",
			type_line: "Land",
		});
		const colors = extractManaProduction(card);
		expect(colors).toContain("W");
		expect(colors).toContain("U");
	});

	it("handles 'any color' lands", () => {
		const card = makeCard({
			oracle_text: "{T}: Add one mana of any color.",
			type_line: "Land",
		});
		expect(extractManaProduction(card).sort()).toEqual([
			"B",
			"G",
			"R",
			"U",
			"W",
		]);
	});

	it("handles 'any type' mana", () => {
		const card = makeCard({
			oracle_text: "{T}: Add two mana of any one color.",
			type_line: "Land",
		});
		expect(extractManaProduction(card).sort()).toEqual([
			"B",
			"G",
			"R",
			"U",
			"W",
		]);
	});

	it("extracts from mana dorks", () => {
		const card = makeCard({
			oracle_text: "{T}: Add {G}.",
			type_line: "Creature — Elf Druid",
		});
		expect(extractManaProduction(card)).toEqual(["G"]);
	});

	it("extracts from mana rocks", () => {
		const card = makeCard({
			oracle_text: "{T}: Add {C}{C}.",
			type_line: "Artifact",
		});
		// Colorless doesn't count
		expect(extractManaProduction(card)).toEqual([]);
	});

	it("handles cards with no mana production", () => {
		const card = makeCard({
			oracle_text: "Flying",
			type_line: "Creature — Bird",
		});
		expect(extractManaProduction(card)).toEqual([]);
	});

	it("handles cards with undefined oracle text", () => {
		const card = makeCard({
			oracle_text: undefined,
			type_line: "Creature",
		});
		expect(extractManaProduction(card)).toEqual([]);
	});

	it("extracts from triomes", () => {
		const card = makeCard({
			oracle_text:
				"({T}: Add {G}, {W}, or {U}.)\nRaugrin Triome enters the battlefield tapped.",
			type_line: "Land — Island Mountain Plains",
		});
		const colors = extractManaProduction(card);
		expect(colors).toContain("G");
		expect(colors).toContain("W");
		expect(colors).toContain("U");
	});
});

describe("getSpeedCategory", () => {
	it("returns instant for Instant type", () => {
		const card = makeCard({ type_line: "Instant", keywords: [] });
		expect(getSpeedCategory(card)).toBe("instant");
	});

	it("returns instant for Flash keyword", () => {
		const card = makeCard({
			type_line: "Creature — Human Wizard",
			keywords: ["Flash"],
		});
		expect(getSpeedCategory(card)).toBe("instant");
	});

	it("returns sorcery for regular creatures", () => {
		const card = makeCard({
			type_line: "Creature — Human Wizard",
			keywords: [],
		});
		expect(getSpeedCategory(card)).toBe("sorcery");
	});

	it("returns sorcery for Sorcery type", () => {
		const card = makeCard({ type_line: "Sorcery", keywords: [] });
		expect(getSpeedCategory(card)).toBe("sorcery");
	});

	it("returns sorcery for creatures without keywords", () => {
		const card = makeCard({
			type_line: "Creature — Dragon",
			keywords: undefined,
		});
		expect(getSpeedCategory(card)).toBe("sorcery");
	});

	it("returns instant for Instant with Flash (edge case)", () => {
		const card = makeCard({
			type_line: "Instant",
			keywords: ["Flash"],
		});
		expect(getSpeedCategory(card)).toBe("instant");
	});
});

describe("isPermanent", () => {
	it("returns true for creatures", () => {
		expect(isPermanent("Legendary Creature — Human Wizard")).toBe(true);
	});

	it("returns true for artifacts", () => {
		expect(isPermanent("Artifact — Equipment")).toBe(true);
	});

	it("returns true for enchantments", () => {
		expect(isPermanent("Enchantment — Aura")).toBe(true);
	});

	it("returns true for planeswalkers", () => {
		expect(isPermanent("Legendary Planeswalker — Jace")).toBe(true);
	});

	it("returns true for lands", () => {
		expect(isPermanent("Basic Land — Island")).toBe(true);
	});

	it("returns true for battles", () => {
		expect(isPermanent("Battle — Siege")).toBe(true);
	});

	it("returns false for instants", () => {
		expect(isPermanent("Instant")).toBe(false);
	});

	it("returns false for sorceries", () => {
		expect(isPermanent("Sorcery")).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isPermanent(undefined)).toBe(false);
	});

	it("returns true for artifact creatures", () => {
		expect(isPermanent("Artifact Creature — Golem")).toBe(true);
	});

	it("returns true for enchantment creatures", () => {
		expect(isPermanent("Enchantment Creature — God")).toBe(true);
	});
});

describe("computeManaCurve", () => {
	it("groups cards by CMC bucket", () => {
		const { cards, lookup } = createTestData([
			{ card: { cmc: 1, type_line: "Creature" } },
			{ card: { cmc: 2, type_line: "Creature" } },
			{ card: { cmc: 2, type_line: "Creature" } },
			{ card: { cmc: 3, type_line: "Creature" } },
		]);

		const curve = computeManaCurve(cards, lookup);

		expect(curve.find((b) => b.bucket === "1")?.permanents).toBe(1);
		expect(curve.find((b) => b.bucket === "2")?.permanents).toBe(2);
		expect(curve.find((b) => b.bucket === "3")?.permanents).toBe(1);
	});

	it("separates permanents from spells", () => {
		const { cards, lookup } = createTestData([
			{ card: { cmc: 2, type_line: "Creature — Elf" } },
			{ card: { cmc: 2, type_line: "Instant" } },
		]);

		const curve = computeManaCurve(cards, lookup);
		const bucket2 = curve.find((b) => b.bucket === "2");

		expect(bucket2?.permanents).toBe(1);
		expect(bucket2?.spells).toBe(1);
	});

	it("handles 7+ bucket", () => {
		const { cards, lookup } = createTestData([
			{ card: { cmc: 7, type_line: "Creature" } },
			{ card: { cmc: 8, type_line: "Creature" } },
			{ card: { cmc: 10, type_line: "Sorcery" } },
		]);

		const curve = computeManaCurve(cards, lookup);
		const bucket7Plus = curve.find((b) => b.bucket === "7+");

		expect(bucket7Plus?.permanents).toBe(2);
		expect(bucket7Plus?.spells).toBe(1);
	});

	it("multiplies by quantity", () => {
		const { cards, lookup } = createTestData([
			{ card: { cmc: 1, type_line: "Instant" }, deckCard: { quantity: 4 } },
		]);

		const curve = computeManaCurve(cards, lookup);
		expect(curve.find((b) => b.bucket === "1")?.spells).toBe(4);
	});

	it("returns empty buckets for missing CMCs", () => {
		const { cards, lookup } = createTestData([
			{ card: { cmc: 5, type_line: "Creature" } },
		]);

		const curve = computeManaCurve(cards, lookup);

		expect(curve.find((b) => b.bucket === "0")?.permanents).toBe(0);
		expect(curve.find((b) => b.bucket === "1")?.permanents).toBe(0);
		expect(curve.find((b) => b.bucket === "5")?.permanents).toBe(1);
	});

	it("includes card references in buckets", () => {
		const { cards, lookup } = createTestData([
			{ card: { name: "Llanowar Elves", cmc: 1, type_line: "Creature" } },
			{ card: { name: "Lightning Bolt", cmc: 1, type_line: "Instant" } },
		]);

		const curve = computeManaCurve(cards, lookup);
		const bucket1 = curve.find((b) => b.bucket === "1");

		expect(bucket1?.permanentCards).toHaveLength(1);
		expect(bucket1?.spellCards).toHaveLength(1);
	});
});

describe("computeTypeDistribution", () => {
	it("counts cards by primary type", () => {
		const { cards, lookup } = createTestData([
			{ card: { type_line: "Creature — Elf" } },
			{ card: { type_line: "Creature — Human" } },
			{ card: { type_line: "Instant" } },
			{ card: { type_line: "Sorcery" } },
		]);

		const types = computeTypeDistribution(cards, lookup);

		expect(types.find((t) => t.type === "Creature")?.count).toBe(2);
		expect(types.find((t) => t.type === "Instant")?.count).toBe(1);
		expect(types.find((t) => t.type === "Sorcery")?.count).toBe(1);
	});

	it("multiplies by quantity", () => {
		const { cards, lookup } = createTestData([
			{ card: { type_line: "Instant" }, deckCard: { quantity: 4 } },
		]);

		const types = computeTypeDistribution(cards, lookup);
		expect(types.find((t) => t.type === "Instant")?.count).toBe(4);
	});

	it("sorts by count descending", () => {
		const { cards, lookup } = createTestData([
			{ card: { type_line: "Instant" } },
			{ card: { type_line: "Creature" } },
			{ card: { type_line: "Creature" } },
			{ card: { type_line: "Creature" } },
		]);

		const types = computeTypeDistribution(cards, lookup);

		expect(types[0].type).toBe("Creature");
		expect(types[0].count).toBe(3);
		expect(types[1].type).toBe("Instant");
		expect(types[1].count).toBe(1);
	});

	it("includes card references", () => {
		const { cards, lookup } = createTestData([
			{ card: { name: "Bolt", type_line: "Instant" } },
			{ card: { name: "Shock", type_line: "Instant" } },
		]);

		const types = computeTypeDistribution(cards, lookup);
		const instants = types.find((t) => t.type === "Instant");

		expect(instants?.cards).toHaveLength(2);
	});
});

describe("computeSpeedDistribution", () => {
	it("separates instant and sorcery speed", () => {
		const { cards, lookup } = createTestData([
			{ card: { type_line: "Instant", keywords: [] } },
			{ card: { type_line: "Creature", keywords: ["Flash"] } },
			{ card: { type_line: "Creature", keywords: [] } },
			{ card: { type_line: "Sorcery", keywords: [] } },
		]);

		const speed = computeSpeedDistribution(cards, lookup);

		expect(speed.find((s) => s.category === "instant")?.count).toBe(2);
		expect(speed.find((s) => s.category === "sorcery")?.count).toBe(2);
	});

	it("multiplies by quantity", () => {
		const { cards, lookup } = createTestData([
			{
				card: { type_line: "Instant", keywords: [] },
				deckCard: { quantity: 4 },
			},
		]);

		const speed = computeSpeedDistribution(cards, lookup);
		expect(speed.find((s) => s.category === "instant")?.count).toBe(4);
	});

	it("includes card references", () => {
		const { cards, lookup } = createTestData([
			{ card: { name: "Bolt", type_line: "Instant", keywords: [] } },
			{
				card: {
					name: "Snapcaster",
					type_line: "Creature",
					keywords: ["Flash"],
				},
			},
		]);

		const speed = computeSpeedDistribution(cards, lookup);
		const instant = speed.find((s) => s.category === "instant");

		expect(instant?.cards).toHaveLength(2);
	});
});
