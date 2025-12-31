import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/scryfall-types";
import {
	type CardLookup,
	computeManaCurve,
	computeSpeedDistribution,
	computeTypeDistribution,
	countManaSymbols,
	getSourceTempo,
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
			C: 0,
		});
	});

	it("handles hybrid mana", () => {
		expect(countManaSymbols("{W/U}{W/U}")).toEqual({
			W: 2,
			U: 2,
			B: 0,
			R: 0,
			G: 0,
			C: 0,
		});
	});

	it("handles phyrexian mana", () => {
		expect(countManaSymbols("{W/P}{B/P}")).toEqual({
			W: 1,
			U: 0,
			B: 1,
			R: 0,
			G: 0,
			C: 0,
		});
	});

	it("handles hybrid phyrexian (2/W)", () => {
		expect(countManaSymbols("{2/W}{2/U}")).toEqual({
			W: 1,
			U: 1,
			B: 0,
			R: 0,
			G: 0,
			C: 0,
		});
	});

	it("ignores generic and X costs", () => {
		expect(countManaSymbols("{X}{X}{2}{R}")).toEqual({
			W: 0,
			U: 0,
			B: 0,
			R: 1,
			G: 0,
			C: 0,
		});
	});

	it("counts colorless mana requirements", () => {
		expect(countManaSymbols("{C}{C}{U}")).toEqual({
			W: 0,
			U: 1,
			B: 0,
			R: 0,
			G: 0,
			C: 2,
		});
	});

	it("handles empty/undefined", () => {
		expect(countManaSymbols("")).toEqual({
			W: 0,
			U: 0,
			B: 0,
			R: 0,
			G: 0,
			C: 0,
		});
		expect(countManaSymbols(undefined)).toEqual({
			W: 0,
			U: 0,
			B: 0,
			R: 0,
			G: 0,
			C: 0,
		});
	});

	it("counts all five colors plus colorless", () => {
		expect(countManaSymbols("{W}{U}{B}{R}{G}{C}")).toEqual({
			W: 1,
			U: 1,
			B: 1,
			R: 1,
			G: 1,
			C: 1,
		});
	});
});

describe("getSourceTempo", () => {
	// === LANDS ===
	describe("lands", () => {
		it("returns immediate for basic lands (Forest)", () => {
			const card = makeCard({
				type_line: "Basic Land — Forest",
				oracle_text: "({T}: Add {G}.)",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for Command Tower", () => {
			const card = makeCard({
				type_line: "Land",
				oracle_text:
					"{T}: Add one mana of any color in your commander's color identity.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for shocklands (can be untapped)", () => {
			// Shocklands use "it enters tapped" not "enters the battlefield tapped"
			const card = makeCard({
				type_line: "Land — Forest Island",
				oracle_text:
					"({T}: Add {G} or {U}.)\nAs this land enters, you may pay 2 life. If you don't, it enters tapped.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns delayed for taplands (Temple of Mystery)", () => {
			const card = makeCard({
				type_line: "Land",
				oracle_text:
					"This land enters tapped.\nWhen this land enters, scry 1.\n{T}: Add {G} or {U}.",
			});
			expect(getSourceTempo(card)).toBe("delayed");
		});

		it("returns bounce for bouncelands (Simic Growth Chamber)", () => {
			const card = makeCard({
				type_line: "Land",
				oracle_text:
					"This land enters tapped.\nWhen this land enters, return a land you control to its owner's hand.\n{T}: Add {G}{U}.",
			});
			expect(getSourceTempo(card)).toBe("bounce");
		});

		it("returns immediate for Wastes (colorless basic)", () => {
			const card = makeCard({
				type_line: "Basic Land",
				oracle_text: "{T}: Add {C}.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});
	});

	// === CREATURES ===
	describe("creatures", () => {
		it("returns delayed for Llanowar Elves (no haste)", () => {
			const card = makeCard({
				type_line: "Creature — Elf Druid",
				oracle_text: "{T}: Add {G}.",
				keywords: [],
			});
			expect(getSourceTempo(card)).toBe("delayed");
		});

		it("returns immediate for Beastcaller Savant (hasty dork)", () => {
			const card = makeCard({
				type_line: "Creature — Elf Shaman Ally",
				oracle_text:
					"Haste\n{T}: Add one mana of any color. Spend this mana only to cast a creature spell.",
				keywords: ["Haste"],
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for Cormela (hasty creature)", () => {
			const card = makeCard({
				type_line: "Legendary Creature — Vampire Rogue",
				oracle_text:
					"Haste\n{1}, {T}: Add {U}{B}{R}. Spend this mana only to cast instant and/or sorcery spells.\nWhen Cormela dies, return up to one target instant or sorcery card from your graveyard to your hand.",
				keywords: ["Haste"],
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns delayed for Selvala (no haste, tap ability)", () => {
			const card = makeCard({
				type_line: "Legendary Creature — Elf Scout",
				oracle_text:
					"Whenever another creature enters, its controller may draw a card if its power is greater than each other creature's power.\n{G}, {T}: Add X mana in any combination of colors, where X is the greatest power among creatures you control.",
				keywords: [],
			});
			expect(getSourceTempo(card)).toBe("delayed");
		});

		it("returns immediate for Blood Pet (sacrifice, no tap)", () => {
			const card = makeCard({
				type_line: "Creature — Thrull",
				oracle_text: "Sacrifice this creature: Add {B}.",
				keywords: [],
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for Akki Rockspeaker (ETB trigger)", () => {
			const card = makeCard({
				type_line: "Creature — Goblin Shaman",
				oracle_text: "When this creature enters, add {R}.",
				keywords: [],
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for Simian Spirit Guide (exile from hand)", () => {
			const card = makeCard({
				type_line: "Creature — Ape Spirit",
				oracle_text: "Exile this card from your hand: Add {R}.",
				keywords: [],
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});
	});

	// === ARTIFACTS ===
	describe("artifacts", () => {
		it("returns immediate for Sol Ring", () => {
			const card = makeCard({
				type_line: "Artifact",
				oracle_text: "{T}: Add {C}{C}.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns delayed for Worn Powerstone (ETB tapped)", () => {
			const card = makeCard({
				type_line: "Artifact",
				oracle_text: "This artifact enters tapped.\n{T}: Add {C}{C}.",
			});
			expect(getSourceTempo(card)).toBe("delayed");
		});

		it("returns immediate for Arcum's Astrolabe", () => {
			const card = makeCard({
				type_line: "Snow Artifact",
				oracle_text:
					"({S} can be paid with one mana from a snow source.)\nWhen this artifact enters, draw a card.\n{1}, {T}: Add one mana of any color.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});

		it("returns immediate for Lotus Petal (tap + sac)", () => {
			const card = makeCard({
				type_line: "Artifact",
				oracle_text: "{T}, Sacrifice this artifact: Add one mana of any color.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});
	});

	// === ENCHANTMENTS ===
	describe("enchantments", () => {
		it("returns immediate for Cryptolith Rite", () => {
			const card = makeCard({
				type_line: "Enchantment",
				oracle_text:
					'Creatures you control have "{T}: Add one mana of any color."',
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});
	});

	// === SPELLS (one-shot mana) ===
	describe("spells", () => {
		it("returns immediate for Dark Ritual", () => {
			const card = makeCard({
				type_line: "Instant",
				oracle_text: "Add {B}{B}{B}.",
			});
			expect(getSourceTempo(card)).toBe("immediate");
		});
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
