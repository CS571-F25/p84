/**
 * Roundtrip property tests for deck-formats
 *
 * Verifies that:
 * 1. format → parse yields equivalent data
 * 2. Arbitrary valid decks roundtrip correctly
 * 3. Any input parses without throwing
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatCardLine, formatDeck, formatMoxfield } from "../export";
import { parseCardLine, parseDeck } from "../parse";
import type { DeckFormat, ParsedCardLine, ParsedDeck } from "../types";

describe("roundtrip: format → parse", () => {
	describe("Moxfield format", () => {
		it("preserves quantity, name, set, collector number, and tags", () => {
			const card: ParsedCardLine = {
				quantity: 4,
				name: "Lightning Bolt",
				setCode: "2XM",
				collectorNumber: "141",
				tags: ["removal", "burn"],
				raw: "",
			};

			const formatted = formatCardLine(card, "moxfield");
			const parsed = parseCardLine(formatted);

			expect(parsed).not.toBeNull();
			expect(parsed?.quantity).toBe(card.quantity);
			expect(parsed?.name).toBe(card.name);
			expect(parsed?.setCode).toBe(card.setCode);
			expect(parsed?.collectorNumber).toBe(card.collectorNumber);
			expect(parsed?.tags).toEqual(card.tags);
		});

		it("handles cards without set info", () => {
			const card: ParsedCardLine = {
				quantity: 1,
				name: "Sol Ring",
				tags: [],
				raw: "",
			};

			const formatted = formatCardLine(card, "moxfield");
			const parsed = parseCardLine(formatted);

			expect(parsed).not.toBeNull();
			expect(parsed?.name).toBe("Sol Ring");
			expect(parsed?.setCode).toBeUndefined();
			expect(parsed?.collectorNumber).toBeUndefined();
		});
	});

	describe("Arena format", () => {
		it("preserves quantity, name, set, collector number (strips tags)", () => {
			const card: ParsedCardLine = {
				quantity: 4,
				name: "Lightning Bolt",
				setCode: "2XM",
				collectorNumber: "141",
				tags: ["removal"],
				raw: "",
			};

			const formatted = formatCardLine(card, "arena");
			const parsed = parseCardLine(formatted);

			expect(parsed).not.toBeNull();
			expect(parsed?.quantity).toBe(card.quantity);
			expect(parsed?.name).toBe(card.name);
			expect(parsed?.setCode).toBe(card.setCode);
			expect(parsed?.collectorNumber).toBe(card.collectorNumber);
			// Tags are stripped in Arena format
			expect(parsed?.tags).toEqual([]);
		});
	});

	describe("XMage format", () => {
		it("preserves quantity, name, set, collector number", () => {
			const card: ParsedCardLine = {
				quantity: 4,
				name: "Lightning Bolt",
				setCode: "2XM",
				collectorNumber: "141",
				tags: [],
				raw: "",
			};

			const formatted = formatCardLine(card, "xmage");
			const parsed = parseCardLine(formatted);

			expect(parsed).not.toBeNull();
			expect(parsed?.quantity).toBe(card.quantity);
			expect(parsed?.name).toBe(card.name);
			expect(parsed?.setCode).toBe(card.setCode);
			expect(parsed?.collectorNumber).toBe(card.collectorNumber);
		});
	});

	describe("full deck roundtrip", () => {
		it("Moxfield deck roundtrips correctly", () => {
			const deck: ParsedDeck = {
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

			const formatted = formatMoxfield(deck);
			const reparsed = parseDeck(formatted, { format: "moxfield" });

			// Moxfield format doesn't have Commander section header, so commander
			// goes to mainboard on reparse (format limitation)
			expect(reparsed.commander).toHaveLength(0);
			expect(reparsed.mainboard).toHaveLength(3);
			expect(reparsed.mainboard[0].name).toBe("Hamza, Guardian of Arashin");
			expect(reparsed.mainboard[1].name).toBe("Llanowar Elves");
			expect(reparsed.mainboard[1].tags).toEqual(["dorks"]);
			expect(reparsed.mainboard[2].name).toBe("Sol Ring");
			expect(reparsed.mainboard[2].tags).toEqual(["ramp"]);

			expect(reparsed.sideboard).toHaveLength(1);
			expect(reparsed.sideboard[0].name).toBe("Negate");
		});
	});
});

describe("property-based tests", () => {
	// Card names: letters, numbers, spaces, punctuation, split card separator
	// Filter out double spaces since parser normalizes whitespace
	const cardNameArb = fc
		.stringMatching(/^[a-zA-Z][a-zA-Z0-9\-',. /]{0,48}[a-zA-Z0-9]$/)
		.filter((s) => s.trim().length > 0 && !/\s{2,}/.test(s));

	// Set codes: 2-5 uppercase alphanumeric
	const setCodeArb = fc.stringMatching(/^[A-Z0-9]{2,5}$/);

	// Collector numbers: digits with optional letter suffix
	const collectorNumberArb = fc.stringMatching(/^[0-9]{1,4}[a-z]?$/);

	// Tags: alphanumeric with underscores, slashes, hyphens (no spaces to avoid parsing ambiguity)
	const tagArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_/-]{0,18}$/);
	const tagsArb = fc.array(tagArb, { minLength: 0, maxLength: 5 });

	const quantityArb = fc.integer({ min: 1, max: 99 });

	const parsedCardArb = fc
		.record({
			quantity: quantityArb,
			name: cardNameArb,
			setCode: fc.option(setCodeArb, { nil: undefined }),
			collectorNumber: fc.option(collectorNumberArb, { nil: undefined }),
			tags: tagsArb,
			raw: fc.constant(""),
		})
		.map((card) => ({
			...card,
			// Collector number only valid if set code is present
			collectorNumber: card.setCode ? card.collectorNumber : undefined,
		})) as fc.Arbitrary<ParsedCardLine>;

	it("roundtrips arbitrary cards with Moxfield format", () => {
		fc.assert(
			fc.property(parsedCardArb, (card) => {
				const formatted = formatCardLine(card, "moxfield");
				const parsed = parseCardLine(formatted);

				expect(parsed).not.toBeNull();
				expect(parsed?.quantity).toBe(card.quantity);
				expect(parsed?.name).toBe(card.name);
				expect(parsed?.setCode).toBe(card.setCode);
				if (card.setCode) {
					expect(parsed?.collectorNumber).toBe(card.collectorNumber);
				}
				// Tags are deduplicated during parsing
				expect(parsed?.tags).toEqual(Array.from(new Set(card.tags)));
			}),
			{ numRuns: 200 },
		);
	});

	it("roundtrips arbitrary cards with Arena format (tags stripped)", () => {
		fc.assert(
			fc.property(parsedCardArb, (card) => {
				const formatted = formatCardLine(card, "arena");
				const parsed = parseCardLine(formatted);

				expect(parsed).not.toBeNull();
				expect(parsed?.quantity).toBe(card.quantity);
				expect(parsed?.name).toBe(card.name);
				expect(parsed?.setCode).toBe(card.setCode);
				if (card.setCode) {
					expect(parsed?.collectorNumber).toBe(card.collectorNumber);
				}
				// Arena strips tags
				expect(parsed?.tags).toEqual([]);
			}),
			{ numRuns: 200 },
		);
	});

	it("roundtrips arbitrary cards with XMage format", () => {
		fc.assert(
			fc.property(parsedCardArb, (card) => {
				if (!card.setCode) return; // XMage needs set code for proper roundtrip

				const formatted = formatCardLine(card, "xmage");
				const parsed = parseCardLine(formatted);

				expect(parsed).not.toBeNull();
				expect(parsed?.quantity).toBe(card.quantity);
				expect(parsed?.name).toBe(card.name);
				expect(parsed?.setCode).toBe(card.setCode);
				expect(parsed?.collectorNumber).toBe(card.collectorNumber);
			}),
			{ numRuns: 200 },
		);
	});

	it("total card count is preserved across roundtrip", () => {
		const deckArb = fc.record({
			commander: fc.array(parsedCardArb, { minLength: 0, maxLength: 2 }),
			mainboard: fc.array(parsedCardArb, { minLength: 1, maxLength: 20 }),
			sideboard: fc.array(parsedCardArb, { minLength: 0, maxLength: 15 }),
			maybeboard: fc.constant([] as ParsedCardLine[]),
			format: fc.constant("moxfield" as DeckFormat),
		});

		fc.assert(
			fc.property(deckArb, (deck) => {
				const originalCount =
					deck.commander.reduce((s, c) => s + c.quantity, 0) +
					deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
					deck.sideboard.reduce((s, c) => s + c.quantity, 0);

				const formatted = formatDeck(deck as ParsedDeck, "moxfield");
				const reparsed = parseDeck(formatted, { format: "moxfield" });

				const reparsedCount =
					reparsed.commander.reduce((s, c) => s + c.quantity, 0) +
					reparsed.mainboard.reduce((s, c) => s + c.quantity, 0) +
					reparsed.sideboard.reduce((s, c) => s + c.quantity, 0);

				expect(reparsedCount).toBe(originalCount);
			}),
			{ numRuns: 100 },
		);
	});

	it("parses any formatted line without throwing", () => {
		fc.assert(
			fc.property(parsedCardArb, (card) => {
				const formatted = formatCardLine(card, "moxfield");
				expect(() => parseCardLine(formatted)).not.toThrow();
			}),
			{ numRuns: 200 },
		);
	});

	it("parseDeck never throws on arbitrary input", () => {
		fc.assert(
			fc.property(fc.string(), (text) => {
				expect(() => parseDeck(text)).not.toThrow();
			}),
			{ numRuns: 200 },
		);
	});
});
