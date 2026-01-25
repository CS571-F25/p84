import { describe, expect, it } from "vitest";
import {
	formatSuggestionList,
	getFormatInfo,
	suggestFormats,
} from "../format-utils";

describe("getFormatInfo", () => {
	it("returns supportsAlchemy true for alchemy formats", () => {
		expect(getFormatInfo("alchemy").supportsAlchemy).toBe(true);
		expect(getFormatInfo("historic").supportsAlchemy).toBe(true);
		expect(getFormatInfo("brawl").supportsAlchemy).toBe(true);
		expect(getFormatInfo("standardbrawl").supportsAlchemy).toBe(true);
		expect(getFormatInfo("timeless").supportsAlchemy).toBe(true);
		expect(getFormatInfo("gladiator").supportsAlchemy).toBe(true);
	});

	it("returns supportsAlchemy false for non-alchemy formats", () => {
		expect(getFormatInfo("commander").supportsAlchemy).toBe(false);
		expect(getFormatInfo("standard").supportsAlchemy).toBe(false);
		expect(getFormatInfo("modern").supportsAlchemy).toBe(false);
		expect(getFormatInfo("legacy").supportsAlchemy).toBe(false);
	});
});

describe("suggestFormats", () => {
	it("boosts formats where error cards are legal", () => {
		// Simulate error cards that are legal in alchemy formats
		const suggestions = suggestFormats(
			{
				deckSize: 60,
				hasCommander: false,
				errorLegalFormats: ["alchemy", "historic", "timeless"],
			},
			"standard",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		// Should suggest formats from errorLegalFormats
		expect(
			suggestions.some((fmt) =>
				["alchemy", "historic", "timeless"].includes(fmt),
			),
		).toBe(true);
	});

	it("suggests commander formats when both commander and error formats match", () => {
		// Simulate error cards legal in brawl (which is both alchemy and commander)
		const suggestions = suggestFormats(
			{
				deckSize: 100,
				hasCommander: true,
				errorLegalFormats: ["brawl", "standardbrawl"],
			},
			"commander",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		for (const fmt of suggestions) {
			const info = getFormatInfo(fmt);
			expect(info.commanderType).not.toBeNull();
		}
	});

	it("suggests commander formats when hasCommander", () => {
		const suggestions = suggestFormats(
			{ deckSize: 100, hasCommander: true, errorLegalFormats: [] },
			"standard",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		for (const fmt of suggestions) {
			expect(getFormatInfo(fmt).commanderType).not.toBeNull();
		}
	});

	it("excludes current format from suggestions", () => {
		const suggestions = suggestFormats(
			{
				deckSize: 60,
				hasCommander: false,
				errorLegalFormats: ["alchemy", "historic"],
			},
			"alchemy",
		);

		expect(suggestions).not.toContain("alchemy");
	});

	it("excludes cube when other suggestions exist", () => {
		const suggestions = suggestFormats(
			{ deckSize: 100, hasCommander: true, errorLegalFormats: [] },
			"standard",
		);

		expect(suggestions).not.toContain("cube");
		// kitchentable also excluded when better options exist
		expect(suggestions).not.toContain("kitchentable");
	});

	it("falls back to kitchentable when nothing else matches", () => {
		// Tiny deck with no commander or error formats - no format matches
		const suggestions = suggestFormats(
			{ deckSize: 5, hasCommander: false, errorLegalFormats: [] },
			"standard",
		);

		expect(suggestions).toEqual(["kitchentable"]);
	});

	it("ranks formats by frequency in errorLegalFormats", () => {
		// legacy appears twice, so it should be boosted more
		const suggestions = suggestFormats(
			{
				deckSize: 60,
				hasCommander: false,
				errorLegalFormats: ["legacy", "vintage", "legacy"],
			},
			"standard",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		// legacy should be ranked higher due to more occurrences
		expect(suggestions[0]).toBe("legacy");
	});

	it("penalizes but does not exclude commander formats when no commander", () => {
		// 100-card deck with brawl-legal errors but no commander marked
		// Brawl should still appear (penalized, not excluded)
		const suggestions = suggestFormats(
			{
				deckSize: 100,
				hasCommander: false,
				errorLegalFormats: ["brawl", "brawl", "brawl"],
			},
			"standard",
		);

		expect(suggestions).toContain("brawl");
	});
});

describe("formatSuggestionList", () => {
	it("handles single format", () => {
		expect(formatSuggestionList(["brawl"])).toBe("Brawl");
	});

	it("handles two formats with 'or'", () => {
		expect(formatSuggestionList(["brawl", "standardbrawl"])).toBe(
			"Brawl or Standard Brawl",
		);
	});

	it("handles three formats with comma and 'or'", () => {
		expect(formatSuggestionList(["alchemy", "historic", "timeless"])).toBe(
			"Alchemy, Historic, or Timeless",
		);
	});

	it("handles empty list", () => {
		expect(formatSuggestionList([])).toBe("");
	});
});
