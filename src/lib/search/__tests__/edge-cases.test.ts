import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "../../__tests__/test-card-lookup";
import { search } from "../index";

describe("Scryfall search edge cases", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	describe("power/toughness edge cases", () => {
		it("matches * power exactly", async () => {
			const tarmogoyf = await cards.get("Tarmogoyf");
			expect(tarmogoyf.power).toBe("*");

			const result = search("pow=*");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(tarmogoyf)).toBe(true);
			}
		});

		it("matches 1+* toughness (contains *)", async () => {
			const tarmogoyf = await cards.get("Tarmogoyf");
			expect(tarmogoyf.toughness).toBe("1+*");

			const result = search("tou=*");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should match because toughness contains *
				expect(result.value.match(tarmogoyf)).toBe(true);
			}
		});

		it("treats * as 0 for numeric comparisons", async () => {
			const tarmogoyf = await cards.get("Tarmogoyf");

			const result = search("pow<=0");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// * is treated as 0
				expect(result.value.match(tarmogoyf)).toBe(true);
			}

			const gtZero = search("pow>0");
			expect(gtZero.ok).toBe(true);
			if (gtZero.ok) {
				expect(gtZero.value.match(tarmogoyf)).toBe(false);
			}
		});

		it("handles fractional power/toughness", async () => {
			const littleGirl = await cards.get("Little Girl");
			// Scryfall stores ".5" not "0.5"
			expect(littleGirl.power).toBe(".5");
			expect(littleGirl.toughness).toBe(".5");

			// parseFloat handles ".5" correctly as 0.5
			const exactHalf = search("pow=0.5");
			expect(exactHalf.ok).toBe(true);
			if (exactHalf.ok) {
				expect(exactHalf.value.match(littleGirl)).toBe(true);
			}

			// Comparison with decimal
			const ltOne = search("pow<1");
			expect(ltOne.ok).toBe(true);
			if (ltOne.ok) {
				expect(ltOne.value.match(littleGirl)).toBe(true);
			}

			const gtZero = search("pow>0");
			expect(gtZero.ok).toBe(true);
			if (gtZero.ok) {
				expect(gtZero.value.match(littleGirl)).toBe(true);
			}
		});
	});

	describe("mana value edge cases", () => {
		it("handles fractional CMC", async () => {
			const littleGirl = await cards.get("Little Girl");
			expect(littleGirl.cmc).toBe(0.5);

			const exactHalf = search("cmc=0.5");
			expect(exactHalf.ok).toBe(true);
			if (exactHalf.ok) {
				expect(exactHalf.value.match(littleGirl)).toBe(true);
			}

			const ltOne = search("cmc<1");
			expect(ltOne.ok).toBe(true);
			if (ltOne.ok) {
				expect(ltOne.value.match(littleGirl)).toBe(true);
			}
		});

		it("handles X spells (X doesn't add to CMC)", async () => {
			const fireball = await cards.get("Fireball");
			expect(fireball.mana_cost).toContain("X");

			// Fireball is {X}{R}, CMC = 1
			const cmcOne = search("cmc=1");
			expect(cmcOne.ok).toBe(true);
			if (cmcOne.ok) {
				expect(cmcOne.value.match(fireball)).toBe(true);
			}
		});
	});

	describe("mana cost matching", () => {
		it("m: matches mana cost substring", async () => {
			const apostle = await cards.get("Apostle's Blessing");
			expect(apostle.mana_cost).toBe("{1}{W/P}");

			// Phyrexian mana symbol matching - braces included like Scryfall
			const result = search("m:{W/P}");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(apostle)).toBe(true);
			}
		});

		it("m: matches snow mana", async () => {
			const astrolabe = await cards.get("Arcum's Astrolabe");
			expect(astrolabe.mana_cost).toBe("{S}");

			const result = search("m:S");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(astrolabe)).toBe(true);
			}
		});

		it("m: matches X in cost", async () => {
			const fireball = await cards.get("Fireball");

			const result = search("m:X");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(fireball)).toBe(true);
			}
		});
	});

	describe("is:snow predicate", () => {
		it("matches snow permanents", async () => {
			const snowForest = await cards.get("Snow-Covered Forest");
			expect(snowForest.type_line).toContain("Snow");

			const result = search("is:snow");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(snowForest)).toBe(true);
			}
		});

		it("does not match non-snow cards", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("is:snow");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});

	describe("colorless identity", () => {
		it("id:c matches colorless identity cards", async () => {
			const ornithopter = await cards.get("Ornithopter");
			expect(ornithopter.color_identity).toEqual([]);

			const result = search("id:c");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(ornithopter)).toBe(true);
			}
		});

		it("id<=c matches only colorless cards", async () => {
			const ornithopter = await cards.get("Ornithopter");
			const bolt = await cards.get("Lightning Bolt");

			const result = search("id<=c");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(ornithopter)).toBe(true);
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});

	describe("is:historic predicate", () => {
		it("matches legendary permanents", async () => {
			const bosh = await cards.get("Bosh, Iron Golem");
			expect(bosh.type_line).toContain("Legendary");

			const result = search("is:historic");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bosh)).toBe(true);
			}
		});

		it("matches artifacts", async () => {
			const solRing = await cards.get("Sol Ring");
			expect(solRing.type_line).toContain("Artifact");

			const result = search("is:historic");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(solRing)).toBe(true);
			}
		});

		it("does not match non-historic cards", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("is:historic");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});

	describe("complex mana and color queries", () => {
		it("Phyrexian mana cards are in the color's identity", async () => {
			const apostle = await cards.get("Apostle's Blessing");
			// W/P adds W to color identity even though it can be paid with life
			expect(apostle.color_identity).toContain("W");

			const whiteId = search("id:w");
			expect(whiteId.ok).toBe(true);
			if (whiteId.ok) {
				expect(whiteId.value.match(apostle)).toBe(true);
			}
		});
	});

	describe("loyalty matching", () => {
		it("matches planeswalker loyalty", async () => {
			const bolas = await cards.get("Nicol Bolas, Planeswalker");
			expect(bolas.loyalty).toBeDefined();

			const result = search("loy>=5");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolas)).toBe(true);
			}
		});

		it("non-planeswalkers have no loyalty", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("loy>0");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});

	describe("multi-face cards", () => {
		it("searches oracle text across faces", async () => {
			const delver = await cards.get("Delver of Secrets");
			// Delver transforms into Insectile Aberration

			// Should match front face
			const front = search('o:"Look at the top card"');
			expect(front.ok).toBe(true);
			if (front.ok) {
				expect(front.value.match(delver)).toBe(true);
			}
		});

		it("is:transform matches transform cards", async () => {
			const delver = await cards.get("Delver of Secrets");
			const bolt = await cards.get("Lightning Bolt");

			const result = search("is:transform");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(delver)).toBe(true);
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});

	describe("regex edge cases", () => {
		it("regex at start of query works", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("/^lightning/i");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("regex after field works", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("o:/\\d+ damage/");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("invalid regex returns error", () => {
			const result = search("/[invalid/");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Invalid regex");
			}
		});
	});

	describe("produces: mana production", () => {
		it("matches cards that produce mana", async () => {
			const solRing = await cards.get("Sol Ring");
			expect(solRing.produced_mana).toContain("C");

			const result = search("produces:c");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(solRing)).toBe(true);
			}
		});

		it("non-mana-producers don't match", async () => {
			const bolt = await cards.get("Lightning Bolt");

			const result = search("produces:r");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(false);
			}
		});
	});
});
