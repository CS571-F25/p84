import { beforeAll, describe, expect, it } from "vitest";
import { mockFetchFromPublicDir } from "../../lib/__tests__/test-helpers";
import { __CardsWorkerForTestingOnly as CardsWorker } from "../cards.worker";

describe("CardsWorker syntaxSearch", () => {
	let worker: CardsWorker;

	beforeAll(async () => {
		mockFetchFromPublicDir();

		worker = new CardsWorker();
		await worker.initialize();
	}, 30_000);

	describe("set queries (stable across time)", () => {
		it("finds Lightning Bolt in Limited Edition Alpha", () => {
			const result = worker.syntaxSearch('s:lea !"Lightning Bolt"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Lightning Bolt");
				expect(result.cards[0].set).toBe("lea");
			}
		});

		it("finds all creatures in Alpha", () => {
			const result = worker.syntaxSearch("s:lea t:creature", 300);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(50);
				expect(
					result.cards.every((c) => c.type_line?.includes("Creature")),
				).toBe(true);
				expect(result.cards.every((c) => c.set === "lea")).toBe(true);
			}
		});

		it("finds Llanowar Elves in Alpha", () => {
			const result = worker.syntaxSearch('s:lea !"Llanowar Elves"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Llanowar Elves");
			}
		});

		it("finds Sol Ring in Unlimited", () => {
			const result = worker.syntaxSearch('s:2ed !"Sol Ring"');
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Sol Ring");
			}
		});

		it("finds all Power 9 in Alpha by name", () => {
			const power9 = [
				"Black Lotus",
				"Ancestral Recall",
				"Time Walk",
				"Mox Pearl",
				"Mox Sapphire",
				"Mox Jet",
				"Mox Ruby",
				"Mox Emerald",
				"Timetwister",
			];

			for (const cardName of power9) {
				const result = worker.syntaxSearch(`s:lea !"${cardName}"`);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.cards.length).toBe(1);
					expect(result.cards[0].name).toBe(cardName);
				}
			}
		});
	});

	describe("combined queries", () => {
		it("finds cheap red instants in Alpha", () => {
			const result = worker.syntaxSearch("s:lea t:instant c:r cmc<=2");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(0);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Instant");
					expect(card.colors).toContain("R");
					expect(card.cmc).toBeLessThanOrEqual(2);
				}
			}
		});

		it("finds green creatures with power >= 4 in Alpha", () => {
			const result = worker.syntaxSearch("s:lea t:creature c:g pow>=4");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(0);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Creature");
					expect(card.colors).toContain("G");
					const power = Number.parseInt(card.power ?? "0", 10);
					expect(power).toBeGreaterThanOrEqual(4);
				}
			}
		});

		it("finds colorless artifacts in Alpha", () => {
			const result = worker.syntaxSearch("s:lea t:artifact c=c");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Artifact");
					expect(card.colors?.length ?? 0).toBe(0);
				}
			}
		});
	});

	describe("negation queries", () => {
		it("finds non-creature spells in Alpha", () => {
			const result = worker.syntaxSearch("s:lea -t:creature -t:land", 50);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(0);
				for (const card of result.cards) {
					expect(card.type_line).not.toContain("Creature");
					expect(card.type_line).not.toContain("Land");
				}
			}
		});
	});

	describe("or queries", () => {
		it("finds instants or sorceries in Alpha", () => {
			const result = worker.syntaxSearch("s:lea (t:instant or t:sorcery)", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(20);
				for (const card of result.cards) {
					const isInstantOrSorcery =
						card.type_line?.includes("Instant") ||
						card.type_line?.includes("Sorcery");
					expect(isInstantOrSorcery).toBe(true);
				}
			}
		});
	});

	describe("error handling", () => {
		it("returns error for invalid syntax", () => {
			const result = worker.syntaxSearch("t:");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toBeDefined();
				expect(typeof result.error.start).toBe("number");
				expect(typeof result.error.end).toBe("number");
			}
		});

		it("returns empty array for empty query", () => {
			const result = worker.syntaxSearch("");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards).toEqual([]);
			}
		});

		it("returns empty array for whitespace query", () => {
			const result = worker.syntaxSearch("   ");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards).toEqual([]);
			}
		});
	});

	describe("result limiting", () => {
		it("respects maxResults parameter", () => {
			const result = worker.syntaxSearch("s:lea", 5);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(5);
			}
		});

		it("returns all matches if fewer than maxResults", () => {
			const result = worker.syntaxSearch('s:lea !"Black Lotus"', 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(1);
			}
		});
	});

	describe("deduplication", () => {
		it("returns one result per oracle_id", () => {
			// Lightning Bolt has many printings across sets
			const result = worker.syntaxSearch('!"Lightning Bolt"', 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should only have one result despite many printings
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Lightning Bolt");
			}
		});

		it("returns most canonical printing when multiple match", () => {
			// Search for rarity:common which matches many printings of Lightning Bolt
			// Should return the most canonical (English, black border, modern frame, etc.)
			const result = worker.syntaxSearch(
				'!"Lightning Bolt" rarity:common',
				100,
			);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Lightning Bolt");
				// The returned printing should be English
				expect(result.cards[0].lang).toBe("en");
			}
		});

		it("dedups across different set queries", () => {
			// Llanowar Elves appears in many sets - should only return one per oracle_id
			const result = worker.syntaxSearch('!"Llanowar Elves"', 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Only one unique card despite many printings
				expect(result.cards.length).toBe(1);
				expect(result.cards[0].name).toBe("Llanowar Elves");
			}
		});
	});

	describe("sorting", () => {
		it("sorts alphabetically by name by default", () => {
			const result = worker.syntaxSearch("s:lea t:creature", 10);
			expect(result.ok).toBe(true);
			if (result.ok) {
				const names = result.cards.map((c) => c.name);
				const sorted = [...names].sort((a, b) => a.localeCompare(b));
				expect(names).toEqual(sorted);
			}
		});

		it("sorts by mana value ascending", () => {
			const result = worker.syntaxSearch("s:lea t:creature", 20, {
				field: "mv",
				direction: "asc",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				const cmcs = result.cards.map((c) => c.cmc ?? 0);
				expect(cmcs).toEqual([...cmcs].sort((a, b) => a - b));
			}
		});

		it("sorts by mana value descending", () => {
			const result = worker.syntaxSearch("s:lea t:creature", 20, {
				field: "mv",
				direction: "desc",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				const cmcs = result.cards.map((c) => c.cmc ?? 0);
				expect(cmcs).toEqual([...cmcs].sort((a, b) => b - a));
			}
		});

		it("uses name as tiebreaker when sorting by mv", () => {
			const result = worker.syntaxSearch("s:lea cmc=1", 100, {
				field: "mv",
				direction: "asc",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				// All cards have mv=1, so should be sorted by name
				const names = result.cards.map((c) => c.name);
				const sorted = [...names].sort((a, b) => a.localeCompare(b));
				expect(names).toEqual(sorted);
			}
		});

		it("sorts by rarity descending (mythic first)", () => {
			const result = worker.syntaxSearch("s:dom rarity>=rare", 50, {
				field: "rarity",
				direction: "desc",
			});
			expect(result.ok).toBe(true);
			if (result.ok && result.cards.length > 0) {
				// Mythics should come before rares
				const mythicIndex = result.cards.findIndex(
					(c) => c.rarity === "mythic",
				);
				const lastRareIndex = result.cards.findIndex(
					(c) => c.rarity === "rare",
				);
				if (mythicIndex >= 0 && lastRareIndex >= 0) {
					expect(mythicIndex).toBeLessThan(lastRareIndex);
				}
			}
		});
	});

	describe("discrete fields", () => {
		it("layout: uses exact match, not substring", () => {
			// "token" should not match "double_faced_token"
			const result = worker.syntaxSearch("layout:token", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const card of result.cards) {
					expect(card.layout).toBe("token");
				}
			}
		});

		it("layout: with regex still works", () => {
			// Regex should match partial values
			const result = worker.syntaxSearch("layout:/dfc/", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBeGreaterThan(0);
				for (const card of result.cards) {
					expect(card.layout).toMatch(/dfc/);
				}
			}
		});

		it("set: uses exact match", () => {
			// "lea" should not match "pleaf" or similar
			const result = worker.syntaxSearch("s:lea", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const card of result.cards) {
					expect(card.set).toBe("lea");
				}
			}
		});

		it("settype: uses exact match", () => {
			const result = worker.syntaxSearch("st:core", 50);
			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const card of result.cards) {
					expect(card.set_type).toBe("core");
				}
			}
		});

		it("lang: uses exact match", () => {
			const result = worker.syntaxSearch("lang:en s:lea", 50);
			expect(result.ok).toBe(true);
			if (result.ok) {
				for (const card of result.cards) {
					expect(card.lang).toBe("en");
				}
			}
		});
	});

	describe("paginatedUnifiedSearch", () => {
		const sort = { field: "name", direction: "auto" } as const;

		it("returns totalCount and requested page", async () => {
			const result = await worker.paginatedUnifiedSearch(
				"s:lea t:creature",
				undefined,
				sort,
				0,
				10,
			);
			expect(result.totalCount).toBeGreaterThan(50);
			expect(result.cards.length).toBe(10);
			expect(result.error).toBeNull();
		});

		it("returns correct slice for offset", async () => {
			const page1 = await worker.paginatedUnifiedSearch(
				"s:lea",
				undefined,
				sort,
				0,
				10,
			);
			const page2 = await worker.paginatedUnifiedSearch(
				"s:lea",
				undefined,
				sort,
				10,
				10,
			);
			expect(page1.cards[0].id).not.toBe(page2.cards[0].id);
			expect(page1.totalCount).toBe(page2.totalCount);
		});

		it("caches results across page fetches", async () => {
			const p1 = await worker.paginatedUnifiedSearch(
				"s:lea",
				undefined,
				sort,
				0,
				10,
			);
			const p2 = await worker.paginatedUnifiedSearch(
				"s:lea",
				undefined,
				sort,
				50,
				10,
			);
			expect(p1.totalCount).toBe(p2.totalCount);
		});

		it("returns empty last page correctly", async () => {
			const result = await worker.paginatedUnifiedSearch(
				's:lea !"Lightning Bolt"',
				undefined,
				sort,
				0,
				10,
			);
			expect(result.totalCount).toBe(1);
			expect(result.cards.length).toBe(1);

			const page2 = await worker.paginatedUnifiedSearch(
				's:lea !"Lightning Bolt"',
				undefined,
				sort,
				10,
				10,
			);
			expect(page2.cards.length).toBe(0);
		});

		it("recomputes when query changes", async () => {
			await worker.paginatedUnifiedSearch("s:lea", undefined, sort, 0, 10);
			const different = await worker.paginatedUnifiedSearch(
				"s:2ed",
				undefined,
				sort,
				0,
				10,
			);
			expect(different.cards.every((c) => c.set === "2ed")).toBe(true);
		});

		it("returns mode indicator for syntax search", async () => {
			const result = await worker.paginatedUnifiedSearch(
				"s:lea t:creature",
				undefined,
				sort,
				0,
				10,
			);
			expect(result.mode).toBe("syntax");
		});

		it("returns mode indicator for fuzzy search", async () => {
			const result = await worker.paginatedUnifiedSearch(
				"lightning bolt",
				undefined,
				sort,
				0,
				10,
			);
			expect(result.mode).toBe("fuzzy");
		});

		it("returns error for invalid syntax", async () => {
			const result = await worker.paginatedUnifiedSearch(
				"t:",
				undefined,
				sort,
				0,
				10,
			);
			expect(result.error).not.toBeNull();
			expect(result.cards).toEqual([]);
			expect(result.totalCount).toBe(0);
		});
	});

	describe("land cycle counts (is: predicates)", () => {
		// These tests verify that each land cycle predicate matches exactly
		// the expected number of unique cards. The predicates use precise
		// regex patterns to match only cards in the specific cycle.

		it("is:fetchland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:fetchland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				// Verify they're all lands with the fetch pattern
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/Pay 1 life, Sacrifice/i);
				}
			}
		});

		it("is:shockland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:shockland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/pay 2 life/i);
				}
			}
		});

		it("is:dual returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:dual", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					// Duals have two basic land types
					const landTypes = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
					const typeCount = landTypes.filter((t) =>
						card.type_line?.includes(t),
					).length;
					expect(typeCount).toBeGreaterThanOrEqual(2);
				}
			}
		});

		it("is:checkland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:checkland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/unless you control/i);
				}
			}
		});

		it("is:fastland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:fastland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/two or fewer other lands/i);
				}
			}
		});

		it("is:slowland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:slowland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/two or more other lands/i);
				}
			}
		});

		it("is:painland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:painland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/deals 1 damage to you/i);
				}
			}
		});

		it("is:filterland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:filterland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					// Filter lands use hybrid mana activation
					expect(card.oracle_text).toMatch(/\{[WUBRG]\/[WUBRG]\}/i);
				}
			}
		});

		it("is:bounceland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:bounceland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/return a land/i);
				}
			}
		});

		it("is:scryland returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:scryland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/scry 1/i);
				}
			}
		});

		it("is:gainland returns exactly 15 cards (two cycles)", () => {
			const result = worker.syntaxSearch("is:gainland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(15);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/gain 1 life/i);
				}
			}
		});

		it("is:tangoland returns exactly 7 cards", () => {
			const result = worker.syntaxSearch("is:tangoland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(7);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/two or more basic/i);
				}
			}
		});

		it("is:canopyland returns exactly 6 cards", () => {
			const result = worker.syntaxSearch("is:canopyland", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(6);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					expect(card.oracle_text).toMatch(/Sacrifice this land: Draw a card/i);
				}
			}
		});

		it("is:triome returns exactly 10 cards", () => {
			const result = worker.syntaxSearch("is:triome", 100);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.cards.length).toBe(10);
				for (const card of result.cards) {
					expect(card.type_line).toContain("Land");
					// Triomes have three basic land types
					const landTypes = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
					const typeCount = landTypes.filter((t) =>
						card.type_line?.includes(t),
					).length;
					expect(typeCount).toBeGreaterThanOrEqual(3);
				}
			}
		});
	});
});
