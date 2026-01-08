import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../parser";
import { serializeToMarkdown } from "../serializer";
import { BOLD, type Facet, ITALIC } from "../types";

describe("adversarial inputs", () => {
	describe("parser handles edge cases", () => {
		const ADVERSARIAL_INPUTS = [
			"",
			"*",
			"**",
			"***",
			"****",
			"*****",
			"[[]]",
			"[[",
			"]]",
			"[[[[nested]]]]",
			"@".repeat(1000),
			"*".repeat(1000),
			"**".repeat(500),
			"\u0000\u0001\u0002",
			"**\u200b**",
			"*\u200b*",
			"**a\nb**",
			"*a\nb*",
			"**🔥**",
			"*🔥*",
			"[[🔥]]",
			"\u202EtloB gninthgiL",
			"a**b*c**d*e",
			"**a*b*c**",
			"*a**b**c*",
			"\\*not italic\\*",
			"\\**not bold\\**",
			" ** spaced ** ",
			"** no close",
			"no open **",
			"a]b[c",
			"🔥".repeat(100),
			"日本語".repeat(100),
			"\t\n\r **bold** \t\n\r",
		];

		it.each(ADVERSARIAL_INPUTS)("never crashes on: %j", (input) => {
			expect(() => parseMarkdown(input)).not.toThrow();
		});

		it.each(ADVERSARIAL_INPUTS)("produces valid facets for: %j", (input) => {
			const { text, facets } = parseMarkdown(input);
			const encoder = new TextEncoder();
			const bytes = encoder.encode(text);

			for (const facet of facets) {
				expect(facet.index.byteStart).toBeGreaterThanOrEqual(0);
				expect(facet.index.byteEnd).toBeLessThanOrEqual(bytes.length);
				expect(facet.index.byteStart).toBeLessThan(facet.index.byteEnd);
				expect(facet.features.length).toBeGreaterThan(0);
			}
		});
	});

	describe("serializer handles malformed facets", () => {
		const text = "hello world";

		it.each([
			[[{ index: { byteStart: -1, byteEnd: 5 }, features: [BOLD] }]],
			[[{ index: { byteStart: 0, byteEnd: -1 }, features: [BOLD] }]],
			[[{ index: { byteStart: 5, byteEnd: 5 }, features: [BOLD] }]],
			[[{ index: { byteStart: 10, byteEnd: 5 }, features: [BOLD] }]],
			[[{ index: { byteStart: 0, byteEnd: 1000 }, features: [BOLD] }]],
			[[{ index: { byteStart: 1000, byteEnd: 2000 }, features: [BOLD] }]],
			[[{ index: { byteStart: 0, byteEnd: 5 }, features: [] }]],
			[
				[
					{ index: { byteStart: 0, byteEnd: 5 }, features: [BOLD] },
					{ index: { byteStart: -10, byteEnd: 100 }, features: [ITALIC] },
				],
			],
		])("handles invalid facets gracefully: %j", (facets) => {
			expect(() => serializeToMarkdown(text, facets as Facet[])).not.toThrow();
		});

		it("skips facets with negative byteStart", () => {
			const facets: Facet[] = [
				{ index: { byteStart: -1, byteEnd: 5 }, features: [BOLD] },
			];
			expect(serializeToMarkdown(text, facets)).toBe(text);
		});

		it("skips facets with byteEnd > text length", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 1000 }, features: [BOLD] },
			];
			expect(serializeToMarkdown(text, facets)).toBe(text);
		});

		it("skips facets with byteStart >= byteEnd", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 5, byteEnd: 5 }, features: [BOLD] },
				{ index: { byteStart: 8, byteEnd: 3 }, features: [ITALIC] },
			];
			expect(serializeToMarkdown(text, facets)).toBe(text);
		});

		it("skips facets with empty features", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 5 }, features: [] },
			];
			expect(serializeToMarkdown(text, facets)).toBe(text);
		});

		it("processes valid facets while skipping invalid ones", () => {
			const facets: Facet[] = [
				{ index: { byteStart: -1, byteEnd: 5 }, features: [BOLD] },
				{ index: { byteStart: 0, byteEnd: 5 }, features: [ITALIC] },
				{ index: { byteStart: 0, byteEnd: 1000 }, features: [BOLD] },
			];
			expect(serializeToMarkdown(text, facets)).toBe("*hello* world");
		});
	});

	describe("unicode edge cases", () => {
		it("handles zero-width characters", () => {
			const input = "**\u200b**";
			const result = parseMarkdown(input);
			expect(result.text).toBe("\u200b");
			expect(result.facets).toHaveLength(1);
		});

		it("handles RTL override characters", () => {
			const input = "**\u202Etext\u202C**";
			const result = parseMarkdown(input);
			expect(result.facets).toHaveLength(1);
		});

		it("handles combining characters", () => {
			const input = "**e\u0301**"; // é as e + combining acute
			const result = parseMarkdown(input);
			expect(result.facets).toHaveLength(1);
		});

		it("handles surrogate pairs (emoji)", () => {
			const input = "**\u{1F600}**"; // 😀
			const result = parseMarkdown(input);
			expect(result.text).toBe("😀");
			expect(result.facets).toHaveLength(1);
		});
	});
});
