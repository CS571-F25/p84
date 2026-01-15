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
import { commanderUncommonRule } from "../rules/rarity";
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
		printingsMap?: Map<OracleId, Card[]>,
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
			getPrintings: (id) => printingsMap?.get(id) ?? [],
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

	describe("commanderLegendaryRule edge cases", () => {
		it("allows vehicle with 'can be your commander' text", async () => {
			const shorikai = await cards.get("Shorikai, Genesis Engine");
			const deck = makeDeck([makeCard(shorikai, "commander")]);
			const ctx = await makeContextWithCards(deck, [shorikai]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows legendary vehicle (rule change 2024)", async () => {
			const parhelion = await cards.get("Parhelion II");
			const deck = makeDeck([makeCard(parhelion, "commander")]);
			const ctx = await makeContextWithCards(deck, [parhelion]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("rejects non-legendary artifact as commander", async () => {
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck([makeCard(solRing, "commander")]);
			const ctx = await makeContextWithCards(deck, [solRing]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a legendary creature");
		});

		it("allows planeswalker with 'can be your commander' text", async () => {
			const aminatou = await cards.get("Aminatou, the Fateshifter");
			const deck = makeDeck([makeCard(aminatou, "commander")]);
			const ctx = await makeContextWithCards(deck, [aminatou]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("rejects planeswalker without 'can be your commander' in Commander", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const deck = makeDeck([makeCard(bolas, "commander")], "commander");
			const ctx = await makeContextWithCards(deck, [bolas]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a legendary creature");
		});

		it("allows DFC with legendary creature on front face", async () => {
			const esika = await cards.get("Esika, God of the Tree");
			const deck = makeDeck([makeCard(esika, "commander")]);
			const ctx = await makeContextWithCards(deck, [esika]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows creature that transforms into planeswalker", async () => {
			const jace = await cards.get("Jace, Vryn's Prodigy");
			const deck = makeDeck([makeCard(jace, "commander")]);
			const ctx = await makeContextWithCards(deck, [jace]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows Grist (planeswalker that's a creature everywhere else)", async () => {
			const grist = await cards.get("Grist, the Hunger Tide");
			const deck = makeDeck([makeCard(grist, "commander")]);
			const ctx = await makeContextWithCards(deck, [grist]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("allows legendary spacecraft with P/T box (903.3c)", async () => {
			const spacecraft = await cards.get("Candela, Aegis of Adagia");
			const deck = makeDeck([makeCard(spacecraft, "commander")]);
			const ctx = await makeContextWithCards(deck, [spacecraft]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("rejects legendary spacecraft without P/T box (903.3c)", async () => {
			const elevator = await cards.get("The Eternity Elevator");
			const deck = makeDeck([makeCard(elevator, "commander")]);
			const ctx = await makeContextWithCards(deck, [elevator]);
			const violations = commanderLegendaryRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a legendary creature");
		});
	});

	describe("commanderPartnerRule edge cases", () => {
		it("rejects background paired with non-background-choosing creature", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const raisedByGiants = await cards.get("Raised by Giants");
			const deck = makeDeck([
				makeCard(selvala, "commander"),
				makeCard(raisedByGiants, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [selvala, raisedByGiants]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("cannot be paired");
		});

		it("rejects two backgrounds together", async () => {
			const raisedByGiants = await cards.get("Raised by Giants");
			const deck = makeDeck([
				makeCard(raisedByGiants, "commander"),
				makeCard(raisedByGiants, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [
				raisedByGiants,
				raisedByGiants,
			]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
		});

		it("rejects doctor's companion without a doctor", async () => {
			const barbara = await cards.get("Barbara Wright");
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck([
				makeCard(barbara, "commander"),
				makeCard(selvala, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [barbara, selvala]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("cannot be paired");
		});

		it("rejects generic partner with friends forever (702.124f)", async () => {
			const thrasios = await cards.get("Thrasios, Triton Hero");
			const bjorna = await cards.get("Bjorna, Nightfall Alchemist");
			const deck = makeDeck([
				makeCard(thrasios, "commander"),
				makeCard(bjorna, "commander"),
			]);
			const ctx = await makeContextWithCards(deck, [thrasios, bjorna]);
			const violations = commanderPartnerRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("cannot be paired");
		});
	});

	describe("commanderUncommonRule (PDH)", () => {
		function mockPrinting(
			card: Card,
			rarity: "common" | "uncommon" | "rare" | "mythic",
			games: string[] = ["paper"],
		): Card {
			return { ...card, rarity, games };
		}

		it("passes for uncommon creature", async () => {
			const mulldrifter = await cards.get("Mulldrifter");
			const deck = makeDeck(
				[makeCard(mulldrifter, "commander")],
				"paupercommander",
			);
			const printingsMap = new Map<OracleId, Card[]>();
			printingsMap.set(mulldrifter.oracle_id, [
				mockPrinting(mulldrifter, "uncommon", ["paper"]),
			]);
			const ctx = await makeContextWithCards(
				deck,
				[mulldrifter],
				undefined,
				printingsMap,
			);
			const violations = commanderUncommonRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});

		it("rejects rare-only creature", async () => {
			const selvala = await cards.get("Selvala, Heart of the Wilds");
			const deck = makeDeck(
				[makeCard(selvala, "commander")],
				"paupercommander",
			);
			const printingsMap = new Map<OracleId, Card[]>();
			printingsMap.set(selvala.oracle_id, [
				mockPrinting(selvala, "rare", ["paper"]),
				mockPrinting(selvala, "mythic", ["paper"]),
			]);
			const ctx = await makeContextWithCards(
				deck,
				[selvala],
				undefined,
				printingsMap,
			);
			const violations = commanderUncommonRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("no uncommon printing");
		});

		it("rejects uncommon artifact (not creature)", async () => {
			const solRing = await cards.get("Sol Ring");
			const deck = makeDeck(
				[makeCard(solRing, "commander")],
				"paupercommander",
			);
			const printingsMap = new Map<OracleId, Card[]>();
			printingsMap.set(solRing.oracle_id, [
				mockPrinting(solRing, "uncommon", ["paper"]),
			]);
			const ctx = await makeContextWithCards(
				deck,
				[solRing],
				undefined,
				printingsMap,
			);
			const violations = commanderUncommonRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("not a creature");
		});

		it("rejects arena-only uncommon", async () => {
			const mulldrifter = await cards.get("Mulldrifter");
			const deck = makeDeck(
				[makeCard(mulldrifter, "commander")],
				"paupercommander",
			);
			const printingsMap = new Map<OracleId, Card[]>();
			printingsMap.set(mulldrifter.oracle_id, [
				mockPrinting(mulldrifter, "uncommon", ["arena"]),
				mockPrinting(mulldrifter, "rare", ["paper"]),
			]);
			const ctx = await makeContextWithCards(
				deck,
				[mulldrifter],
				undefined,
				printingsMap,
			);
			const violations = commanderUncommonRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("no uncommon printing");
		});

		it("allows uncommon spacecraft as PDH commander", async () => {
			const spacecraft = await cards.get("Atmospheric Greenhouse");
			const deck = makeDeck(
				[makeCard(spacecraft, "commander")],
				"paupercommander",
			);
			const printingsMap = new Map<OracleId, Card[]>();
			printingsMap.set(spacecraft.oracle_id, [
				mockPrinting(spacecraft, "uncommon", ["paper"]),
			]);
			const ctx = await makeContextWithCards(
				deck,
				[spacecraft],
				undefined,
				printingsMap,
			);
			const violations = commanderUncommonRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("signatureSpellRule color identity", () => {
		it("rejects signature spell outside oathbreaker color identity", async () => {
			const aminatou = await cards.get("Aminatou, the Fateshifter");
			const lightningBolt = await cards.get("Lightning Bolt");
			const deck = makeDeck(
				[makeCard(aminatou, "commander"), makeCard(lightningBolt, "commander")],
				"oathbreaker",
			);
			const ctx = await makeContextWithCards(
				deck,
				[aminatou, lightningBolt],
				["W", "U", "B"],
			);
			const violations = signatureSpellRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("color identity");
		});

		it("allows signature spell within oathbreaker color identity", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			const lightningBolt = await cards.get("Lightning Bolt");
			const deck = makeDeck(
				[makeCard(bolas, "commander"), makeCard(lightningBolt, "commander")],
				"oathbreaker",
			);
			const ctx = await makeContextWithCards(
				deck,
				[bolas, lightningBolt],
				["U", "B", "R"],
			);
			const violations = signatureSpellRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("colorIdentityRule basic land types (903.5d)", () => {
		it("rejects dual land with basic types outside commander identity", async () => {
			const stompingGround = await cards.get("Stomping Ground");
			const deck = makeDeck([makeCard(stompingGround, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [stompingGround], ["U"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("outside commander identity");
		});

		it("allows dual land with basic types in matching identity", async () => {
			const stompingGround = await cards.get("Stomping Ground");
			const deck = makeDeck([makeCard(stompingGround, "mainboard")]);
			const ctx = await makeContextWithCards(
				deck,
				[stompingGround],
				["R", "G"],
			);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("colorIdentityRule DFC back face (903.4d)", () => {
		it("rejects DFC when back face adds colors outside identity", async () => {
			const valki = await cards.get("Valki, God of Lies");
			const deck = makeDeck([makeCard(valki, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [valki], ["B"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("R not in B");
		});

		it("allows DFC when identity includes both faces", async () => {
			const valki = await cards.get("Valki, God of Lies");
			const deck = makeDeck([makeCard(valki, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [valki], ["B", "R"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("colorIdentityRule adventure cards (903.4e)", () => {
		it("rejects adventure card outside color identity", async () => {
			const bonecrusher = await cards.get("Bonecrusher Giant");
			const deck = makeDeck([makeCard(bonecrusher, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [bonecrusher], ["U"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("R not in U");
		});

		it("allows adventure card within color identity", async () => {
			const bonecrusher = await cards.get("Bonecrusher Giant");
			const deck = makeDeck([makeCard(bonecrusher, "mainboard")]);
			const ctx = await makeContextWithCards(deck, [bonecrusher], ["R"]);
			const violations = colorIdentityRule.validate(ctx);
			expect(violations).toHaveLength(0);
		});
	});

	describe("interchangeable names / same oracle_id (201.3)", () => {
		it("counts different printings together for singleton", async () => {
			// Bjorna has two printings with same oracle_id but different printed names:
			// - SLX: "Bjorna, Nightfall Alchemist" (Universes Within)
			// - SLD: "Lucas, the Sharpshooter" (Stranger Things) - printed_name differs!
			// Both share oracle_id c880fbdc-bdd9-4f80-81d4-e3e1124f76ca
			const bjornaSlx = await cards.get("Bjorna, Nightfall Alchemist");
			const lucasSld = {
				scryfallId: "3b09edfe-5bef-430e-853d-a6b4b612805a" as ScryfallId,
				oracleId: bjornaSlx.oracle_id, // Same oracle_id = interchangeable
				section: "mainboard" as Section,
				quantity: 1,
				tags: [],
			};

			const deck = makeDeck(
				[makeCard(bjornaSlx, "mainboard", 1), lucasSld],
				"commander",
			);
			const ctx = await makeContextWithCards(deck, [bjornaSlx]);
			const { singletonRule } = await import("../rules/base");
			const violations = singletonRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("exceeds singleton limit");
			expect(violations[0].message).toContain("2/1");
		});

		it("counts different printings together for playset", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const altPrintingBolt = {
				scryfallId: "00000000-0000-0000-0000-000000000000" as ScryfallId,
				oracleId: bolt.oracle_id, // Same oracle_id
				section: "mainboard" as Section,
				quantity: 2,
				tags: [],
			};

			// 3 + 2 = 5 total (exceeds 4-of limit)
			const deck = makeDeck(
				[makeCard(bolt, "mainboard", 3), altPrintingBolt],
				"modern",
			);
			const ctx: ValidationContext = {
				deck,
				cardLookup: (id) => (id === bolt.id ? bolt : undefined),
				oracleLookup: (id) => (id === bolt.oracle_id ? bolt : undefined),
				getPrintings: () => [],
				format: "modern",
				commanderColors: undefined,
				config: { legalityField: "modern", minDeckSize: 60, sideboardSize: 15 },
			};
			const { playsetRule } = await import("../rules/base");
			const violations = playsetRule.validate(ctx);
			expect(violations).toHaveLength(1);
			expect(violations[0].message).toContain("exceeds playset limit");
			expect(violations[0].message).toContain("5/4");
		});
	});
});
