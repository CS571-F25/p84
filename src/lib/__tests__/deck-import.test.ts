import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatCardLine, parseCardLine, parseCardList } from "../deck-import";
import type { Card, OracleId, ScryfallId } from "../scryfall-types";

describe("parseCardLine", () => {
	it("parses basic card with quantity", () => {
		const result = parseCardLine("4 Lightning Bolt");
		expect(result).toEqual({
			quantity: 4,
			name: "Lightning Bolt",
			tags: [],
			raw: "4 Lightning Bolt",
		});
	});

	it("parses card without quantity (defaults to 1)", () => {
		const result = parseCardLine("Sol Ring");
		expect(result).toEqual({
			quantity: 1,
			name: "Sol Ring",
			tags: [],
			raw: "Sol Ring",
		});
	});

	it("parses card with set code", () => {
		const result = parseCardLine("1 Lightning Bolt (2XM)");
		expect(result).toEqual({
			quantity: 1,
			name: "Lightning Bolt",
			setCode: "2XM",
			tags: [],
			raw: "1 Lightning Bolt (2XM)",
		});
	});

	it("parses card with set code and collector number", () => {
		const result = parseCardLine("1 Lightning Bolt (2XM) 141");
		expect(result).toEqual({
			quantity: 1,
			name: "Lightning Bolt",
			setCode: "2XM",
			collectorNumber: "141",
			tags: [],
			raw: "1 Lightning Bolt (2XM) 141",
		});
	});

	it("parses card with tags", () => {
		const result = parseCardLine("1 Sol Ring #ramp #staple");
		expect(result).toEqual({
			quantity: 1,
			name: "Sol Ring",
			tags: ["ramp", "staple"],
			raw: "1 Sol Ring #ramp #staple",
		});
	});

	it("parses full Moxfield format", () => {
		const result = parseCardLine(
			"1 Alabaster Host Intercessor (MOM) 3 #!removal",
		);
		expect(result).toEqual({
			quantity: 1,
			name: "Alabaster Host Intercessor",
			setCode: "MOM",
			collectorNumber: "3",
			tags: ["removal"],
			raw: "1 Alabaster Host Intercessor (MOM) 3 #!removal",
		});
	});

	it("handles Moxfield global tag prefix (#!)", () => {
		const result = parseCardLine("1 Llanowar Elves #!dorks #ramp");
		expect(result).toEqual({
			quantity: 1,
			name: "Llanowar Elves",
			tags: ["dorks", "ramp"],
			raw: "1 Llanowar Elves #!dorks #ramp",
		});
	});

	it("handles multi-word tags with slashes (no spaces)", () => {
		const result = parseCardLine(
			"1 Ambitious Dragonborn (CLB) 213 #payoffs/big_creatures",
		);
		expect(result).toEqual({
			quantity: 1,
			name: "Ambitious Dragonborn",
			setCode: "CLB",
			collectorNumber: "213",
			tags: ["payoffs/big_creatures"],
			raw: "1 Ambitious Dragonborn (CLB) 213 #payoffs/big_creatures",
		});
	});

	it("handles tags with spaces", () => {
		const result = parseCardLine(
			"1 Ambitious Dragonborn (CLB) 213 #payoffs / big creatures",
		);
		expect(result).toEqual({
			quantity: 1,
			name: "Ambitious Dragonborn",
			setCode: "CLB",
			collectorNumber: "213",
			tags: ["payoffs / big creatures"],
			raw: "1 Ambitious Dragonborn (CLB) 213 #payoffs / big creatures",
		});
	});

	it("handles multiple tags with spaces (deduplicates)", () => {
		const result = parseCardLine(
			"1 Duskshell Crawler (J25) 653 #counter creatures #!counter creatures #!counter effects",
		);
		// Note: duplicate tags are deduplicated (first two are the same after stripping !)
		expect(result).toEqual({
			quantity: 1,
			name: "Duskshell Crawler",
			setCode: "J25",
			collectorNumber: "653",
			tags: ["counter creatures", "counter effects"],
			raw: "1 Duskshell Crawler (J25) 653 #counter creatures #!counter creatures #!counter effects",
		});
	});

	it("handles card advantage and friends tag", () => {
		const result = parseCardLine(
			"1 Fierce Empath (M21) 181 #!card advantage and friends",
		);
		expect(result).toEqual({
			quantity: 1,
			name: "Fierce Empath",
			setCode: "M21",
			collectorNumber: "181",
			tags: ["card advantage and friends"],
			raw: "1 Fierce Empath (M21) 181 #!card advantage and friends",
		});
	});

	it("handles split card with spaced tags", () => {
		const result = parseCardLine(
			"1 Colossal Badger / Dig Deep (CLB) 223 #!counters #payoffs / big creatures",
		);
		expect(result).toEqual({
			quantity: 1,
			name: "Colossal Badger / Dig Deep",
			setCode: "CLB",
			collectorNumber: "223",
			tags: ["counters", "payoffs / big creatures"],
			raw: "1 Colossal Badger / Dig Deep (CLB) 223 #!counters #payoffs / big creatures",
		});
	});

	it("handles lowercase set codes (normalizes to uppercase)", () => {
		const result = parseCardLine("1 Lightning Bolt (2xm) 141");
		expect(result).toEqual({
			quantity: 1,
			name: "Lightning Bolt",
			setCode: "2XM",
			collectorNumber: "141",
			tags: [],
			raw: "1 Lightning Bolt (2xm) 141",
		});
	});

	it("handles split cards", () => {
		const result = parseCardLine("1 Fire // Ice (MH2) 290");
		expect(result).toEqual({
			quantity: 1,
			name: "Fire // Ice",
			setCode: "MH2",
			collectorNumber: "290",
			tags: [],
			raw: "1 Fire // Ice (MH2) 290",
		});
	});

	it("returns null for empty lines", () => {
		expect(parseCardLine("")).toBeNull();
		expect(parseCardLine("   ")).toBeNull();
	});

	it("handles collector numbers with special characters", () => {
		const result = parseCardLine("1 Lightning Bolt (STA) 62★");
		expect(result).toEqual({
			quantity: 1,
			name: "Lightning Bolt",
			setCode: "STA",
			collectorNumber: "62★",
			tags: [],
			raw: "1 Lightning Bolt (STA) 62★",
		});
	});
});

