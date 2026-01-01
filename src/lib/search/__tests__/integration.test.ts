import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "../../__tests__/test-card-lookup";
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
	});

	describe("color identity matching", () => {
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
