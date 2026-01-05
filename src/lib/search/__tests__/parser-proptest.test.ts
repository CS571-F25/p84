/**
 * Property-based tests for the search parser
 *
 * These tests use fast-check to generate random valid inputs and verify
 * parser invariants hold across the input space.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Card } from "../../scryfall-types";
import { describeQuery } from "../describe";
import { search } from "../index";
import { parse } from "../parser";
import { FIELD_ALIASES, type FieldName } from "../types";

const COLORS = ["w", "u", "b", "r", "g", "c"] as const;
const ALL_OPERATORS = [":", "=", "!=", "<", ">", "<=", ">="] as const;
const NUMERIC_OPERATORS = [":", "=", "!=", "<", ">", "<=", ">="] as const;

const TEXT_FIELDS = ["t", "o", "name", "type", "oracle"] as const;
const COLOR_FIELDS = ["c", "id", "color", "identity"] as const;
const NUMERIC_FIELDS = [
	"mv",
	"cmc",
	"pow",
	"power",
	"tou",
	"loy",
	"def",
] as const;
const wordArb = fc
	.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,8}$/)
	.filter((w) => w.toLowerCase() !== "or");
const numArb = fc.integer({ min: 0, max: 20 });
const colorArb = fc
	.subarray([...COLORS], { minLength: 1, maxLength: 5 })
	.map((cs) => cs.join(""));

const textFieldArb = fc.constantFrom(...TEXT_FIELDS);
const colorFieldArb = fc.constantFrom(...COLOR_FIELDS);
const numericFieldArb = fc.constantFrom(...NUMERIC_FIELDS);
const anyFieldArb = fc.constantFrom(...Object.keys(FIELD_ALIASES));

const operatorArb = fc.constantFrom(...ALL_OPERATORS);
const numericOpArb = fc.constantFrom(...NUMERIC_OPERATORS);

describe("parser property tests", () => {
	describe("parsing invariants", () => {
		it("never crashes on alphanumeric input", () => {
			fc.assert(
				fc.property(fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/), (input) => {
					const result = parse(input);
					expect(result).toBeDefined();
					expect(typeof result.ok).toBe("boolean");
				}),
				{ numRuns: 200 },
			);
		});

		it("never crashes on input with operators", () => {
			fc.assert(
				fc.property(
					fc.stringMatching(/^[a-zA-Z0-9:=<>! ()-]{1,50}$/),
					(input) => {
						const result = parse(input);
						expect(result).toBeDefined();
						expect(typeof result.ok).toBe("boolean");
					},
				),
				{ numRuns: 200 },
			);
		});

		it("parses all text field + word combinations", () => {
			fc.assert(
				fc.property(textFieldArb, wordArb, (field, value) => {
					const result = parse(`${field}:${value}`);
					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.value.type).toBe("FIELD");
					}
				}),
				{ numRuns: 100 },
			);
		});

		it("parses all color field + color combinations", () => {
			fc.assert(
				fc.property(
					colorFieldArb,
					operatorArb,
					colorArb,
					(field, op, colors) => {
						const result = parse(`${field}${op}${colors}`);
						expect(result.ok).toBe(true);
						if (result.ok && result.value.type === "FIELD") {
							expect(result.value.value.kind).toBe("colors");
						}
					},
				),
				{ numRuns: 100 },
			);
		});

		it("parses all numeric field + operator + number combinations", () => {
			fc.assert(
				fc.property(numericFieldArb, numericOpArb, numArb, (field, op, num) => {
					const result = parse(`${field}${op}${num}`);
					expect(result.ok).toBe(true);
					if (result.ok && result.value.type === "FIELD") {
						expect(result.value.value.kind).toBe("number");
					}
				}),
				{ numRuns: 100 },
			);
		});

		it("parses negative numbers in numeric fields", () => {
			fc.assert(
				fc.property(
					numericFieldArb,
					numericOpArb,
					fc.integer({ min: 1, max: 10 }),
					(field, op, num) => {
						const result = parse(`${field}${op}-${num}`);
						expect(result.ok).toBe(true);
						if (result.ok && result.value.type === "FIELD") {
							expect(result.value.value.kind).toBe("number");
							if (result.value.value.kind === "number") {
								expect(result.value.value.value).toBe(-num);
							}
						}
					},
				),
				{ numRuns: 50 },
			);
		});
	});

	describe("boolean operator combinations", () => {
		it("parses arbitrary AND chains", () => {
			fc.assert(
				fc.property(
					fc.array(wordArb, { minLength: 2, maxLength: 6 }),
					(words) => {
						const result = parse(words.join(" "));
						expect(result.ok).toBe(true);
						if (result.ok && words.length > 1) {
							expect(result.value.type).toBe("AND");
						}
					},
				),
				{ numRuns: 50 },
			);
		});

		it("parses arbitrary OR chains", () => {
			fc.assert(
				fc.property(
					fc.array(wordArb, { minLength: 2, maxLength: 4 }),
					(words) => {
						const result = parse(words.join(" or "));
						expect(result.ok).toBe(true);
						if (result.ok && words.length > 1) {
							expect(result.value.type).toBe("OR");
						}
					},
				),
				{ numRuns: 50 },
			);
		});

		it("parses nested NOT expressions", () => {
			fc.assert(
				fc.property(fc.integer({ min: 1, max: 3 }), wordArb, (depth, word) => {
					const prefix = "-".repeat(depth);
					const result = parse(`${prefix}${word}`);
					expect(result.ok).toBe(true);
					if (result.ok) {
						let node = result.value;
						for (let i = 0; i < depth; i++) {
							expect(node.type).toBe("NOT");
							if (node.type === "NOT") {
								node = node.child;
							}
						}
					}
				}),
				{ numRuns: 30 },
			);
		});

		it("parses parenthesized expressions", () => {
			fc.assert(
				fc.property(wordArb, wordArb, wordArb, (a, b, c) => {
					const result = parse(`(${a} or ${b}) ${c}`);
					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.value.type).toBe("AND");
					}
				}),
				{ numRuns: 50 },
			);
		});

		it("parses nested parentheses", () => {
			fc.assert(
				fc.property(wordArb, wordArb, wordArb, wordArb, (a, b, c, d) => {
					const result = parse(`((${a} or ${b}) (${c} or ${d}))`);
					expect(result.ok).toBe(true);
				}),
				{ numRuns: 30 },
			);
		});
	});

	describe("describe invariants", () => {
		it("describeQuery never crashes on valid parse", () => {
			fc.assert(
				fc.property(textFieldArb, wordArb, (field, value) => {
					const query = `${field}:${value}`;
					const parseResult = parse(query);
					if (parseResult.ok) {
						const description = describeQuery(parseResult.value);
						expect(typeof description).toBe("string");
					}
				}),
				{ numRuns: 100 },
			);
		});

		it("describeQuery returns non-empty for valid queries", () => {
			fc.assert(
				fc.property(
					fc.oneof(
						fc.tuple(textFieldArb, wordArb).map(([f, v]) => `${f}:${v}`),
						fc.tuple(colorFieldArb, colorArb).map(([f, c]) => `${f}:${c}`),
						fc.tuple(numericFieldArb, numArb).map(([f, n]) => `${f}:${n}`),
					),
					(query) => {
						const parseResult = parse(query);
						if (parseResult.ok) {
							const description = describeQuery(parseResult.value);
							expect(description.length).toBeGreaterThan(0);
						}
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe("search + match invariants", () => {
		const minimalCard = {
			id: "test-id",
			name: "Test Card",
			oracle_id: "test-oracle",
			set: "tst",
			set_name: "Test Set",
			collector_number: "1",
			released_at: "2024-01-01",
			rarity: "common",
			colors: [],
			color_identity: [],
			cmc: 0,
			type_line: "Creature",
			legalities: {},
		} as unknown as Card;

		it("compiled matcher never crashes on minimal card", () => {
			fc.assert(
				fc.property(
					fc.oneof(
						wordArb,
						fc.tuple(textFieldArb, wordArb).map(([f, v]) => `${f}:${v}`),
						fc.tuple(colorFieldArb, colorArb).map(([f, c]) => `${f}:${c}`),
						fc.tuple(numericFieldArb, numArb).map(([f, n]) => `${f}=${n}`),
					),
					(query) => {
						const result = search(query);
						if (result.ok) {
							const matchResult = result.value.match(minimalCard);
							expect(typeof matchResult).toBe("boolean");
						}
					},
				),
				{ numRuns: 200 },
			);
		});

		it("compiled matcher never crashes on card with missing fields", () => {
			const sparseCard = { id: "x", name: "X" } as Card;

			fc.assert(
				fc.property(anyFieldArb, wordArb, (field, value) => {
					const result = search(`${field}:${value}`);
					if (result.ok) {
						const matchResult = result.value.match(sparseCard);
						expect(typeof matchResult).toBe("boolean");
					}
				}),
				{ numRuns: 100 },
			);
		});

		it("NOT inverts match result", () => {
			fc.assert(
				fc.property(wordArb, (word) => {
					const pos = search(word);
					const neg = search(`-${word}`);

					if (pos.ok && neg.ok) {
						const card = { ...minimalCard, name: word };
						const posMatch = pos.value.match(card);
						const negMatch = neg.value.match(card);
						expect(negMatch).toBe(!posMatch);
					}
				}),
				{ numRuns: 50 },
			);
		});

		it("OR matches if either side matches", () => {
			fc.assert(
				fc.property(wordArb, wordArb, (a, b) => {
					const result = search(`${a} or ${b}`);
					if (result.ok) {
						// Cards whose names contain the search terms
						const cardA = { ...minimalCard, name: `prefix${a}suffix` };
						const cardB = { ...minimalCard, name: `prefix${b}suffix` };

						expect(result.value.match(cardA)).toBe(true);
						expect(result.value.match(cardB)).toBe(true);
					}
				}),
				{ numRuns: 50 },
			);
		});
	});

	describe("field alias consistency", () => {
		it("all field aliases parse to FIELD nodes", () => {
			for (const alias of Object.keys(FIELD_ALIASES)) {
				const result = parse(`${alias}:test`);
				expect(result.ok).toBe(true);
				if (result.ok) {
					expect(result.value.type).toBe("FIELD");
				}
			}
		});

		it("field aliases resolve to expected canonical names", () => {
			const aliasGroups: Record<FieldName, string[]> = {
				name: ["name", "n"],
				type: ["type", "t"],
				oracle: ["oracle", "o"],
				color: ["color", "c"],
				identity: ["identity", "id"],
				manavalue: ["manavalue", "mv", "cmc"],
				power: ["power", "pow"],
				toughness: ["toughness", "tou"],
				loyalty: ["loyalty", "loy"],
				defense: ["defense", "def"],
				set: ["set", "s", "e", "edition"],
				rarity: ["rarity", "r"],
				format: ["format", "f"],
				mana: ["mana", "m"],
				keyword: ["keyword", "kw"],
				settype: ["settype", "st"],
				layout: ["layout"],
				number: ["number", "cn"],
				artist: ["artist", "a"],
				banned: ["banned"],
				restricted: ["restricted"],
				game: ["game"],
				produces: ["produces"],
				year: ["year"],
				date: ["date"],
				lang: ["lang", "language"],
				is: ["is"],
				not: ["not"],
			};

			for (const [canonical, aliases] of Object.entries(aliasGroups)) {
				for (const alias of aliases) {
					const result = parse(`${alias}:test`);
					expect(result.ok).toBe(true);
					if (result.ok && result.value.type === "FIELD") {
						expect(result.value.field).toBe(canonical);
					}
				}
			}
		});
	});
});