describe("parseCardList", () => {
	it("parses multiple lines", () => {
		const input = `1 Lightning Bolt (2XM) 141 #removal
4 Llanowar Elves #dorks
1 Sol Ring`;

		const result = parseCardList(input);
		expect(result).toHaveLength(3);
		expect(result[0].name).toBe("Lightning Bolt");
		expect(result[1].name).toBe("Llanowar Elves");
		expect(result[2].name).toBe("Sol Ring");
	});

	it("skips empty lines", () => {
		const input = `1 Lightning Bolt

1 Sol Ring

1 Llanowar Elves`;

		const result = parseCardList(input);
		expect(result).toHaveLength(3);
	});
});

describe("formatCardLine", () => {
	const mockCard = (overrides: Partial<Card> = {}): Card =>
		({
			id: "test-id" as ScryfallId,
			name: "Lightning Bolt",
			set: "2xm",
			collector_number: "141",
			...overrides,
		}) as Card;

	it("formats basic card", () => {
		const result = formatCardLine(
			{ quantity: 4, scryfallId: "test-id" as ScryfallId },
			mockCard(),
		);
		expect(result).toBe("4 Lightning Bolt (2XM) 141");
	});

	it("formats card with tags", () => {
		const result = formatCardLine(
			{
				quantity: 1,
				scryfallId: "test-id" as ScryfallId,
				tags: ["removal", "burn"],
			},
			mockCard(),
		);
		expect(result).toBe("1 Lightning Bolt (2XM) 141 #removal #burn");
	});

	it("formats card without set info", () => {
		const result = formatCardLine(
			{ quantity: 1, scryfallId: "test-id" as ScryfallId },
			mockCard({ set: undefined, collector_number: undefined }),
		);
		expect(result).toBe("1 Lightning Bolt");
	});

	it("formats card with only set (no collector number)", () => {
		const result = formatCardLine(
			{ quantity: 1, scryfallId: "test-id" as ScryfallId },
			mockCard({ collector_number: undefined }),
		);
		expect(result).toBe("1 Lightning Bolt (2XM)");
	});

	it("uppercases set code", () => {
		const result = formatCardLine(
			{ quantity: 1, scryfallId: "test-id" as ScryfallId },
			mockCard({ set: "mom" }),
		);
		expect(result).toBe("1 Lightning Bolt (MOM) 141");
	});
});

