import { describe, expect, it } from "vitest";
import {
	formatArena,
	formatCardLine,
	formatDeck,
	formatMoxfield,
	formatMtgo,
} from "../export";
import type { ParsedDeck } from "../types";

describe("formatCardLine", () => {
	describe("Moxfield format", () => {
		it("formats card with set and collector number", () => {
			const result = formatCardLine(
				{
					quantity: 4,
					name: "Lightning Bolt",
					setCode: "2XM",
					collectorNumber: "141",
					tags: [],
				},
				"moxfield",
			);
			expect(result).toBe("4 Lightning Bolt (2XM) 141");
		});

		it("formats card with tags", () => {
			const result = formatCardLine(
				{ quantity: 1, name: "Sol Ring", tags: ["ramp", "staple"] },
				"moxfield",
			);
			expect(result).toBe("1 Sol Ring #ramp #staple");
		});

		it("formats full Moxfield line", () => {
			const result = formatCardLine(
				{
					quantity: 1,
					name: "Lightning Bolt",
					setCode: "2XM",
					collectorNumber: "141",
					tags: ["removal", "burn"],
				},
				"moxfield",
			);
			expect(result).toBe("1 Lightning Bolt (2XM) 141 #removal #burn");
		});

		it("formats card without set info", () => {
			const result = formatCardLine(
				{ quantity: 1, name: "Sol Ring", tags: [] },
				"moxfield",
			);
			expect(result).toBe("1 Sol Ring");
		});

		it("formats card with only set (no collector number)", () => {
			const result = formatCardLine(
				{ quantity: 1, name: "Lightning Bolt", setCode: "2XM", tags: [] },
				"moxfield",
			);
			expect(result).toBe("1 Lightning Bolt (2XM)");
		});
	});

	describe("Arena format", () => {
		it("formats card with set and collector number", () => {
			const result = formatCardLine(
				{
					quantity: 4,
					name: "Lightning Bolt",
					setCode: "2XM",
					collectorNumber: "141",
					tags: [],
				},
				"arena",
			);
			expect(result).toBe("4 Lightning Bolt (2XM) 141");
		});

		it("strips tags for Arena format", () => {
			const result = formatCardLine(
				{ quantity: 1, name: "Sol Ring", tags: ["ramp", "staple"] },
				"arena",
			);
			expect(result).toBe("1 Sol Ring");
		});
	});

	describe("MTGO format", () => {
		it("formats card with just quantity and name", () => {
			const result = formatCardLine(
				{
					quantity: 4,
					name: "Lightning Bolt",
					setCode: "2XM",
					collectorNumber: "141",
					tags: [],
				},
				"mtgo",
			);
			expect(result).toBe("4 Lightning Bolt");
		});
	});

	describe("XMage format", () => {
		it("formats card with [SET:num] prefix", () => {
			const result = formatCardLine(
				{
					quantity: 4,
					name: "Lightning Bolt",
					setCode: "2XM",
					collectorNumber: "141",
					tags: [],
				},
				"xmage",
			);
			expect(result).toBe("4 [2XM:141] Lightning Bolt");
		});

		it("formats card with [SET] prefix when no collector number", () => {
			const result = formatCardLine(
				{ quantity: 4, name: "Lightning Bolt", setCode: "2XM", tags: [] },
				"xmage",
			);
			expect(result).toBe("4 [2XM] Lightning Bolt");
		});

		it("formats card without set info", () => {
			const result = formatCardLine(
				{ quantity: 4, name: "Lightning Bolt", tags: [] },
				"xmage",
			);
			expect(result).toBe("4 Lightning Bolt");
		});
	});

	describe("TappedOut format", () => {
		it("formats quantity with x suffix", () => {
			const result = formatCardLine(
				{ quantity: 4, name: "Lightning Bolt", tags: [] },
				"tappedout",
			);
			expect(result).toBe("4x Lightning Bolt");
		});
	});

	describe("MTGGoldfish format", () => {
		it("formats card with [SET] suffix", () => {
			const result = formatCardLine(
				{ quantity: 4, name: "Lightning Bolt", setCode: "2XM", tags: [] },
				"mtggoldfish",
			);
			expect(result).toBe("4 Lightning Bolt [2XM]");
		});

		it("formats card without set info", () => {
			const result = formatCardLine(
				{ quantity: 4, name: "Lightning Bolt", tags: [] },
				"mtggoldfish",
			);
			expect(result).toBe("4 Lightning Bolt");
		});
	});
});

