import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCardLine, parseDeck } from "../parse";

const fixturesDir = join(__dirname, "fixtures");

function readFixture(subdir: string, filename: string): string {
	return readFileSync(join(fixturesDir, subdir, filename), "utf-8");
}

describe("parseCardLine", () => {
	describe("basic parsing", () => {
		it("parses quantity and name", () => {
			const result = parseCardLine("4 Lightning Bolt");
			expect(result).toEqual({
				quantity: 4,
				name: "Lightning Bolt",
				tags: [],
				raw: "4 Lightning Bolt",
			});
		});

		it("defaults quantity to 1 when not specified", () => {
			const result = parseCardLine("Sol Ring");
			expect(result).toEqual({
				quantity: 1,
				name: "Sol Ring",
				tags: [],
				raw: "Sol Ring",
			});
		});

		it("returns null for empty lines", () => {
			expect(parseCardLine("")).toBeNull();
			expect(parseCardLine("   ")).toBeNull();
		});
	});

	describe("Arena format: (SET) number", () => {
		it("parses set code in parentheses", () => {
			const result = parseCardLine("1 Lightning Bolt (2XM)");
			expect(result?.setCode).toBe("2XM");
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("parses set code and collector number", () => {
			const result = parseCardLine("4 Lightning Bolt (2XM) 141");
			expect(result?.setCode).toBe("2XM");
			expect(result?.collectorNumber).toBe("141");
		});

		it("normalizes set code to uppercase", () => {
			const result = parseCardLine("1 Lightning Bolt (2xm) 141");
			expect(result?.setCode).toBe("2XM");
		});
	});

	describe("MTGGoldfish format: [SET] after name", () => {
		it("parses set code in square brackets", () => {
			const result = parseCardLine("4 Lightning Bolt [2XM]");
			expect(result?.setCode).toBe("2XM");
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("parses with <variant> marker", () => {
			const result = parseCardLine("3 Enduring Curiosity <extended> [DSK]");
			expect(result?.setCode).toBe("DSK");
			expect(result?.name).toBe("Enduring Curiosity");
		});

		it("parses collector number in angle brackets", () => {
			const result = parseCardLine("4 Island <251> [THB]");
			expect(result?.setCode).toBe("THB");
			expect(result?.collectorNumber).toBe("251");
			expect(result?.name).toBe("Island");
		});
	});

	describe("XMage format: [SET:num] before name", () => {
		it("parses set and collector number before name", () => {
			const result = parseCardLine("4 [2XM:141] Lightning Bolt");
			expect(result?.setCode).toBe("2XM");
			expect(result?.collectorNumber).toBe("141");
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("parses set without collector number", () => {
			const result = parseCardLine("4 [ZEN] Misty Rainforest");
			expect(result?.setCode).toBe("ZEN");
			expect(result?.collectorNumber).toBeUndefined();
			expect(result?.name).toBe("Misty Rainforest");
		});
	});

	describe("TappedOut format: Nx quantity", () => {
		it("parses quantity with x suffix", () => {
			const result = parseCardLine("4x Lightning Bolt");
			expect(result?.quantity).toBe(4);
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("parses with set code", () => {
			const result = parseCardLine("3x Abundant Growth (ECC) 97");
			expect(result?.quantity).toBe(3);
			expect(result?.setCode).toBe("ECC");
			expect(result?.collectorNumber).toBe("97");
		});
	});

	describe("Moxfield format: tags and foil markers", () => {
		it("parses #tags", () => {
			const result = parseCardLine("1 Sol Ring (CMM) 647 #ramp #staple");
			expect(result?.tags).toEqual(["ramp", "staple"]);
		});

		it("strips *F* foil marker", () => {
			const result = parseCardLine("1 Edgar Markov (C17) 36 *F*");
			expect(result?.name).toBe("Edgar Markov");
			expect(result?.setCode).toBe("C17");
		});

		it("strips *A* alter marker", () => {
			const result = parseCardLine("1 Sol Ring (CMM) 647 *F* *A* #ramp");
			expect(result?.tags).toEqual(["ramp"]);
		});

		it("handles #! global tag prefix", () => {
			const result = parseCardLine("1 Sol Ring #!staple #ramp");
			expect(result?.tags).toEqual(["staple", "ramp"]);
		});

		it("deduplicates tags after stripping #! prefix", () => {
			// #!staple and #staple should collapse to single "staple"
			const result = parseCardLine("1 Sol Ring #!staple #staple #ramp");
			expect(result?.tags).toEqual(["staple", "ramp"]);
		});
	});

	describe("Archidekt format: extras stripped", () => {
		it("strips ^Tag^ color markers", () => {
			const result = parseCardLine("1x Sol Ring (cmm) 647 ^Have,#37d67a^");
			expect(result?.name).toBe("Sol Ring");
			expect(result?.setCode).toBe("CMM");
		});
	});

	describe("split cards", () => {
		it("parses Fire // Ice", () => {
			const result = parseCardLine("4 Fire // Ice (MH2) 290");
			expect(result?.name).toBe("Fire // Ice");
			expect(result?.setCode).toBe("MH2");
		});

		it("parses adventure cards with /", () => {
			const result = parseCardLine(
				"1 Agadeem's Awakening / Agadeem, the Undercrypt (ZNR) 90",
			);
			expect(result?.name).toBe(
				"Agadeem's Awakening / Agadeem, the Undercrypt",
			);
		});
	});

	describe("special characters", () => {
		it("parses cards with punctuation", () => {
			const result = parseCardLine("1 Ach! Hans, Run!");
			expect(result?.name).toBe("Ach! Hans, Run!");
		});

		it("parses cards with + in name", () => {
			const result = parseCardLine("4 +2 Mace (AFR) 1");
			expect(result?.name).toBe("+2 Mace");
		});

		it("parses special collector numbers", () => {
			const result = parseCardLine("1 Lightning Bolt (STA) 62★");
			expect(result?.collectorNumber).toBe("62★");
		});

		it("parses collector numbers with letters", () => {
			const result = parseCardLine("1 Blazemire Verge (PDSK) 256p");
			expect(result?.collectorNumber).toBe("256p");
		});
	});
});

describe("parseDeck", () => {
	describe("section handling", () => {
		it("parses Arena format with Deck/Sideboard headers", () => {
			const text = `Deck
4 Lightning Bolt (2XM) 141
4 Counterspell (IMA) 52

Sideboard
2 Pyroblast (EMA) 142`;

			const result = parseDeck(text);
			expect(result.mainboard).toHaveLength(2);
			expect(result.sideboard).toHaveLength(1);
			expect(result.mainboard[0].name).toBe("Lightning Bolt");
			expect(result.sideboard[0].name).toBe("Pyroblast");
		});

		it("parses Commander section", () => {
			const text = `Commander
1 Atraxa (CM2) 10

Deck
1 Sol Ring`;

			const result = parseDeck(text);
			expect(result.commander).toHaveLength(1);
			expect(result.mainboard).toHaveLength(1);
		});

		it("treats Companion as sideboard", () => {
			const text = `Companion
1 Lurrus (IKO) 226

Deck
4 Card`;

			const result = parseDeck(text);
			expect(result.sideboard).toHaveLength(1);
			expect(result.sideboard[0].name).toBe("Lurrus");
		});

		it("parses full Arena export with Commander/Deck/Sideboard", () => {
			const text = readFixture("arena", "pedh-commander.txt");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// Commander, Deck, and Sideboard sections all present
			expect(countCards(result.commander)).toBe(1);
			expect(result.commander[0].name).toBe("Hamza, Guardian of Arashin");

			// Mainboard includes 11 Forest + 6 Plains
			expect(countCards(result.mainboard)).toBe(83);
			expect(countCards(result.sideboard)).toBe(8);

			// Check specific cards - Arena format has no set codes
			const forest = result.mainboard.find((c) => c.name === "Forest");
			expect(forest?.quantity).toBe(11);
			expect(forest?.setCode).toBeUndefined();

			// Sideboard card
			const farseek = result.sideboard.find((c) => c.name === "Farseek");
			expect(farseek).toBeDefined();
		});
	});

	describe("XMage format", () => {
		it("parses XMage deck with SB: prefix", () => {
			const text = readFixture("xmage", "uw-miracles.dck");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// 19 entries mainboard, 8 entries sideboard
			expect(result.mainboard).toHaveLength(19);
			expect(result.sideboard).toHaveLength(8);
			// Total card counts
			expect(countCards(result.mainboard)).toBe(60);
			expect(countCards(result.sideboard)).toBe(15);
			expect(result.name).toBe("[MOD] UW Miracles");

			// Check specific cards have correct set/collector from [SET:num] format
			const logicKnot = result.mainboard.find((c) => c.name === "Logic Knot");
			expect(logicKnot).toBeDefined();
			expect(logicKnot?.quantity).toBe(2);
			expect(logicKnot?.setCode).toBe("FUT");
			expect(logicKnot?.collectorNumber).toBe("52");

			// Check sideboard card
			const relic = result.sideboard.find((c) =>
				c.name.includes("Relic of Progenitus"),
			);
			expect(relic).toBeDefined();
			expect(relic?.setCode).toBe("MMA");
		});
	});

	describe("Moxfield format", () => {
		it("parses Moxfield commander deck with foils", () => {
			const text = readFixture("moxfield", "commander-with-foils.txt");
			const result = parseDeck(text);

			// 98 entries, no Commander section header so all mainboard
			expect(result.mainboard).toHaveLength(98);
			expect(result.commander).toHaveLength(0);

			// Verify total card count (some entries have quantity > 1)
			const totalCards = result.mainboard.reduce(
				(sum, c) => sum + c.quantity,
				0,
			);
			expect(totalCards).toBe(100);

			// Check *F* marker stripped from card name
			const edgar = result.mainboard.find((c) =>
				c.name.includes("Edgar Markov"),
			);
			expect(edgar).toBeDefined();
			expect(edgar?.name).toBe("Edgar Markov");
			expect(edgar?.setCode).toBe("C17");
			expect(edgar?.collectorNumber).toBe("36");

			// Check MDFC preserves full name
			const agadeem = result.mainboard.find((c) =>
				c.name.includes("Agadeem's Awakening"),
			);
			expect(agadeem?.name).toBe(
				"Agadeem's Awakening / Agadeem, the Undercrypt",
			);
			expect(agadeem?.setCode).toBe("ZNR");
		});

		it("parses SIDEBOARD: section", () => {
			const text = readFixture("moxfield", "pedh-with-sideboard.txt");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// Has mainboard and sideboard, no commander section (Hamza is in mainboard)
			// Mainboard includes 11 Forest + 6 Plains + other cards = 100
			expect(countCards(result.mainboard)).toBe(100);
			expect(countCards(result.sideboard)).toBe(14);
			expect(result.commander).toHaveLength(0);

			// Check specific mainboard card with split name
			const badger = result.mainboard.find((c) =>
				c.name.includes("Colossal Badger"),
			);
			expect(badger?.name).toBe("Colossal Badger / Dig Deep");
			expect(badger?.setCode).toBe("CLB");
			expect(badger?.collectorNumber).toBe("223");

			// Check sideboard card
			const farseek = result.sideboard.find((c) => c.name === "Farseek");
			expect(farseek).toBeDefined();
			expect(farseek?.setCode).toBe("BLC");
		});

		it("preserves tags including multi-word tags", () => {
			const text = readFixture("moxfield", "bulk-edit-with-tags.txt");
			const result = parseDeck(text);

			// Check single-word tag with ! prefix (global)
			const signet = result.mainboard.find((c) =>
				c.name.includes("Arcane Signet"),
			);
			expect(signet?.tags).toContain("ramp");

			// Check multi-word tag
			const dragonborn = result.mainboard.find((c) =>
				c.name.includes("Ambitious Dragonborn"),
			);
			expect(dragonborn?.tags).toContain("payoffs / big creatures");

			// Check card with multiple tags
			const badger = result.mainboard.find((c) =>
				c.name.includes("Colossal Badger"),
			);
			expect(badger?.tags).toContain("counters");
			expect(badger?.tags).toContain("payoffs / big creatures");

			// Card without tags should have empty array
			const treeline = result.mainboard.find((c) =>
				c.name.includes("Arctic Treeline"),
			);
			expect(treeline?.tags).toEqual([]);
		});
	});

	describe("Archidekt format", () => {
		it("parses Archidekt with inline section markers", () => {
			const text = readFixture("archidekt", "txt-with-categories.txt");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// Verify total card counts based on inline [Sideboard], [Commander{top}], [Maybeboard{...}]
			// When multiple sections in one marker, last wins (e.g. [Maybeboard,Sideboard] → sideboard)
			expect(countCards(result.commander)).toBe(1);
			expect(countCards(result.mainboard)).toBe(96);
			expect(countCards(result.sideboard)).toBe(23);
			expect(countCards(result.maybeboard)).toBe(25);
			// Total: 145 cards

			// Commander identified by [Commander{top}] marker
			expect(result.commander[0].name).toBe("Tifa Lockhart");
		});
	});

	describe("Deckstats format", () => {
		it("parses Deckstats with //Section comments", () => {
			const text = readFixture("deckstats", "commander-with-categories.dec");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// Commander from # !Commander marker, rest in mainboard categories
			// Fixture has 157 cards total (not a legal 100-card commander deck)
			expect(countCards(result.commander)).toBe(1);
			expect(countCards(result.mainboard)).toBe(156);
			expect(countCards(result.sideboard)).toBe(0);
			expect(result.commander[0].name).toBe("Black Waltz No. 3");
		});
	});

	describe("MTGGoldfish format", () => {
		it("parses simple format with blank line sideboard separator", () => {
			const text = readFixture("mtggoldfish", "simple.txt");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// 60-card main + 15-card sideboard
			expect(countCards(result.mainboard)).toBe(60);
			expect(countCards(result.sideboard)).toBe(15);
		});

		it("parses exact versions with [SET] markers", () => {
			const text = readFixture("mtggoldfish", "exact-versions.txt");
			const result = parseDeck(text);

			const countCards = (cards: { quantity: number }[]) =>
				cards.reduce((sum, c) => sum + c.quantity, 0);

			// Same deck with set codes
			expect(countCards(result.mainboard)).toBe(60);
			expect(countCards(result.sideboard)).toBe(15);

			// Check set codes were parsed
			const cardWithSet = result.mainboard.find((c) => c.setCode);
			expect(cardWithSet?.setCode).toBeDefined();
		});
	});

	describe("edge cases", () => {
		it("handles empty input", () => {
			const result = parseDeck("");
			expect(result.mainboard).toHaveLength(0);
			expect(result.sideboard).toHaveLength(0);
		});

		it("handles mixed case set codes", () => {
			const text = readFixture("edge-cases", "mixed-case.txt");
			const result = parseDeck(text);

			expect(result.mainboard).toHaveLength(4);

			// All set codes should be normalized to uppercase
			for (const card of result.mainboard) {
				if (card.setCode) {
					expect(card.setCode).toBe(card.setCode.toUpperCase());
				}
			}
		});

		it("handles split cards", () => {
			const text = readFixture("edge-cases", "split-cards.txt");
			const result = parseDeck(text);

			expect(result.mainboard).toHaveLength(6);
			expect(result.mainboard.some((c) => c.name.includes("//"))).toBe(true);
			expect(result.mainboard.some((c) => c.name.includes("/"))).toBe(true);
		});

		it("handles minimal card list (names only)", () => {
			const text = readFixture("edge-cases", "minimal.txt");
			const result = parseDeck(text);

			expect(result.mainboard).toHaveLength(5);
			// All should default to quantity 1
			expect(result.mainboard.every((c) => c.quantity === 1)).toBe(true);
		});
	});

	describe("quantity edge cases", () => {
		it("treats quantity 0 as skipping the line", () => {
			const result = parseCardLine("0 Lightning Bolt");
			// quantity 0 should still parse but with qty clamped to 1
			expect(result?.quantity).toBe(1);
		});

		it("handles leading zeros in quantity", () => {
			const result = parseCardLine("04 Lightning Bolt");
			expect(result?.quantity).toBe(4);
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("handles very large quantities", () => {
			const result = parseCardLine("9999 Relentless Rats");
			expect(result?.quantity).toBe(9999);
			expect(result?.name).toBe("Relentless Rats");
		});

		it("defaults to 1 for non-numeric start", () => {
			const result = parseCardLine("Lightning Bolt");
			expect(result?.quantity).toBe(1);
		});
	});

	describe("section handling edge cases", () => {
		it("handles multiple consecutive blank lines", () => {
			const text = `Deck
4 Lightning Bolt


Sideboard
2 Pyroblast`;

			const result = parseDeck(text);
			expect(result.mainboard).toHaveLength(1);
			expect(result.sideboard).toHaveLength(1);
		});

		it("puts cards before any section header into mainboard", () => {
			const text = `4 Lightning Bolt
2 Counterspell

Sideboard
1 Pyroblast`;

			const result = parseDeck(text);
			expect(result.mainboard).toHaveLength(2);
			expect(result.sideboard).toHaveLength(1);
		});

		it("handles duplicate section markers", () => {
			const text = `Deck
4 Lightning Bolt

Deck
2 Counterspell

Sideboard
1 Pyroblast`;

			const result = parseDeck(text);
			// Both Deck sections should go to mainboard
			expect(result.mainboard).toHaveLength(2);
			expect(result.sideboard).toHaveLength(1);
		});

		it("handles section headers with trailing whitespace", () => {
			const text = `Sideboard
1 Pyroblast`;

			const result = parseDeck(text);
			expect(result.sideboard).toHaveLength(1);
		});

		it("does not confuse card names with section headers", () => {
			// Hypothetical card named "Deck" or containing "Sideboard"
			const text = `1 Deck of Many Things
1 Sideboard Strategist`;

			const result = parseDeck(text);
			expect(result.mainboard).toHaveLength(2);
			expect(result.mainboard[0].name).toBe("Deck of Many Things");
			expect(result.mainboard[1].name).toBe("Sideboard Strategist");
		});
	});

	describe("collector number edge cases", () => {
		it("parses collector numbers with letter suffixes", () => {
			const result = parseCardLine("1 Night Soil (FEM) 71b");
			expect(result?.collectorNumber).toBe("71b");
			expect(result?.setCode).toBe("FEM");
		});

		it("parses promo set codes like PLST", () => {
			const result = parseCardLine("1 Citanul Woodreaders (PLST) DDR-4");
			expect(result?.setCode).toBe("PLST");
			expect(result?.collectorNumber).toBe("DDR-4");
		});

		it("parses star collector numbers", () => {
			const result = parseCardLine("1 Lightning Bolt (STA) 62★");
			expect(result?.collectorNumber).toBe("62★");
		});

		it("parses collector numbers with p suffix (promo)", () => {
			const result = parseCardLine("1 Blazemire Verge (PDSK) 256p");
			expect(result?.collectorNumber).toBe("256p");
			expect(result?.setCode).toBe("PDSK");
		});
	});

	describe("malformed input", () => {
		it("returns null for lines that are just numbers", () => {
			expect(parseCardLine("4")).toBeNull();
			expect(parseCardLine("100")).toBeNull();
			expect(parseCardLine("4x")).toBeNull();
		});

		it("handles lines with only whitespace", () => {
			const result = parseCardLine("   ");
			expect(result).toBeNull();
		});

		it("handles tab characters", () => {
			const result = parseCardLine("4\tLightning Bolt");
			expect(result?.quantity).toBe(4);
			expect(result?.name).toBe("Lightning Bolt");
		});

		it("parses partial format (quantity and name only)", () => {
			const text = `4 Lightning Bolt
2 Counterspell (
1 Sol Ring`;

			const result = parseDeck(text);
			expect(result.mainboard).toHaveLength(3);
			// Malformed "(", line should still parse somehow
			expect(result.mainboard[1].name).toContain("Counterspell");
		});
	});

	describe("format conflict resolution", () => {
		it("handles deck with both [SET] and #tags (with mtggoldfish hint)", () => {
			// [SET] is MTGGoldfish style, #tags is Moxfield style
			// Without a hint, [SET] gets treated as category tag
			// With mtggoldfish hint, brackets are preserved as set codes
			const text = `4 Lightning Bolt [2XM] #removal
2 Counterspell [IMA] #counter`;

			const result = parseDeck(text, { format: "mtggoldfish" });
			expect(result.mainboard).toHaveLength(2);

			const bolt = result.mainboard[0];
			expect(bolt.name).toBe("Lightning Bolt");
			expect(bolt.setCode).toBe("2XM");
			expect(bolt.tags).toContain("removal");
		});

		it("handles deck with (SET) and #tags together", () => {
			const text = `1 Sol Ring (CMM) 647 #ramp #staple`;

			const result = parseDeck(text);
			expect(result.mainboard[0].setCode).toBe("CMM");
			expect(result.mainboard[0].collectorNumber).toBe("647");
			expect(result.mainboard[0].tags).toEqual(["ramp", "staple"]);
		});
	});

	describe("card name edge cases", () => {
		it("parses cards with commas in name", () => {
			const result = parseCardLine("1 Ach! Hans, Run!");
			expect(result?.name).toBe("Ach! Hans, Run!");
		});

		it("parses cards with apostrophes", () => {
			const result = parseCardLine("1 Agadeem's Awakening (ZNR) 90");
			expect(result?.name).toBe("Agadeem's Awakening");
		});

		it("parses cards with + in name", () => {
			const result = parseCardLine("4 +2 Mace (AFR) 1");
			expect(result?.name).toBe("+2 Mace");
		});

		it("parses cards starting with numbers", () => {
			// Real card: "1996 World Champion"
			const result = parseCardLine("1 1996 World Champion");
			expect(result?.quantity).toBe(1);
			expect(result?.name).toBe("1996 World Champion");
		});

		it("handles very long card names", () => {
			const result = parseCardLine(
				"1 Asmoranomardicadaistinaculdacar (MH2) 186",
			);
			expect(result?.name).toBe("Asmoranomardicadaistinaculdacar");
			expect(result?.setCode).toBe("MH2");
		});
	});
});
