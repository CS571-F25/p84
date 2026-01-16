/**
 * Property-based tests for hashToRkey
 *
 * Tests the deterministic rkey generation used for like records.
 * Uses fast-check for generative testing across the input space.
 *
 * IMPORTANT: hashToRkey only works correctly with flat objects (no nesting).
 * Nested objects are stripped due to JSON.stringify's array replacer behavior.
 * Always pass flat objects like `subject.ref`, not the whole subject.
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

	describe("key order independence", () => {
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

		it("like subject refs hash identically regardless of key order", async () => {
			await fc.assert(
				fc.asyncProperty(fc.string(), fc.string(), async (uri, cid) => {
					// Pass the flat ref object, not the nested subject
					const ref1 = { uri, cid };
					const ref2 = { cid, uri };

					const result1 = await hashToRkey(ref1);
					const result2 = await hashToRkey(ref2);

					expect(result1).toBe(result2);
				}),
				{ numRuns: 100 },
			);
		});

		it("different refs produce different hashes", async () => {
			const ref1 = { uri: "at://did:plc:abc/com.foo/123", cid: "bafycid1" };
			const ref2 = { uri: "at://did:plc:xyz/com.foo/456", cid: "bafycid2" };

			const result1 = await hashToRkey(ref1);
			const result2 = await hashToRkey(ref2);

			expect(result1).not.toBe(result2);
		});
	});

	describe("edge cases", () => {
		it("handles empty object", async () => {
			const result = await hashToRkey({});
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
