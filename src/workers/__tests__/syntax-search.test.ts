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
});
