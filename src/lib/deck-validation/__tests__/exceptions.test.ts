import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "@/lib/__tests__/test-card-lookup";
import { detectCopyException, getCopyLimit, isBasicLand } from "../exceptions";

describe("exceptions", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	describe("detectCopyException", () => {
		it("returns unlimited for Relentless Rats", async () => {
			const card = await cards.get("Relentless Rats");
			expect(detectCopyException(card)).toEqual({ type: "unlimited" });
		});

		it("returns unlimited for Hare Apparent", async () => {
			const card = await cards.get("Hare Apparent");
			expect(detectCopyException(card)).toEqual({ type: "unlimited" });
		});

		it("returns limited max 7 for Seven Dwarves", async () => {
			const card = await cards.get("Seven Dwarves");
			expect(detectCopyException(card)).toEqual({ type: "limited", max: 7 });
		});

		it("returns limited max 9 for Nazgûl", async () => {
			const card = await cards.get("Nazgûl");
			expect(detectCopyException(card)).toEqual({ type: "limited", max: 9 });
		});

		it("returns undefined for Sol Ring", async () => {
			const card = await cards.get("Sol Ring");
			expect(detectCopyException(card)).toBeUndefined();
		});

		it("returns undefined for basic lands", async () => {
			const card = await cards.get("Forest");
			expect(detectCopyException(card)).toBeUndefined();
		});
	});

	describe("isBasicLand", () => {
		it("returns true for Forest", async () => {
			const card = await cards.get("Forest");
			expect(isBasicLand(card)).toBe(true);
		});

		it("returns true for Snow-Covered Forest", async () => {
			const card = await cards.get("Snow-Covered Forest");
			expect(isBasicLand(card)).toBe(true);
		});

		it("returns true for Wastes", async () => {
			const card = await cards.get("Wastes");
			expect(isBasicLand(card)).toBe(true);
		});

		it("returns false for Sol Ring", async () => {
			const card = await cards.get("Sol Ring");
			expect(isBasicLand(card)).toBe(false);
		});

		it("returns false for nonbasic lands", async () => {
			const card = await cards.get("Command Tower");
			expect(isBasicLand(card)).toBe(false);
		});

		it("returns false for Dryad Arbor (creature land)", async () => {
			const card = await cards.get("Dryad Arbor");
			expect(isBasicLand(card)).toBe(false);
		});
	});

	describe("getCopyLimit", () => {
		describe("singleton format (default 1)", () => {
			it("returns Infinity for basic lands", async () => {
				const card = await cards.get("Forest");
				expect(getCopyLimit(card, 1)).toBe(Infinity);
			});

			it("returns Infinity for unlimited exception cards", async () => {
				const card = await cards.get("Relentless Rats");
				expect(getCopyLimit(card, 1)).toBe(Infinity);
			});

			it("returns 7 for Seven Dwarves", async () => {
				const card = await cards.get("Seven Dwarves");
				expect(getCopyLimit(card, 1)).toBe(7);
			});

			it("returns 9 for Nazgûl", async () => {
				const card = await cards.get("Nazgûl");
				expect(getCopyLimit(card, 1)).toBe(9);
			});

			it("returns 1 for regular cards", async () => {
				const card = await cards.get("Sol Ring");
				expect(getCopyLimit(card, 1)).toBe(1);
			});
		});

		describe("playset format (default 4)", () => {
			it("returns Infinity for basic lands", async () => {
				const card = await cards.get("Forest");
				expect(getCopyLimit(card, 4)).toBe(Infinity);
			});

			it("returns Infinity for unlimited exception cards", async () => {
				const card = await cards.get("Relentless Rats");
				expect(getCopyLimit(card, 4)).toBe(Infinity);
			});

			it("returns 7 for Seven Dwarves", async () => {
				const card = await cards.get("Seven Dwarves");
				expect(getCopyLimit(card, 4)).toBe(7);
			});

			it("returns 4 for regular cards", async () => {
				const card = await cards.get("Lightning Bolt");
				expect(getCopyLimit(card, 4)).toBe(4);
			});
		});
	});
});
