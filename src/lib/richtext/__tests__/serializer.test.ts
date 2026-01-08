import { describe, expect, it } from "vitest";
import { serializeToMarkdown } from "../serializer";
import { BOLD, type Facet, ITALIC } from "../types";

describe("serializeToMarkdown", () => {
	it("returns text unchanged with no facets", () => {
		expect(serializeToMarkdown("hello world", [])).toBe("hello world");
	});

	it("serializes simple bold", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
		];
		expect(serializeToMarkdown("bold", facets)).toBe("**bold**");
	});

	it("serializes simple italic", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 6 }, features: [ITALIC] },
		];
		expect(serializeToMarkdown("italic", facets)).toBe("*italic*");
	});

	it("serializes bold in middle of text", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 6, byteEnd: 11 }, features: [BOLD] },
		];
		expect(serializeToMarkdown("hello world there", facets)).toBe(
			"hello **world** there",
		);
	});

	it("serializes multiple bold spans", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 1 }, features: [BOLD] },
			{ index: { byteStart: 2, byteEnd: 3 }, features: [BOLD] },
		];
		expect(serializeToMarkdown("abc", facets)).toBe("**a**b**c**");
	});

	it("serializes overlapping bold and italic (same range)", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			{ index: { byteStart: 0, byteEnd: 4 }, features: [ITALIC] },
		];
		expect(serializeToMarkdown("both", facets)).toBe("***both***");
	});

	it("serializes nested italic in bold", () => {
		// "before bold after" = 17 bytes
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 17 }, features: [BOLD] },
			{ index: { byteStart: 7, byteEnd: 11 }, features: [ITALIC] },
		];
		expect(serializeToMarkdown("before bold after", facets)).toBe(
			"**before *bold* after**",
		);
	});

	it("handles unicode", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 9 }, features: [BOLD] },
		];
		expect(serializeToMarkdown("日本語", facets)).toBe("**日本語**");
	});

	it("handles emoji", () => {
		const facets: Facet[] = [
			{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
		];
		expect(serializeToMarkdown("🔥", facets)).toBe("**🔥**");
	});
});