describe("roundtrip: format → parse", () => {
	const mockCard = (overrides: Partial<Card> = {}): Card =>
		({
			id: "test-id" as ScryfallId,
			name: "Test Card",
			set: "tst",
			collector_number: "1",
			...overrides,
		}) as Card;

	it("preserves quantity, name, set, collector number, and tags", () => {
		const card = mockCard({
			name: "Lightning Bolt",
			set: "2xm",
			collector_number: "141",
		});
		const input = {
			quantity: 4,
			scryfallId: "test-id" as ScryfallId,
			tags: ["removal", "burn"],
		};

		const formatted = formatCardLine(input, card);
		const parsed = parseCardLine(formatted);

		expect(parsed).not.toBeNull();
		expect(parsed?.quantity).toBe(input.quantity);
		expect(parsed?.name).toBe(card.name);
		expect(parsed?.setCode).toBe(card.set?.toUpperCase());
		expect(parsed?.collectorNumber).toBe(card.collector_number);
		expect(parsed?.tags).toEqual(input.tags);
	});

	it("handles cards without set info", () => {
		const card = mockCard({
			name: "Sol Ring",
			set: undefined,
			collector_number: undefined,
		});
		const input = {
			quantity: 1,
			scryfallId: "test-id" as ScryfallId,
			tags: [],
		};

		const formatted = formatCardLine(input, card);
		const parsed = parseCardLine(formatted);

		expect(parsed).not.toBeNull();
		expect(parsed?.name).toBe("Sol Ring");
		expect(parsed?.setCode).toBeUndefined();
		expect(parsed?.collectorNumber).toBeUndefined();
	});
});

describe("property-based tests", () => {
	// Card names: letters, numbers, spaces, punctuation, split card separator
	const cardNameArb = fc
		.stringMatching(/^[a-zA-Z][a-zA-Z0-9\-',. /]{0,48}[a-zA-Z0-9]$/)
		.filter((s) => s.trim().length > 0);

	// Set codes: 2-5 uppercase alphanumeric
	const setCodeArb = fc.stringMatching(/^[A-Z0-9]{2,5}$/);

	// Collector numbers: digits with optional letter suffix
	const collectorNumberArb = fc.stringMatching(/^[0-9]{1,4}[a-z]?$/);

	// Tags: alphanumeric with underscores, slashes, hyphens
	const tagArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_/-]{0,18}$/);

	const tagsArb = fc.array(tagArb, { minLength: 0, maxLength: 5 });

	const quantityArb = fc.integer({ min: 1, max: 99 });

	it("roundtrips arbitrary cards with full info", () => {
		fc.assert(
			fc.property(
				quantityArb,
				cardNameArb,
				setCodeArb,
				collectorNumberArb,
				tagsArb,
				(quantity, name, set, collectorNumber, tags) => {
					const card: Card = {
						id: "test-id" as ScryfallId,
						oracle_id: "oracle-id" as OracleId,
						name,
						set: set.toLowerCase(),
						collector_number: collectorNumber,
					};

					const input = {
						quantity,
						scryfallId: "test-id" as ScryfallId,
						tags,
					};

					const formatted = formatCardLine(input, card);
					const parsed = parseCardLine(formatted);

					expect(parsed).not.toBeNull();
					expect(parsed?.quantity).toBe(quantity);
					expect(parsed?.name).toBe(name);
					expect(parsed?.setCode).toBe(set.toUpperCase());
					expect(parsed?.collectorNumber).toBe(collectorNumber);
					// Tags are deduplicated during parsing
					expect(parsed?.tags).toEqual(Array.from(new Set(tags)));
				},
			),
			{ numRuns: 200 },
		);
	});

	it("roundtrips cards without set info", () => {
		fc.assert(
			fc.property(quantityArb, cardNameArb, tagsArb, (quantity, name, tags) => {
				const card: Card = {
					id: "test-id" as ScryfallId,
					oracle_id: "oracle-id" as OracleId,
					name,
				};

				const input = {
					quantity,
					scryfallId: "test-id" as ScryfallId,
					tags,
				};

				const formatted = formatCardLine(input, card);
				const parsed = parseCardLine(formatted);

				expect(parsed).not.toBeNull();
				expect(parsed?.quantity).toBe(quantity);
				expect(parsed?.name).toBe(name);
				expect(parsed?.setCode).toBeUndefined();
				// Tags are deduplicated during parsing
				expect(parsed?.tags).toEqual(Array.from(new Set(tags)));
			}),
			{ numRuns: 200 },
		);
	});

	it("parses any formatted line without throwing", () => {
		fc.assert(
			fc.property(
				quantityArb,
				cardNameArb,
				fc.option(setCodeArb),
				fc.option(collectorNumberArb),
				tagsArb,
				(quantity, name, set, collectorNumber, tags) => {
					const card: Card = {
						id: "test-id" as ScryfallId,
						oracle_id: "oracle-id" as OracleId,
						name,
						set: set ?? undefined,
						collector_number: set ? (collectorNumber ?? undefined) : undefined,
					};

					const input = {
						quantity,
						scryfallId: "test-id" as ScryfallId,
						tags,
					};

					const formatted = formatCardLine(input, card);
					expect(() => parseCardLine(formatted)).not.toThrow();
				},
			),
			{ numRuns: 200 },
		);
	});
});
