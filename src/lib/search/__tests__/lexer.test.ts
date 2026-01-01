import { describe, expect, it } from "vitest";
import { getRegexPattern, tokenize } from "../lexer";

describe("tokenize", () => {
	function expectTokens(
		input: string,
		expected: Array<{ type: string; value: string }>,
	) {
		const result = tokenize(input);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const tokens = result.value.slice(0, -1); // exclude EOF
		expect(tokens).toHaveLength(expected.length);
		for (let i = 0; i < expected.length; i++) {
			expect(tokens[i].type).toBe(expected[i].type);
			expect(tokens[i].value).toBe(expected[i].value);
		}
	}

	describe("simple tokens", () => {
		it("tokenizes parentheses", () => {
			expectTokens("()", [
				{ type: "LPAREN", value: "(" },
				{ type: "RPAREN", value: ")" },
			]);
		});

		it("tokenizes comparison operators", () => {
			expectTokens(": = != < > <= >=", [
				{ type: "COLON", value: ":" },
				{ type: "EQUALS", value: "=" },
				{ type: "NOT_EQUALS", value: "!=" },
				{ type: "LT", value: "<" },
				{ type: "GT", value: ">" },
				{ type: "LTE", value: "<=" },
				{ type: "GTE", value: ">=" },
			]);
		});

		it("tokenizes NOT operator", () => {
			expectTokens("-foo", [
				{ type: "NOT", value: "-" },
				{ type: "WORD", value: "foo" },
			]);
		});

		it("tokenizes OR keyword", () => {
			expectTokens("foo or bar OR baz", [
				{ type: "WORD", value: "foo" },
				{ type: "OR", value: "or" },
				{ type: "WORD", value: "bar" },
				{ type: "OR", value: "OR" },
				{ type: "WORD", value: "baz" },
			]);
		});
	});

	describe("words", () => {
		it("tokenizes simple words", () => {
			expectTokens("hello world", [
				{ type: "WORD", value: "hello" },
				{ type: "WORD", value: "world" },
			]);
		});

		it("tokenizes field-like words", () => {
			expectTokens("t:creature", [
				{ type: "WORD", value: "t" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "creature" },
			]);
		});

		it("tokenizes numeric comparisons", () => {
			expectTokens("cmc>=3", [
				{ type: "WORD", value: "cmc" },
				{ type: "GTE", value: ">=" },
				{ type: "WORD", value: "3" },
			]);
		});
	});

	describe("quoted strings", () => {
		it("tokenizes quoted strings", () => {
			expectTokens('"Serra Angel"', [{ type: "QUOTED", value: "Serra Angel" }]);
		});

		it("handles escaped quotes", () => {
			expectTokens('"say \\"hello\\""', [
				{ type: "QUOTED", value: 'say "hello"' },
			]);
		});

		it("returns error for unterminated quote", () => {
			const result = tokenize('"unterminated');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Unterminated");
			}
		});
	});

	describe("regex", () => {
		it("tokenizes regex", () => {
			expectTokens("/goblin|elf/", [{ type: "REGEX", value: "goblin|elf" }]);
		});

		it("stores compiled pattern", () => {
			const result = tokenize("/^bolt$/i");
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			const token = result.value[0];
			expect(token.type).toBe("REGEX");
			const pattern = getRegexPattern(token);
			expect(pattern).toBeInstanceOf(RegExp);
			expect(pattern?.test("bolt")).toBe(true);
			expect(pattern?.test("BOLT")).toBe(true);
		});

		it("returns error for invalid regex", () => {
			const result = tokenize("/[invalid/");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Invalid regex");
			}
		});

		it("returns error for unterminated regex", () => {
			const result = tokenize("/unterminated");
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.message).toContain("Unterminated");
			}
		});
	});

	describe("exact name", () => {
		it("tokenizes exact name with !", () => {
			expectTokens("!Lightning", [{ type: "EXACT_NAME", value: "Lightning" }]);
		});

		it("tokenizes quoted exact name", () => {
			expectTokens('!"Lightning Bolt"', [
				{ type: "EXACT_NAME", value: "Lightning Bolt" },
			]);
		});
	});

	describe("complex queries", () => {
		it("tokenizes field expressions", () => {
			expectTokens("t:creature o:flying", [
				{ type: "WORD", value: "t" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "creature" },
				{ type: "WORD", value: "o" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "flying" },
			]);
		});

		it("tokenizes nested expressions", () => {
			expectTokens("(t:creature or t:artifact) -c:r", [
				{ type: "LPAREN", value: "(" },
				{ type: "WORD", value: "t" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "creature" },
				{ type: "OR", value: "or" },
				{ type: "WORD", value: "t" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "artifact" },
				{ type: "RPAREN", value: ")" },
				{ type: "NOT", value: "-" },
				{ type: "WORD", value: "c" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "r" },
			]);
		});

		it("tokenizes commander identity query", () => {
			expectTokens("id<=bg f:commander", [
				{ type: "WORD", value: "id" },
				{ type: "LTE", value: "<=" },
				{ type: "WORD", value: "bg" },
				{ type: "WORD", value: "f" },
				{ type: "COLON", value: ":" },
				{ type: "WORD", value: "commander" },
			]);
		});
	});

	describe("span tracking", () => {
		it("tracks token positions", () => {
			const result = tokenize("foo bar");
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value[0].span).toEqual({ start: 0, end: 3 });
			expect(result.value[1].span).toEqual({ start: 4, end: 7 });
		});

		it("tracks multi-character operator positions", () => {
			const result = tokenize("cmc>=3");
			expect(result.ok).toBe(true);
			if (!result.ok) return;

			expect(result.value[0].span).toEqual({ start: 0, end: 3 }); // cmc
			expect(result.value[1].span).toEqual({ start: 3, end: 5 }); // >=
			expect(result.value[2].span).toEqual({ start: 5, end: 6 }); // 3
		});
	});
});
