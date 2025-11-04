import { beforeAll, describe, expect, it } from "vitest";
import { mockFetchFromPublicDir } from "../../lib/__tests__/test-helpers";
import { __CardsWorkerForTestingOnly as CardsWorker } from "../cards.worker";

describe("CardsWorker searchCards", () => {
	let worker: CardsWorker;

	beforeAll(async () => {
		mockFetchFromPublicDir();

		worker = new CardsWorker();
		await worker.initialize();
	}, 20_000);

	it("has the same results with and without space", () => {
		const resultsA = worker.searchCards("mark")
		const resultsB = worker.searchCards("mark ")

		expect(resultsA).toEqual(resultsB)
	})
	
	describe("restrictions", () => {
		it("applies format legality restriction", () => {
			// Search for a card that's banned in some formats
			const results = worker.searchCards(
				"ancestral recall",
				{ format: "vintage" },
				10,
			);
			expect(results.length).toBeGreaterThan(0);

			// Should not find it in standard (banned)
			const standardResults = worker.searchCards(
				"ancestral recall",
				{ format: "standard" },
				10,
			);
			expect(standardResults.length).toBe(0);
		});

		it("applies color identity restriction correctly", () => {
			// Search for blue cards with blue identity restriction
			const results = worker.searchCards(
				"lightning bolt",
				{ format: "commander", colorIdentity: ["R"] },
				10,
			);
			expect(results.length).toBeGreaterThan(0);
			expect(
				results.every((c) => c.color_identity?.every((col) => col === "R")),
			).toBe(true);
		});

		it("empty color identity array filters to colorless only", () => {
			// Search with empty color identity (should only allow colorless)
			const results = worker.searchCards(
				"sol ring",
				{ format: "commander", colorIdentity: [] },
				10,
			);

			// Sol Ring is colorless, should be allowed
			expect(results.length).toBeGreaterThan(0);
			expect(results.every((c) => (c.color_identity?.length ?? 0) === 0)).toBe(
				true,
			);

			// Try to find a colored card with empty identity - should fail
			const coloredResults = worker.searchCards(
				"lightning bolt",
				{ format: "commander", colorIdentity: [] },
				10,
			);
			expect(coloredResults.length).toBe(0);
		});

		it("undefined color identity allows all colors", () => {
			// No color identity restriction should allow all colors
			const results = worker.searchCards(
				"lightning bolt",
				{ format: "commander", colorIdentity: undefined },
				10,
			);
			expect(results.length).toBeGreaterThan(0);
		});
	});
});
