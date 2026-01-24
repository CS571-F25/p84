import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { matchLinesToParsedCards } from "../match-lines";
import { parseDeck } from "../parse";

describe("matchLinesToParsedCards", () => {
	it("matches simple lines to parsed cards", () => {
		const text = `1 Sol Ring
4 Lightning Bolt`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched).toHaveLength(2);
		expect(matched[0].parsed?.name).toBe("Sol Ring");
		expect(matched[0].section).toBe("mainboard");
		expect(matched[1].parsed?.name).toBe("Lightning Bolt");
		expect(matched[1].section).toBe("mainboard");
	});

	it("handles empty lines", () => {
		const text = `1 Sol Ring

4 Lightning Bolt`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched).toHaveLength(3);
		expect(matched[0].parsed?.name).toBe("Sol Ring");
		expect(matched[1].parsed).toBeUndefined();
		expect(matched[1].trimmed).toBe("");
		expect(matched[2].parsed?.name).toBe("Lightning Bolt");
	});

	it("identifies section headers", () => {
		const text = `1 Sol Ring
Sideboard
1 Grafdigger's Cage`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched).toHaveLength(3);
		expect(matched[0].parsed?.name).toBe("Sol Ring");
		expect(matched[0].section).toBe("mainboard");
		expect(matched[1].parsed).toBeUndefined();
		expect(matched[1].trimmed).toBe("Sideboard");
		expect(matched[2].parsed?.name).toBe("Grafdigger's Cage");
		expect(matched[2].section).toBe("sideboard");
	});

	it("handles duplicate card text across sections correctly", () => {
		const text = `1 Sol Ring
Sideboard
1 Sol Ring`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched).toHaveLength(3);
		expect(matched[0].parsed?.name).toBe("Sol Ring");
		expect(matched[0].section).toBe("mainboard");
		expect(matched[1].parsed).toBeUndefined();
		expect(matched[2].parsed?.name).toBe("Sol Ring");
		expect(matched[2].section).toBe("sideboard");
	});

	it("handles duplicate card text within same section", () => {
		const text = `1 Sol Ring
1 Sol Ring`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched).toHaveLength(2);
		expect(matched[0].parsed?.name).toBe("Sol Ring");
		expect(matched[0].section).toBe("mainboard");
		expect(matched[1].parsed?.name).toBe("Sol Ring");
		expect(matched[1].section).toBe("mainboard");
	});

	it("generates stable keys based on content, not index", () => {
		const text = `1 Sol Ring
1 Lightning Bolt
1 Sol Ring`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched[0].key).toBe("1 Sol Ring:0");
		expect(matched[1].key).toBe("1 Lightning Bolt:0");
		expect(matched[2].key).toBe("1 Sol Ring:1");
	});

	it("handles commander section", () => {
		const text = `Commander
1 Kenrith, the Returned King
Deck
1 Sol Ring`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched[0].parsed).toBeUndefined();
		expect(matched[1].parsed?.name).toBe("Kenrith, the Returned King");
		expect(matched[1].section).toBe("commander");
		expect(matched[2].parsed).toBeUndefined();
		expect(matched[3].parsed?.name).toBe("Sol Ring");
		expect(matched[3].section).toBe("mainboard");
	});

	it("handles multiple sections with duplicates", () => {
		const text = `Commander
1 Sol Ring
Deck
1 Sol Ring
Sideboard
1 Sol Ring`;
		const lines = text.split("\n");
		const parsed = parseDeck(text);

		const matched = matchLinesToParsedCards(lines, parsed);

		expect(matched[1].section).toBe("commander");
		expect(matched[3].section).toBe("mainboard");
		expect(matched[5].section).toBe("sideboard");
	});

	it("every row gets a unique key for arbitrary input", () => {
		const linesArb = fc.array(fc.string(), { minLength: 1, maxLength: 100 });

		fc.assert(
			fc.property(linesArb, (linesArray) => {
				const text = linesArray.join("\n");
				const lines = text.split("\n");
				const parsed = parseDeck(text);
				const matched = matchLinesToParsedCards(lines, parsed);

				const keys = matched.map((m) => m.key);
				const uniqueKeys = new Set(keys);

				expect(uniqueKeys.size).toBe(keys.length);
			}),
			{ numRuns: 500 },
		);
	});
});
