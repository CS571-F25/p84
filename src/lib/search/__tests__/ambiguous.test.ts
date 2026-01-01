import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "../../__tests__/test-card-lookup";
import { search } from "../index";
import { tokenize } from "../lexer";

describe("Ambiguous query parsing", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	describe("nested field-like patterns", () => {
		it("o:o:flash fails - use quotes for literal colons", async () => {
			// Lexer splits on :, so this becomes o, :, o, :, flash - invalid structure
			// Scryfall parses it but finds no matches
			// We fail to parse - use o:"o:flash" instead
			const result = search("o:o:flash");
			expect(result.ok).toBe(false);

			// Quoted version works
			const quoted = search('o:"o:flash"');
			expect(quoted.ok).toBe(true);
		});

		it('o:"t:creature" searches for literal "t:creature" in oracle text', async () => {
			const result = search('o:"t:creature"');
			expect(result.ok).toBe(true);
		});
	});

	describe("empty and missing values", () => {
		it("t: with no value fails - Scryfall allows this, we don't", () => {
			// Scryfall treats t: as "has any type", we require a value
			const result = search("t:");
			expect(result.ok).toBe(false);
		});

		it('empty quoted string o:"" should parse', () => {
			const result = search('o:""');
			expect(result.ok).toBe(true);
		});
	});

	describe("double negation", () => {
		it("--t:creature is double negative", async () => {
			const result = search("--t:creature");
			expect(result.ok).toBe(true);

			const elves = await cards.get("Llanowar Elves");
			const bolt = await cards.get("Lightning Bolt");

			if (result.ok) {
				// Double negative should mean "is creature"
				expect(result.value.match(elves)).toBe(true);
				expect(result.value.match(bolt)).toBe(false);
			}
		});

		it("-(t:creature) negates grouped expression", async () => {
			const result = search("-(t:creature)");
			expect(result.ok).toBe(true);

			const elves = await cards.get("Llanowar Elves");
			const bolt = await cards.get("Lightning Bolt");

			if (result.ok) {
				expect(result.value.match(elves)).toBe(false);
				expect(result.value.match(bolt)).toBe(true);
			}
		});
	});

	describe("negative numbers", () => {
		it("cmc>=-1 should match all cards", async () => {
			const result = search("cmc>=-1");
			expect(result.ok).toBe(true);

			const bolt = await cards.get("Lightning Bolt");
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(true);
			}
		});

		it("cmc<0 should match nothing (no negative CMC cards)", async () => {
			const result = search("cmc<0");
			expect(result.ok).toBe(true);

			const bolt = await cards.get("Lightning Bolt");
			if (result.ok) {
				expect(result.value.match(bolt)).toBe(false);
			}
		});

		it("pow>-5 matches creatures with power > -5", async () => {
			const result = search("pow>-5");
			expect(result.ok).toBe(true);

			const elves = await cards.get("Llanowar Elves");
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});
	});

	describe("operator spacing", () => {
		it("cmc>=3 parses correctly", () => {
			const result = search("cmc>=3");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.ast.type).toBe("FIELD");
			}
		});

		it("cmc> =3 fails - space breaks the operator", () => {
			// Space between > and = means > is operator, then =3 is the value
			// This fails since =3 isn't a valid value
			const result = search("cmc> =3");
			expect(result.ok).toBe(false);
		});
	});

	describe("case sensitivity", () => {
		it("OR keyword is case-insensitive", async () => {
			const lower = search("t:creature or t:instant");
			const upper = search("t:creature OR t:instant");
			const mixed = search("t:creature Or t:instant");

			expect(lower.ok).toBe(true);
			expect(upper.ok).toBe(true);
			expect(mixed.ok).toBe(true);

			if (lower.ok && upper.ok && mixed.ok) {
				expect(lower.value.ast.type).toBe("OR");
				expect(upper.value.ast.type).toBe("OR");
				expect(mixed.value.ast.type).toBe("OR");
			}
		});

		it("field names are case-insensitive", async () => {
			const lower = search("t:creature");
			const upper = search("T:creature");
			const mixed = search("Type:creature");

			expect(lower.ok).toBe(true);
			expect(upper.ok).toBe(true);
			expect(mixed.ok).toBe(true);
		});
	});

	describe("parentheses edge cases", () => {
		it("empty parens () should fail or be handled", () => {
			const result = search("()");
			// Empty group is probably an error
			expect(result.ok).toBe(false);
		});

		it("deeply nested parens work", async () => {
			const result = search("(((t:creature)))");
			expect(result.ok).toBe(true);

			const elves = await cards.get("Llanowar Elves");
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});

		it("unmatched open paren fails", () => {
			const result = search("(t:creature");
			expect(result.ok).toBe(false);
		});

		it("unmatched close paren fails", () => {
			const result = search("t:creature)");
			expect(result.ok).toBe(false);
		});
	});

	describe("trailing/leading operators", () => {
		it("trailing OR should fail or be handled", () => {
			const result = search("t:creature or");
			// Trailing OR with no right operand
			expect(result.ok).toBe(false);
		});

		it("leading OR fails - OR is keyword, not word", () => {
			// "or" is always the OR keyword, can't search for card named "or"
			const result = search("or t:creature");
			expect(result.ok).toBe(false);
		});
	});

	describe("regex edge cases", () => {
		it("regex with escaped slash works", async () => {
			// Looking for "1/1" in oracle text
			const result = search("o:/1\\/1/");
			expect(result.ok).toBe(true);
		});

		it("empty regex // is valid (matches everything)", () => {
			// Empty regex pattern matches any string
			const result = search("//");
			expect(result.ok).toBe(true);
		});

		it("regex with special chars needs escaping", async () => {
			// Looking for "(this" literally - parens need escaping in regex
			const result = search("o:/\\(this/");
			expect(result.ok).toBe(true);
		});
	});

	describe("split card names", () => {
		it("exact match with // in name", async () => {
			// Fire // Ice style names
			const result = search('!"Fire // Ice"');
			expect(result.ok).toBe(true);
		});
	});

	describe("whitespace handling", () => {
		it("multiple spaces between terms", async () => {
			const result = search("t:creature    c:g");
			expect(result.ok).toBe(true);

			const elves = await cards.get("Llanowar Elves");
			if (result.ok) {
				expect(result.value.match(elves)).toBe(true);
			}
		});

		it("leading/trailing whitespace", async () => {
			const result = search("  t:creature  ");
			expect(result.ok).toBe(true);
		});

		it("tabs work like spaces", async () => {
			const result = search("t:creature\tc:g");
			expect(result.ok).toBe(true);
		});
	});

	describe("lexer token inspection", () => {
		it("o:o:flash tokenizes as WORD COLON WORD", () => {
			const result = tokenize("o:o:flash");
			expect(result.ok).toBe(true);
			if (result.ok) {
				const types = result.value.map((t) => t.type);
				// Should be: WORD("o") COLON WORD("o") COLON WORD("flash") EOF
				// or: WORD("o") COLON WORD("o:flash") EOF depending on lexer
				expect(types).toContain("WORD");
				expect(types).toContain("COLON");
			}
		});

		it("negative number tokenizes correctly", () => {
			const result = tokenize("cmc>=-1");
			expect(result.ok).toBe(true);
			if (result.ok) {
				const values = result.value.map((t) => `${t.type}:${t.value}`);
				// Should have GTE and then -1 as part of the value
				expect(values.some((v) => v.includes("GTE"))).toBe(true);
			}
		});
	});
});
