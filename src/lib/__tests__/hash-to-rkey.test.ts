/**
 * Property-based tests for hashToRkey
 *
 * Tests the deterministic rkey generation used for like records.
 * Uses fast-check for generative testing across the input space.
 *
 * Note: Key order independence only applies to top-level keys.
 * Nested objects are not recursively sorted.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hashToRkey } from "../atproto-client";

const RKEY_LENGTH = 43;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

describe("hashToRkey", () => {
	describe("output format", () => {
		it("always produces 43-character base64url string for flat objects", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						a: fc.string(),
						b: fc.integer(),
						c: fc.boolean(),
					}),
					async (obj) => {
						const result = await hashToRkey(obj);
						expect(result).toHaveLength(RKEY_LENGTH);
						expect(result).toMatch(BASE64URL_PATTERN);
					},
				),
				{ numRuns: 200 },
			);
		});

		it("always produces 43-character base64url string for strings", async () => {
			await fc.assert(
				fc.asyncProperty(fc.string(), async (str) => {
					const result = await hashToRkey(str);
					expect(result).toHaveLength(RKEY_LENGTH);
					expect(result).toMatch(BASE64URL_PATTERN);
				}),
				{ numRuns: 200 },
			);
		});

		it("never contains base64 padding or standard base64 chars", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({ key: fc.string(), value: fc.integer() }),
					async (val) => {
						const result = await hashToRkey(val);
						expect(result).not.toContain("=");
						expect(result).not.toContain("+");
						expect(result).not.toContain("/");
					},
				),
				{ numRuns: 200 },
			);
		});
	});

	describe("determinism", () => {
		it("produces same output for same object input", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({ x: fc.string(), y: fc.integer() }),
					async (obj) => {
						const result1 = await hashToRkey(obj);
						const result2 = await hashToRkey(obj);
						expect(result1).toBe(result2);
					},
				),
				{ numRuns: 100 },
			);
		});

		it("produces same output for structurally identical objects", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						a: fc.integer(),
						b: fc.string(),
						c: fc.boolean(),
					}),
					async (template) => {
						const obj1 = { ...template };
						const obj2 = { ...template };
						const result1 = await hashToRkey(obj1);
						const result2 = await hashToRkey(obj2);
						expect(result1).toBe(result2);
					},
				),
				{ numRuns: 100 },
			);
		});
	});

	describe("collision resistance", () => {
		it("produces different output for different integers", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.integer().filter((n) => n !== 0),
					async (a) => {
						const result1 = await hashToRkey({ n: a });
						const result2 = await hashToRkey({ n: a + 1 });
						expect(result1).not.toBe(result2);
					},
				),
				{ numRuns: 100 },
			);
		});

		it("produces different output for different strings", async () => {
			await fc.assert(
				fc.asyncProperty(fc.string({ minLength: 1 }), async (a) => {
					const result1 = await hashToRkey({ s: a });
					const result2 = await hashToRkey({ s: `${a}x` });
					expect(result1).not.toBe(result2);
				}),
				{ numRuns: 100 },
			);
		});

		it("produces different output for objects with different values", async () => {
			await fc.assert(
				fc.asyncProperty(fc.integer(), async (n) => {
					const result1 = await hashToRkey({ value: n });
					const result2 = await hashToRkey({ value: n + 1 });
					expect(result1).not.toBe(result2);
				}),
				{ numRuns: 100 },
			);
		});
	});

	describe("key order independence (top-level only)", () => {
		it("same hash regardless of key insertion order", async () => {
			const obj1 = { a: 1, b: 2, c: 3 };
			const obj2 = { c: 3, b: 2, a: 1 };
			const obj3 = { b: 2, a: 1, c: 3 };

			const result1 = await hashToRkey(obj1);
			const result2 = await hashToRkey(obj2);
			const result3 = await hashToRkey(obj3);

			expect(result1).toBe(result2);
			expect(result2).toBe(result3);
		});

		it("same hash for shuffled key order with arbitrary values", async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.integer(),
					fc.string(),
					fc.boolean(),
					async (a, b, c) => {
						const obj1 = { a, b, c };
						const obj2 = { c, b, a };
						const obj3 = { b, a, c };

						const result1 = await hashToRkey(obj1);
						const result2 = await hashToRkey(obj2);
						const result3 = await hashToRkey(obj3);

						expect(result1).toBe(result2);
						expect(result2).toBe(result3);
					},
				),
				{ numRuns: 100 },
			);
		});

		it("like subjects hash identically regardless of construction", async () => {
			await fc.assert(
				fc.asyncProperty(fc.string(), fc.string(), async (uri, cid) => {
					const subject1 = {
						$type: "com.deckbelcher.social.like#recordSubject",
						ref: { uri, cid },
					};
					const subject2 = {
						ref: { uri, cid },
						$type: "com.deckbelcher.social.like#recordSubject",
					};

					const result1 = await hashToRkey(subject1);
					const result2 = await hashToRkey(subject2);

					expect(result1).toBe(result2);
				}),
				{ numRuns: 100 },
			);
		});
	});

	describe("edge cases", () => {
		it("handles empty object", async () => {
			const result = await hashToRkey({});
			expect(result).toHaveLength(RKEY_LENGTH);
			expect(result).toMatch(BASE64URL_PATTERN);
		});

		it("handles empty string", async () => {
			const result = await hashToRkey("");
			expect(result).toHaveLength(RKEY_LENGTH);
			expect(result).toMatch(BASE64URL_PATTERN);
		});

		it("handles empty array", async () => {
			const result = await hashToRkey([]);
			expect(result).toHaveLength(RKEY_LENGTH);
			expect(result).toMatch(BASE64URL_PATTERN);
		});

		it("handles deeply nested objects", async () => {
			const deep = { a: { b: { c: { d: { e: { f: "value" } } } } } };
			const result = await hashToRkey(deep);
			expect(result).toHaveLength(RKEY_LENGTH);
			expect(result).toMatch(BASE64URL_PATTERN);
		});

		it("handles objects with special characters in values", async () => {
			const obj = {
				emoji: "emoji",
				unicode: "unicode",
				newline: "line1\nline2",
				tab: "col1\tcol2",
			};
			const result = await hashToRkey(obj);
			expect(result).toHaveLength(RKEY_LENGTH);
			expect(result).toMatch(BASE64URL_PATTERN);
		});
	});
});
