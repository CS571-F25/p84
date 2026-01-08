import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ByteString } from "../byte-string";
import { parseMarkdown } from "../parser";
import { serializeToMarkdown } from "../serializer";

describe("roundtrip property tests", () => {
	it("parse → serialize roundtrips valid markdown", () => {
		// Generate markdown with valid formatting
		const wordArb = fc.stringMatching(/^[a-zA-Z0-9 ]{1,10}$/);

		const boldArb = wordArb.map((w) => `**${w}**`);
		const italicArb = wordArb.map((w) => `*${w}*`);
		const plainArb = wordArb;

		const segmentArb = fc.oneof(boldArb, italicArb, plainArb);
		const markdownArb = fc
			.array(segmentArb, { minLength: 1, maxLength: 5 })
			.map((segs) => segs.join(" "));

		fc.assert(
			fc.property(markdownArb, (md) => {
				const { text, facets } = parseMarkdown(md);
				const roundtripped = serializeToMarkdown(text, facets);
				expect(roundtripped).toBe(md);
			}),
			{ numRuns: 200 },
		);
	});

	it("facet byte indices are always valid after parsing", () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				const { text, facets } = parseMarkdown(input);
				const bs = new ByteString(text);

				for (const facet of facets) {
					expect(facet.index.byteStart).toBeGreaterThanOrEqual(0);
					expect(facet.index.byteEnd).toBeLessThanOrEqual(bs.length);
					expect(facet.index.byteStart).toBeLessThan(facet.index.byteEnd);
				}
			}),
			{ numRuns: 200 },
		);
	});

	it("parser never crashes on arbitrary input", () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				expect(() => parseMarkdown(input)).not.toThrow();
			}),
			{ numRuns: 500 },
		);
	});

	it("serializer never crashes on arbitrary facets (adversarial input)", () => {
		// Facets from untrusted ATProto records could have any values
		const facetArb = fc.record({
			index: fc.record({
				byteStart: fc.integer({ min: -100, max: 1000 }),
				byteEnd: fc.integer({ min: -100, max: 1000 }),
			}),
			features: fc.array(
				fc.oneof(
					fc.constant({
						$type: "com.deckbelcher.richtext.facet#bold" as const,
					}),
					fc.constant({
						$type: "com.deckbelcher.richtext.facet#italic" as const,
					}),
				),
				{ minLength: 0, maxLength: 3 },
			),
		});

		fc.assert(
			fc.property(
				fc.string(),
				fc.array(facetArb, { maxLength: 20 }),
				(text, facets) => {
					// Serializer must handle ANY input without crashing
					expect(() => serializeToMarkdown(text, facets)).not.toThrow();
				},
			),
			{ numRuns: 500 },
		);
	});

	it("handles unicode in roundtrip", () => {
		// CJK, emoji, and ASCII mixed
		const unicodeWordArb = fc.stringMatching(
			/^[\u4e00-\u9fff\u{1F600}-\u{1F64F}a-z]{1,5}$/u,
		);

		const boldArb = unicodeWordArb.map((w) => `**${w}**`);
		const italicArb = unicodeWordArb.map((w) => `*${w}*`);
		const plainArb = unicodeWordArb;

		const segmentArb = fc.oneof(boldArb, italicArb, plainArb);
		const markdownArb = fc
			.array(segmentArb, { minLength: 1, maxLength: 5 })
			.map((segs) => segs.join(" "));

		fc.assert(
			fc.property(markdownArb, (md) => {
				const { text, facets } = parseMarkdown(md);
				const roundtripped = serializeToMarkdown(text, facets);
				expect(roundtripped).toBe(md);
			}),
			{ numRuns: 200 },
		);
	});

	it("handles family emoji (25 bytes) in formatted spans", () => {
		const familyEmoji = "👨‍👩‍👧‍👧";
		const inputs = [
			`**${familyEmoji}**`,
			`*${familyEmoji}*`,
			`${familyEmoji} **text**`,
			`**text** ${familyEmoji}`,
			`${familyEmoji} **${familyEmoji}** ${familyEmoji}`,
		];

		for (const input of inputs) {
			const { text, facets } = parseMarkdown(input);
			const output = serializeToMarkdown(text, facets);
			expect(output).toBe(input);
		}
	});

	it("arbitrary UTF-8 roundtrips through parse→serialize", () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				const { text, facets } = parseMarkdown(input);
				const output = serializeToMarkdown(text, facets);
				expect(output).toBe(input);
			}),
			{ numRuns: 10_000 },
		);
	});
});
