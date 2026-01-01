import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parse } from "../parser";
import type { SearchNode } from "../types";

describe("parse", () => {
	function expectParse(input: string): SearchNode {
		const result = parse(input);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.error.message);
		return result.value;
	}

	function expectParseError(input: string): string {
		const result = parse(input);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("Expected parse error");
		return result.error.message;
	}

	describe("name expressions", () => {
		it("parses bare word as name", () => {
			const node = expectParse("bolt");
			expect(node.type).toBe("NAME");
			if (node.type === "NAME") {
				expect(node.value).toBe("bolt");
				expect(node.pattern).toBeNull();
			}
		});

		it("parses quoted string as name", () => {
			const node = expectParse('"Lightning Bolt"');
			expect(node.type).toBe("NAME");
			if (node.type === "NAME") {
				expect(node.value).toBe("Lightning Bolt");
			}
		});

		it("parses exact name with !", () => {
			const node = expectParse("!Lightning");
			expect(node.type).toBe("EXACT_NAME");
			if (node.type === "EXACT_NAME") {
				expect(node.value).toBe("Lightning");
			}
		});

		it("parses regex as name", () => {
			const node = expectParse("/bolt$/i");
			expect(node.type).toBe("NAME");
			if (node.type === "NAME") {
				expect(node.pattern).toBeInstanceOf(RegExp);
				expect(node.pattern?.test("Lightning Bolt")).toBe(true);
			}
		});
	});

	describe("field expressions", () => {
		it("parses type field", () => {
			const node = expectParse("t:creature");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("type");
				expect(node.operator).toBe(":");
				expect(node.value).toEqual({ kind: "string", value: "creature" });
			}
		});

		it("parses oracle field", () => {
			const node = expectParse("o:flying");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("oracle");
			}
		});

		it("parses color field as colors", () => {
			const node = expectParse("c:urg");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("color");
				expect(node.value.kind).toBe("colors");
				if (node.value.kind === "colors") {
					expect(node.value.colors).toEqual(new Set(["U", "R", "G"]));
				}
			}
		});

		it("parses identity field", () => {
			const node = expectParse("id<=bg");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("identity");
				expect(node.operator).toBe("<=");
				if (node.value.kind === "colors") {
					expect(node.value.colors).toEqual(new Set(["B", "G"]));
				}
			}
		});

		it("parses numeric fields", () => {
			const node = expectParse("cmc>=3");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("manavalue");
				expect(node.operator).toBe(">=");
				expect(node.value).toEqual({ kind: "number", value: 3 });
			}
		});

		it("parses power with star", () => {
			const node = expectParse("pow=*");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.value).toEqual({ kind: "string", value: "*" });
			}
		});

		it("parses regex in field", () => {
			const node = expectParse("o:/draw.*card/");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.value.kind).toBe("regex");
			}
		});

		it("parses format field", () => {
			const node = expectParse("f:commander");
			expect(node.type).toBe("FIELD");
			if (node.type === "FIELD") {
				expect(node.field).toBe("format");
				expect(node.value).toEqual({ kind: "string", value: "commander" });
			}
		});
	});

	describe("boolean operators", () => {
		it("parses implicit AND", () => {
			const node = expectParse("t:creature c:g");
			expect(node.type).toBe("AND");
			if (node.type === "AND") {
				expect(node.children).toHaveLength(2);
			}
		});

		it("parses explicit OR", () => {
			const node = expectParse("t:creature or t:artifact");
			expect(node.type).toBe("OR");
			if (node.type === "OR") {
				expect(node.children).toHaveLength(2);
			}
		});

		it("parses NOT", () => {
			const node = expectParse("-t:creature");
			expect(node.type).toBe("NOT");
			if (node.type === "NOT") {
				expect(node.child.type).toBe("FIELD");
			}
		});

		it("parses parentheses", () => {
			const node = expectParse("(t:creature or t:artifact) c:r");
			expect(node.type).toBe("AND");
			if (node.type === "AND") {
				expect(node.children[0].type).toBe("OR");
			}
		});

		it("NOT binds tighter than AND", () => {
			const node = expectParse("-t:creature c:g");
			expect(node.type).toBe("AND");
			if (node.type === "AND") {
				expect(node.children[0].type).toBe("NOT");
			}
		});

		it("AND binds tighter than OR", () => {
			const node = expectParse("a b or c d");
			expect(node.type).toBe("OR");
			if (node.type === "OR") {
				expect(node.children).toHaveLength(2);
				expect(node.children[0].type).toBe("AND");
				expect(node.children[1].type).toBe("AND");
			}
		});
	});

	describe("complex queries", () => {
		it("parses commander deckbuilding query", () => {
			const node = expectParse("id<=bg t:creature cmc<=3");
			expect(node.type).toBe("AND");
			if (node.type === "AND") {
				expect(node.children).toHaveLength(3);
			}
		});

		it("parses nested groups", () => {
			const node = expectParse("((a or b) (c or d))");
			expect(node.type).toBe("AND");
		});

		it("parses word that looks like field but isnt", () => {
			// "is" without : should be treated as name
			const node = expectParse("is cool");
			expect(node.type).toBe("AND");
			if (node.type === "AND") {
				expect(node.children[0].type).toBe("NAME");
				expect(node.children[1].type).toBe("NAME");
			}
		});
	});

	describe("error handling", () => {
		it("errors on empty query", () => {
			const msg = expectParseError("");
			expect(msg).toContain("Empty");
		});

		it("errors on unmatched paren", () => {
			const msg = expectParseError("(foo");
			expect(msg).toContain("parenthesis");
		});

		it("errors on trailing garbage", () => {
			const msg = expectParseError("foo )");
			expect(msg).toContain("Unexpected");
		});
	});

	describe("span tracking", () => {
		it("tracks span for simple term", () => {
			const node = expectParse("bolt");
			expect(node.span).toEqual({ start: 0, end: 4 });
		});

		it("tracks span for field expression", () => {
			const node = expectParse("t:creature");
			expect(node.span).toEqual({ start: 0, end: 10 });
		});

		it("tracks span for AND expression", () => {
			const node = expectParse("foo bar");
			expect(node.span).toEqual({ start: 0, end: 7 });
		});
	});

	describe("property tests", () => {
		const wordArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,8}$/);
		const fieldArb = fc.constantFrom("t", "o", "c", "cmc", "pow");
		const opArb = fc.constantFrom(":", "=", ">=", "<=", ">", "<");

		it("parses any valid field expression", () => {
			fc.assert(
				fc.property(fieldArb, opArb, wordArb, (field, op, value) => {
					const result = parse(`${field}${op}${value}`);
					expect(result.ok).toBe(true);
				}),
				{ numRuns: 100 },
			);
		});

		it("parses any sequence of words", () => {
			fc.assert(
				fc.property(
					fc.array(wordArb, { minLength: 1, maxLength: 5 }),
					(words) => {
						const result = parse(words.join(" "));
						expect(result.ok).toBe(true);
					},
				),
				{ numRuns: 100 },
			);
		});

		it("parses OR combinations", () => {
			fc.assert(
				fc.property(wordArb, wordArb, (a, b) => {
					const result = parse(`${a} or ${b}`);
					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.value.type).toBe("OR");
					}
				}),
				{ numRuns: 50 },
			);
		});

		it("parses NOT expressions", () => {
			fc.assert(
				fc.property(wordArb, (word) => {
					const result = parse(`-${word}`);
					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.value.type).toBe("NOT");
					}
				}),
				{ numRuns: 50 },
			);
		});

		it("parses grouped expressions", () => {
			fc.assert(
				fc.property(wordArb, wordArb, (a, b) => {
					const result = parse(`(${a} or ${b})`);
					expect(result.ok).toBe(true);
				}),
				{ numRuns: 50 },
			);
		});
	});
});
