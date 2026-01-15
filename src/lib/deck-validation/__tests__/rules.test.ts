import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "@/lib/__tests__/test-card-lookup";
import type { Deck, DeckCard, Section } from "@/lib/deck-types";
import type {
	Card,
	ManaColor,
	OracleId,
	ScryfallId,
} from "@/lib/scryfall-types";
import {
	colorIdentityRule,
	commanderLegendaryRule,
	commanderPartnerRule,
	commanderPlaneswalkerRule,
	commanderRequiredRule,
	signatureSpellRule,
} from "../rules/commander";
import type { ValidationContext } from "../types";

describe("commander rules", () => {
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

	function makeContext(
		deck: Deck,
		commanderColors?: string[],
	): ValidationContext {
		const cardMap = new Map<ScryfallId, Card>();
		const oracleMap = new Map<OracleId, Card>();

		return {
			deck,
			cardLookup: (id) => cardMap.get(id),
			oracleLookup: (id) => oracleMap.get(id),
			getPrintings: () => [],
			format: deck.format,
			commanderColors: commanderColors as ManaColor[] | undefined,
			config: { legalityField: "commander" },
		};
	}

	async function makeContextWithCards(
		deck: Deck,
		cardList: Card[],
		commanderColors?: string[],
	): Promise<ValidationContext> {
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
			commanderColors: commanderColors as ManaColor[] | undefined,
			config: { legalityField: "commander" },
		};
	}

	describe("commanderRequiredRule", () => {
		it("errors when no commander", () => {
			const deck = makeDeck([]);
			const ctx = makeContext(deck);
			const violations = commanderRequiredRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("error");
		});

		it("passes with a commander", async () => {
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([makeCard(solRing, "commander")]);
			const ctx = await makeContextWithCards(deck, [solRing]);
			const violations = commanderRequiredRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("commanderLegendaryRule", () => {
		it("errors when commander is not legendary creature", async () => {
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([makeCard(solRing, "commander")]);
			const ctx = await makeContextWithCards(deck, [solRing]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a legendary creature");
		});

		it("passes for legendary creature", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([makeCard(selvala, "commander")]);
			const ctx = await makeContextWithCards(deck, [selvala]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("commanderPartnerRule", () => {
		it("allows single commander without partner", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([makeCard(selvala, "commander")]);
			const ctx = await makeContextWithCards(deck, [selvala]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows two generic partner commanders", async () => {
			const thrasios = await cards.get("Thrasios, Triton Hero");
			const tymna = await cards.get("Tymna the Weaver");
			const deck = makeDeck([
				makeCard(thrasios, "commander"),
				makeCard(tymna, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [thrasios, tymna]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows partner with specific card", async () => {
			const pir = await cards.get("Pir, Imaginative Rascal");
			const toothy = await cards.get("Toothy, Imaginary Friend");
			const deck = makeDeck([
				makeCard(pir, "commander"),
				makeCard(toothy, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [pir, toothy]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows friends forever pairing", async () => {
			const bjorna = await cards.get("Bjorna, Nightfall Alchemist");
			const cecily = await cards.get("Cecily, Haunted Mage");
			const deck = makeDeck([
				makeCard(bjorna, "commander"),
				makeCard(cecily, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [bjorna, cecily]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows background pairing", async () => {
			const wilson = await cards.get("Wilson, Refined Grizzly");
			const raisedByGiants = await cards.get("Raised by Giants");
			const deck = makeDeck([
				makeCard(wilson, "commander"),
				makeCard(raisedByGiants, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [wilson, raisedByGiants]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows doctor's companion pairing", async () => {
			const barbara = await cards.get("Barbara Wright");
			const doctor = await cards.get("The Eighth Doctor");
			const deck = makeDeck([
				makeCard(barbara, "commander"),
				makeCard(doctor, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [barbara, doctor]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("errors with 3 commanders", async () => {
			const thrasios = await cards.get("Thrasios, Triton Hero");
			const tymna = await cards.get("Tymna the Weaver");
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([
				makeCard(thrasios, "commander"),
				makeCard(tymna, "commander"),
				makeCard(selvala, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [thrasios, tymna, selvala]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("3 commanders");
		});

		it("errors when partner with wrong card", async () => {
			const pir = await cards.get("Pir, Imaginative Rascal");
			const thrasios = await cards.get("Thrasios, Triton Hero");
			const deck = makeDeck([
				makeCard(pir, "commander"),
				makeCard(thrasios, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [pir, thrasios]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("cannot be paired");
		});

		it("errors when incompatible commanders", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([
				makeCard(selvala, "commander"),
				makeCard(solRing, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [selvala, solRing]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
		});
	});

	describe("colorIdentityRule", () => {
		it("errors when card outside color identity", async () => {
			const lightningBolt = await cards.get("Lightning Bolt");
			const deck = makeDeck([makeCard(lightningBolt, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [lightningBolt], ["U", "G"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("error");
			expect(violations[0].message).toContain("R not in UG");
		});

		it("warns for maybeboard cards outside identity", async () => {
			const lightningBolt = await cards.get("Lightning Bolt");
			const deck = makeDeck([makeCard(lightningBolt, "maybeboard")]);
			const ctx = await makeContextWithCards(deck, [lightningBolt], ["U", "G"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].severity).toBe("warning");
		});

		it("passes when card in color identity", async () => {
			const lightningBolt = await cards.get("Lightning Bolt");
			const deck = makeDeck([makeCard(lightningBolt, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [lightningBolt], ["R", "G"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("passes for colorless cards in any identity", async () => {
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([makeCard(solRing, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [solRing], ["W"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("commanderPlaneswalkerRule (Oathbreaker)", () => {
		it("errors when commander is not planeswalker", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([makeCard(selvala, "commander")], "oathbreaker");
			const ctx = await makeContextWithCards(deck, [selvala]);
			const violations = commanderPlaneswalkerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a planeswalker");
		});

		it("passes for planeswalker", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const deck = makeDeck([makeCard(bolas, "commander")], "oathbreaker");
			const ctx = await makeContextWithCards(deck, [bolas]);
			const violations = commanderPlaneswalkerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("ignores signature spell (instant/sorcery)", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const darkRitual = await cards.get("Dark Ritual");
			const deck = makeDeck(
				[makeCard(bolas, "commander"), makeCard(darkRitual, "commander")],
				"oathbreaker",
			);
			const ctx = await makeContextWithCards(deck, [bolas, darkRitual]);
			const violations = commanderPlaneswalkerRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("signatureSpellRule (Oathbreaker)", () => {
		it("errors when no signature spell", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const deck = makeDeck([makeCard(bolas, "commander")], "oathbreaker");
			const ctx = await makeContextWithCards(deck, [bolas]);
			const violations = signatureSpellRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("must have a signature spell");
		});

		it("passes with one signature spell", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const darkRitual = await cards.get("Dark Ritual");
			const deck = makeDeck(
				[makeCard(bolas, "commander"), makeCard(darkRitual, "commander")],
				"oathbreaker",
			);
			const ctx = await makeContextWithCards(deck, [bolas, darkRitual]);
			const violations = signatureSpellRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("errors with multiple signature spells", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const darkRitual = await cards.get("Dark Ritual");
			const fireball = await cards.get("Fireball");
			const deck = makeDeck(
				[
					makeCard(bolas, "commander"),
					makeCard(darkRitual, "commander"),
					makeCard(fireball, "commander"),
				],
				"oathbreaker",
			);
			const ctx = await makeContextWithCards(deck, [
				bolas,
				darkRitual,
				fireball,
			]);
			const violations = signatureSpellRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("only have 1 signature spell");
		});
	});
});