describe("formatDeck", () => {
	const mockDeck: ParsedDeck = {
		commander: [
			{
				quantity: 1,
				name: "Hamza, Guardian of Arashin",
				setCode: "CMM",
				collectorNumber: "339",
				tags: [],
				raw: "",
			},
		],
		mainboard: [
			{
				quantity: 4,
				name: "Llanowar Elves",
				setCode: "DOM",
				collectorNumber: "168",
				tags: ["dorks"],
				raw: "",
			},
			{ quantity: 1, name: "Sol Ring", tags: ["ramp"], raw: "" },
		],
		sideboard: [
			{
				quantity: 2,
				name: "Negate",
				setCode: "M20",
				collectorNumber: "69",
				tags: [],
				raw: "",
			},
		],
		maybeboard: [],
		format: "moxfield",
	};

	describe("formatMoxfield", () => {
		it("exports cards with tags, SIDEBOARD: separator", () => {
			const result = formatMoxfield(mockDeck);
			const lines = result.split("\n");

			// Commander cards come first (no header)
			expect(lines).toContain("1 Hamza, Guardian of Arashin (CMM) 339");
			// Mainboard cards follow (no header)
			expect(lines).toContain("4 Llanowar Elves (DOM) 168 #dorks");
			expect(lines).toContain("1 Sol Ring #ramp");
			// SIDEBOARD: header (uppercase with colon)
			expect(lines).toContain("SIDEBOARD:");
			expect(lines).toContain("2 Negate (M20) 69");
		});

		it("omits empty sections", () => {
			const result = formatMoxfield(mockDeck);
			expect(result).not.toContain("MAYBEBOARD:");
		});
	});

	describe("formatArena", () => {
		it("exports with Arena section headers", () => {
			const result = formatArena(mockDeck);
			const lines = result.split("\n");

			expect(lines).toContain("Commander");
			expect(lines).toContain("1 Hamza, Guardian of Arashin (CMM) 339");
			expect(lines).toContain("Deck");
			expect(lines).toContain("4 Llanowar Elves (DOM) 168");
			expect(lines).toContain("1 Sol Ring");
			expect(lines).toContain("Sideboard");
			expect(lines).toContain("2 Negate (M20) 69");
		});

		it("strips tags", () => {
			const result = formatArena(mockDeck);
			expect(result).not.toContain("#dorks");
			expect(result).not.toContain("#ramp");
		});
	});

	describe("formatMtgo", () => {
		it("exports with minimal format (names only)", () => {
			const result = formatMtgo(mockDeck);
			const lines = result.split("\n");

			expect(lines).toContain("4 Llanowar Elves");
			expect(lines).toContain("1 Sol Ring");
			// MTGO uses blank line separator, not section headers
		});

		it("has sideboard section", () => {
			const result = formatMtgo(mockDeck);
			expect(result).toContain("Sideboard:");
			expect(result).toContain("2 Negate");
		});
	});

	describe("formatDeck dispatcher", () => {
		it("dispatches to correct format", () => {
			expect(formatDeck(mockDeck, "moxfield")).toContain("#dorks");
			expect(formatDeck(mockDeck, "arena")).not.toContain("#dorks");
			expect(formatDeck(mockDeck, "mtgo")).toContain("Sideboard:");
		});
	});
});

describe("edge cases", () => {
	it("handles empty deck", () => {
		const emptyDeck: ParsedDeck = {
			commander: [],
			mainboard: [],
			sideboard: [],
			maybeboard: [],
			format: "generic",
		};
		const result = formatMoxfield(emptyDeck);
		expect(result.trim()).toBe("");
	});

	it("handles split cards", () => {
		const result = formatCardLine(
			{
				quantity: 1,
				name: "Fire // Ice",
				setCode: "MH2",
				collectorNumber: "290",
				tags: [],
			},
			"moxfield",
		);
		expect(result).toBe("1 Fire // Ice (MH2) 290");
	});

	it("handles adventure cards", () => {
		const result = formatCardLine(
			{
				quantity: 1,
				name: "Colossal Badger / Dig Deep",
				setCode: "CLB",
				collectorNumber: "223",
				tags: [],
			},
			"moxfield",
		);
		expect(result).toBe("1 Colossal Badger / Dig Deep (CLB) 223");
	});

	it("handles special collector numbers", () => {
		const result = formatCardLine(
			{
				quantity: 1,
				name: "Lightning Bolt",
				setCode: "STA",
				collectorNumber: "62★",
				tags: [],
			},
			"moxfield",
		);
		expect(result).toBe("1 Lightning Bolt (STA) 62★");
	});

	it("handles multi-word tags", () => {
		const result = formatCardLine(
			{
				quantity: 1,
				name: "Fierce Empath",
				tags: ["card advantage and friends"],
			},
			"moxfield",
		);
		expect(result).toBe("1 Fierce Empath #card advantage and friends");
	});
});
