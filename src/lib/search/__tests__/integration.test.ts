import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "../../__tests__/test-card-lookup";
import type { Card } from "../../scryfall-types";
import { search } from "../index";

describe("Scryfall search integration", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	describe("name matching", () => {
		it("matches bare word against name", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("bolt");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("matches quoted phrase", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search('"Lightning Bolt"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("matches exact name with !", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search('!"Lightning Bolt"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}

			// Partial shouldn't match
			const partial = search("!Lightning");
			expect(partial.ok).toBe(true);
			if (partial.ok) {
				expect(partial.value.match(bolt)).toBe(false);
			}
		});

		it("matches regex against name", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("/^lightning/i");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("matches names with diacritics using ASCII equivalents", async () => {
			const nazgul = await cards.get("Nazgûl");

			// Should match without the diacritic
			const withoutDiacritic = search("nazgul");
			expect(withoutDiacritic.ok).toBe(true);
			if (withoutDiacritic.ok) {
				expect(withoutDiacritic.value.match(nazgul)).toBe(true);
			}

			// Should also match with the diacritic
			const withDiacritic = search("nazgûl");
			expect(withDiacritic.ok).toBe(true);
			if (withDiacritic.ok) {
				expect(withDiacritic.value.match(nazgul)).toBe(true);
			}
		});

		it("exact name match works with diacritics", async () => {
			const nazgul = await cards.get("Nazgûl");

			// ASCII equivalent should match exactly
			const ascii = search('!"Nazgul"');
			expect(ascii.ok).toBe(true);
			if (ascii.ok) {
				expect(ascii.value.match(nazgul)).toBe(true);
			}

			// With diacritic should also match
			const diacritic = search('!"Nazgûl"');
			expect(diacritic.ok).toBe(true);
			if (diacritic.ok) {
				expect(diacritic.value.match(nazgul)).toBe(true);
			}
		});
	});

	describe("type matching", () => {
		it("t: matches type line", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			const instant = search("t:instant");
			expect(instant.ok).toBe(true);
			if (instant.ok) {
				expect(instant.value.match(bolt)).toBe(true);
				expect(instant.value.match(elves)).toBe(false);
			}

			const creature = search("t:creature");
			expect(creature.ok).toBe(true);
			if (creature.ok) {
				expect(creature.value.match(elves)).toBe(true);
				expect(creature.value.match(bolt)).toBe(false);
			}
		});

		it("t: matches subtypes", async () => {
			const elves = await cards.get("Llanowar Elves");
			const result = search("t:elf");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});
	});

	describe("oracle text matching", () => {
		it("o: matches oracle text", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("o:damage");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("o: with regex", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("o:/deals? \\d+ damage/i");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});
	});

	describe("color matching", () => {
		it("c: matches colors", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("c:r");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("c= matches exact colors", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const exact = search("c=r");
			expect(exact.ok).toBe(true);
			if (exact.ok) {
				expect(exact.value.match(bolt)).toBe(true);
			}

			// Bolt shouldn't match multicolor
			const multi = search("c=rg");
			expect(multi.ok).toBe(true);
			if (multi.ok) {
				expect(multi.value.match(bolt)).toBe(false);
			}
		});

		it("c!= excludes exact color", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			// Exclude mono-red
			const notRed = search("c!=r");
			expect(notRed.ok).toBe(true);
			if (notRed.ok) {
				expect(notRed.value.match(bolt)).toBe(false); // R = R, excluded
				expect(notRed.value.match(elves)).toBe(true); // G != R, included
			}
		});

		it("c: uses superset semantics (at least these colors)", async () => {
			const bolt = await cards.get("Lightning Bolt"); // R
			const bte = await cards.get("Burning-Tree Emissary"); // RG

			// c:r means "at least red" - matches mono-R and multicolor with R
			const atLeastRed = search("c:r");
			expect(atLeastRed.ok).toBe(true);
			if (atLeastRed.ok) {
				expect(atLeastRed.value.match(bolt)).toBe(true); // R contains R
				expect(atLeastRed.value.match(bte)).toBe(true); // RG contains R
			}

			// c:rg means "at least RG" - only matches cards with both
			const atLeastGruul = search("c:rg");
			expect(atLeastGruul.ok).toBe(true);
			if (atLeastGruul.ok) {
				expect(atLeastGruul.value.match(bolt)).toBe(false); // R doesn't contain G
				expect(atLeastGruul.value.match(bte)).toBe(true); // RG contains RG
			}
		});

		it("c: differs from id: (color vs color identity)", async () => {
			const forest = await cards.get("Forest");

			// Forest is colorless (no colored mana in cost)
			const colorless = search("c:c");
			expect(colorless.ok).toBe(true);
			if (colorless.ok) {
				expect(colorless.value.match(forest)).toBe(true);
			}

			// But Forest has green color identity (produces green mana)
			const greenIdentity = search("id:g");
			expect(greenIdentity.ok).toBe(true);
			if (greenIdentity.ok) {
				expect(greenIdentity.value.match(forest)).toBe(true);
			}

			// Forest is NOT green by color
			const greenColor = search("c:g");
			expect(greenColor.ok).toBe(true);
			if (greenColor.ok) {
				expect(greenColor.value.match(forest)).toBe(false);
			}
		});
	});

	describe("color identity matching", () => {
		it("id: uses subset semantics (commander deckbuilding)", async () => {
			const bolt = await cards.get("Lightning Bolt"); // R
			const elves = await cards.get("Llanowar Elves"); // G
			const bte = await cards.get("Burning-Tree Emissary"); // RG

			// id:rg means "identity fits in Gruul" (subset)
			const gruul = search("id:rg");
			expect(gruul.ok).toBe(true);
			if (gruul.ok) {
				expect(gruul.value.match(bolt)).toBe(true); // R fits in RG
				expect(gruul.value.match(elves)).toBe(true); // G fits in RG
				expect(gruul.value.match(bte)).toBe(true); // RG fits in RG
			}

			// id:r should NOT match BTE (RG doesn't fit in mono-R)
			const monoRed = search("id:r");
			expect(monoRed.ok).toBe(true);
			if (monoRed.ok) {
				expect(monoRed.value.match(bolt)).toBe(true); // R fits in R
				expect(monoRed.value.match(bte)).toBe(false); // RG doesn't fit in R
			}

			// id>=rg means "identity contains at least RG" (superset)
			const atLeastGruul = search("id>=rg");
			expect(atLeastGruul.ok).toBe(true);
			if (atLeastGruul.ok) {
				expect(atLeastGruul.value.match(bolt)).toBe(false); // R doesn't contain G
				expect(atLeastGruul.value.match(elves)).toBe(false); // G doesn't contain R
				expect(atLeastGruul.value.match(bte)).toBe(true); // RG contains RG
			}
		});

		it("id<= matches subset (commander deckbuilding)", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");
			const forest = await cards.get("Forest");

			// Gruul deck can play red and green cards
			const gruul = search("id<=rg");
			expect(gruul.ok).toBe(true);
			if (gruul.ok) {
				expect(gruul.value.match(bolt)).toBe(true); // R fits in RG
				expect(gruul.value.match(elves)).toBe(true); // G fits in RG
				expect(gruul.value.match(forest)).toBe(true); // Colorless fits
			}

			// Simic deck can't play red
			const simic = search("id<=ug");
			expect(simic.ok).toBe(true);
			if (simic.ok) {
				expect(simic.value.match(bolt)).toBe(false); // R doesn't fit
				expect(simic.value.match(elves)).toBe(true); // G fits
			}
		});

		it("id!= excludes exact color identity", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			// Exclude mono-red identity
			const notRed = search("id!=r");
			expect(notRed.ok).toBe(true);
			if (notRed.ok) {
				expect(notRed.value.match(bolt)).toBe(false); // R = R, excluded
				expect(notRed.value.match(elves)).toBe(true); // G != R, included
			}

			// Exclude mono-green identity
			const notGreen = search("id!=g");
			expect(notGreen.ok).toBe(true);
			if (notGreen.ok) {
				expect(notGreen.value.match(bolt)).toBe(true); // R != G, included
				expect(notGreen.value.match(elves)).toBe(false); // G = G, excluded
			}
		});
	});

	describe("color identity count matching", () => {
		const mockColorless = { color_identity: [] as string[] } as Card;
		const mockMono = { color_identity: ["R"] } as Card;
		const mockTwoColor = { color_identity: ["U", "R"] } as Card;
		const mockThreeColor = { color_identity: ["W", "U", "B"] } as Card;
		const mockFiveColor = {
			color_identity: ["W", "U", "B", "R", "G"],
		} as Card;

		it.each([
			["id=0", mockColorless, true],
			["id=0", mockMono, false],
			["id=1", mockMono, true],
			["id=1", mockTwoColor, false],
			["id=2", mockTwoColor, true],
			["id=3", mockThreeColor, true],
			["id=5", mockFiveColor, true],
		])(
			"%s matches card with %d identity colors: %s",
			(query, card, expected) => {
				const result = search(query);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.match(card)).toBe(expected);
				}
			},
		);

		it.each([
			["id>0", mockColorless, false],
			["id>0", mockMono, true],
			["id>1", mockMono, false],
			["id>1", mockTwoColor, true],
			["id>2", mockThreeColor, true],
		])("%s (more than N colors) matches correctly", (query, card, expected) => {
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});

		it.each([
			["id<1", mockColorless, true],
			["id<1", mockMono, false],
			["id<2", mockMono, true],
			["id<2", mockTwoColor, false],
			["id<3", mockTwoColor, true],
		])(
			"%s (fewer than N colors) matches correctly",
			(query, card, expected) => {
				const result = search(query);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.match(card)).toBe(expected);
				}
			},
		);

		it.each([
			["id>=1", mockColorless, false],
			["id>=1", mockMono, true],
			["id>=2", mockMono, false],
			["id>=2", mockTwoColor, true],
			["id<=2", mockThreeColor, false],
			["id<=3", mockThreeColor, true],
		])(
			"%s (N or more/fewer colors) matches correctly",
			(query, card, expected) => {
				const result = search(query);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.match(card)).toBe(expected);
				}
			},
		);

		it.each([
			["id!=1", mockMono, false],
			["id!=1", mockTwoColor, true],
			["id!=2", mockTwoColor, false],
		])(
			"%s (not exactly N colors) matches correctly",
			(query, card, expected) => {
				const result = search(query);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.match(card)).toBe(expected);
				}
			},
		);
	});

	describe("mana value matching", () => {
		it.each([
			["cmc=1", "Lightning Bolt", true],
			["cmc>0", "Lightning Bolt", true],
			["cmc>=2", "Lightning Bolt", false],
			["cmc<=3", "Llanowar Elves", true],
			["mv=1", "Sol Ring", true],
		])("%s matches %s: %s", async (query, cardName, expected) => {
			const card = await cards.get(cardName);
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});
	});

	describe("format legality", () => {
		it("f: matches format legality", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const ring = await cards.get("Sol Ring");

			const modern = search("f:modern");
			expect(modern.ok).toBe(true);
			if (modern.ok) {
				expect(modern.value.match(bolt)).toBe(true);
			}

			const commander = search("f:commander");
			expect(commander.ok).toBe(true);
			if (commander.ok) {
				expect(commander.value.match(ring)).toBe(true);
			}
		});
	});

	describe("is: predicates", () => {
		it("is:creature matches creatures", async () => {
			const elves = await cards.get("Llanowar Elves");
			const bolt = await cards.get("Lightning Bolt");

			const result = search("is:creature");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
				expect(result.value.match(bolt)).toBe(false);
			}
		});

		it("is:instant matches instants", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const result = search("is:instant");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("is:legendary matches legendary", async () => {
			const elves = await cards.get("Llanowar Elves");
			const result = search("is:legendary");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(false);
			}
		});
	});

	describe("boolean operators", () => {
		it("implicit AND", async () => {
			const elves = await cards.get("Llanowar Elves");
			const result = search("t:creature c:g");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});

		it("explicit OR", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			const result = search("t:instant or t:creature");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
				expect(result.value.match(elves)).toBe(true);
			}
		});

		it("NOT with -", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			const result = search("-t:creature");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
				expect(result.value.match(elves)).toBe(false);
			}
		});

		it("parentheses for grouping", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("(t:instant or t:sorcery) c:r");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});
	});

	describe("rarity matching", () => {
		// Use mock cards with explicit rarities to avoid canonical printing variance
		const mockCommon = { rarity: "common" } as Card;
		const mockUncommon = { rarity: "uncommon" } as Card;
		const mockRare = { rarity: "rare" } as Card;
		const mockMythic = { rarity: "mythic" } as Card;

		it.each([
			["r:c", mockCommon, true],
			["r:c", mockUncommon, false],
			["r:common", mockCommon, true],
			["r:u", mockUncommon, true],
			["r:uncommon", mockUncommon, true],
			["r:r", mockRare, true],
			["r:rare", mockRare, true],
			["r:m", mockMythic, true],
			["r:mythic", mockMythic, true],
		])("%s matches %s rarity: %s", (query, card, expected) => {
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});

		it.each([
			["r>=c", mockCommon, true],
			["r>=c", mockUncommon, true],
			["r>=c", mockRare, true],
			["r>=u", mockCommon, false],
			["r>=u", mockUncommon, true],
			["r>=u", mockRare, true],
			["r>=r", mockUncommon, false],
			["r>=r", mockRare, true],
			["r>=r", mockMythic, true],
		])("%s matches %s rarity: %s", (query, card, expected) => {
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});

		it.each([
			["r<=m", mockMythic, true],
			["r<=m", mockRare, true],
			["r<=r", mockRare, true],
			["r<=r", mockMythic, false],
			["r<=u", mockUncommon, true],
			["r<=u", mockRare, false],
			["r<=c", mockCommon, true],
			["r<=c", mockUncommon, false],
		])("%s matches %s rarity: %s", (query, card, expected) => {
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});

		it.each([
			["r>c", mockCommon, false],
			["r>c", mockUncommon, true],
			["r<u", mockCommon, true],
			["r<u", mockUncommon, false],
		])("%s matches %s rarity: %s", (query, card, expected) => {
			const result = search(query);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(expected);
			}
		});

		it("r!=c excludes common", () => {
			const result = search("r!=c");
			if (!result.ok) {
				console.log("Parse error:", result.error);
			}
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockCommon)).toBe(false);
				expect(result.value.match(mockUncommon)).toBe(true);
			}
		});
	});

	describe("in: matching (game, set type, set, language)", () => {
		const mockPaperCard = {
			games: ["paper", "mtgo"],
			set: "lea",
			set_type: "expansion",
			lang: "en",
		} as Card;
		const mockArenaCard = {
			games: ["arena"],
			set: "afr",
			set_type: "expansion",
			lang: "en",
		} as Card;
		const mockCommanderCard = {
			games: ["paper"],
			set: "cmr",
			set_type: "commander",
			lang: "en",
		} as Card;
		const mockJapaneseCard = {
			games: ["paper"],
			set: "sta",
			set_type: "expansion",
			lang: "ja",
		} as Card;

		it("in:paper matches paper games", () => {
			const result = search("in:paper");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockPaperCard)).toBe(true);
				expect(result.value.match(mockArenaCard)).toBe(false);
			}
		});

		it("in:arena matches arena games", () => {
			const result = search("in:arena");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockArenaCard)).toBe(true);
				expect(result.value.match(mockPaperCard)).toBe(false);
			}
		});

		it("in:mtgo matches mtgo games", () => {
			const result = search("in:mtgo");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockPaperCard)).toBe(true);
				expect(result.value.match(mockArenaCard)).toBe(false);
			}
		});

		it("in:commander matches commander set type", () => {
			const result = search("in:commander");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockCommanderCard)).toBe(true);
				expect(result.value.match(mockPaperCard)).toBe(false);
			}
		});

		it("in:expansion matches expansion set type", () => {
			const result = search("in:expansion");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockPaperCard)).toBe(true);
				expect(result.value.match(mockCommanderCard)).toBe(false);
			}
		});

		it("in:<set> matches set code", () => {
			const result = search("in:lea");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockPaperCard)).toBe(true);
				expect(result.value.match(mockArenaCard)).toBe(false);
			}
		});

		it("in:<lang> matches language", () => {
			const result = search("in:ja");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockJapaneseCard)).toBe(true);
				expect(result.value.match(mockPaperCard)).toBe(false);
			}
		});

		it("-in:paper excludes paper cards", () => {
			const result = search("-in:paper");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mockPaperCard)).toBe(false);
				expect(result.value.match(mockArenaCard)).toBe(true);
			}
		});
	});

	describe("set: arena code normalization", () => {
		const domCard = { set: "dom" } as Card;
		const dd1Card = { set: "dd1" } as Card;
		const evgCard = { set: "evg" } as Card;

		it("set:dar finds Dominaria (dom) cards", () => {
			// "dar" is Arena's code for Dominaria
			const result = search("set:dar");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(domCard)).toBe(true);
			}
		});

		it("set:dom still works directly", () => {
			const result = search("set:dom");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(domCard)).toBe(true);
			}
		});

		it("set:evg finds Anthology (evg), not dd1", () => {
			// "evg" is shadowed - Arena uses it for dd1, but Scryfall has its own evg set
			// We should NOT map it to dd1 in search to avoid hiding paper set
			const result = search("set:evg");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(evgCard)).toBe(true);
				expect(result.value.match(dd1Card)).toBe(false);
			}
		});

		it("in:dar also normalizes arena codes", () => {
			const result = search("in:dar");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(domCard)).toBe(true);
			}
		});
	});

	describe("complex queries", () => {
		it("commander deckbuilding query", async () => {
			const elves = await cards.get("Llanowar Elves");

			// Find green creatures with cmc <= 2 for a Golgari commander deck
			const result = search("t:creature id<=bg cmc<=2");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});

		it("negated color with type", async () => {
			const bolt = await cards.get("Lightning Bolt");
			const elves = await cards.get("Llanowar Elves");

			// Red non-creatures
			const result = search("c:r -t:creature");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
				expect(result.value.match(elves)).toBe(false);
			}
		});
	});
});
