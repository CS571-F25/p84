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
	it("suggests alchemy-supporting formats when hasAlchemyCards", () => {
		const suggestions = suggestFormats(
			{ deckSize: 60, hasCommander: false, hasAlchemyCards: true },
			"standard",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		for (const fmt of suggestions) {
			expect(getFormatInfo(fmt).supportsAlchemy).toBe(true);
		}
	});

	it("suggests commander + alchemy formats when both conditions", () => {
		const suggestions = suggestFormats(
			{ deckSize: 100, hasCommander: true, hasAlchemyCards: true },
			"commander",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		for (const fmt of suggestions) {
			const info = getFormatInfo(fmt);
			expect(info.supportsAlchemy).toBe(true);
			expect(info.commanderType).not.toBeNull();
		}
	});

	it("suggests commander formats when hasCommander", () => {
		const suggestions = suggestFormats(
			{ deckSize: 100, hasCommander: true, hasAlchemyCards: false },
			"standard",
		);

		expect(suggestions.length).toBeGreaterThan(0);
		for (const fmt of suggestions) {
			expect(getFormatInfo(fmt).commanderType).not.toBeNull();
		}
	});

	it("excludes current format from suggestions", () => {
		const suggestions = suggestFormats(
			{ deckSize: 60, hasCommander: false, hasAlchemyCards: true },
			"alchemy",
		);

		expect(suggestions).not.toContain("alchemy");
	});

	it("excludes cube when other suggestions exist", () => {
		const suggestions = suggestFormats(
			{ deckSize: 100, hasCommander: true, hasAlchemyCards: false },
			"standard",
		);

		expect(suggestions).not.toContain("cube");
		// kitchentable also excluded when better options exist
		expect(suggestions).not.toContain("kitchentable");
	});

	it("falls back to kitchentable when nothing else matches", () => {
		// Tiny deck with no commander or alchemy - no format matches
		const suggestions = suggestFormats(
			{ deckSize: 5, hasCommander: false, hasAlchemyCards: false },
			"standard",
		);

		expect(suggestions).toEqual(["kitchentable"]);
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
