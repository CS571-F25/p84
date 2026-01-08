import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../parser";
import { BOLD, ITALIC } from "../types";

describe("parseMarkdown", () => {
	describe("plain text", () => {
		it("returns empty for empty input", () => {
			const result = parseMarkdown("");
			expect(result.text).toBe("");
			expect(result.facets).toEqual([]);
		});

		it("returns text unchanged with no markers", () => {
			const result = parseMarkdown("hello world");
			expect(result.text).toBe("hello world");
			expect(result.facets).toEqual([]);
		});
	});

	describe("bold", () => {
		it("parses simple bold", () => {
			const result = parseMarkdown("**bold**");
			expect(result.text).toBe("bold");
			expect(result.facets).toEqual([
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			]);
		});

		it("parses bold in middle of text", () => {
			const result = parseMarkdown("hello **world** there");
			expect(result.text).toBe("hello world there");
			expect(result.facets).toEqual([
				{ index: { byteStart: 6, byteEnd: 11 }, features: [BOLD] },
			]);
		});

		it("parses multiple bold spans", () => {
			const result = parseMarkdown("**a**b**c**");
			expect(result.text).toBe("abc");
			expect(result.facets).toEqual([
				{ index: { byteStart: 0, byteEnd: 1 }, features: [BOLD] },
				{ index: { byteStart: 2, byteEnd: 3 }, features: [BOLD] },
			]);
		});
	});

	describe("italic", () => {
		it("parses simple italic", () => {
			const result = parseMarkdown("*italic*");
			expect(result.text).toBe("italic");
			expect(result.facets).toEqual([
				{ index: { byteStart: 0, byteEnd: 6 }, features: [ITALIC] },
			]);
		});

		it("parses italic in middle of text", () => {
			const result = parseMarkdown("hello *world* there");
			expect(result.text).toBe("hello world there");
			expect(result.facets).toEqual([
				{ index: { byteStart: 6, byteEnd: 11 }, features: [ITALIC] },
			]);
		});
	});

	describe("bold and italic", () => {
		it("parses ***bold and italic***", () => {
			const result = parseMarkdown("***both***");
			expect(result.text).toBe("both");
			// Should have both bold and italic facets covering the same range
			expect(result.facets).toHaveLength(2);
			expect(result.facets).toContainEqual({
				index: { byteStart: 0, byteEnd: 4 },
				features: [BOLD],
			});
			expect(result.facets).toContainEqual({
				index: { byteStart: 0, byteEnd: 4 },
				features: [ITALIC],
			});
		});

		it("parses nested bold in italic", () => {
			const result = parseMarkdown("*italic **bold** italic*");
			expect(result.text).toBe("italic bold italic");
			expect(result.facets).toContainEqual({
				index: { byteStart: 0, byteEnd: 18 },
				features: [ITALIC],
			});
			expect(result.facets).toContainEqual({
				index: { byteStart: 7, byteEnd: 11 },
				features: [BOLD],
			});
		});
	});

	describe("unclosed markers", () => {
		it("treats unclosed ** as literal", () => {
			const result = parseMarkdown("hello **world");
			expect(result.text).toBe("hello **world");
			expect(result.facets).toEqual([]);
		});

		it("treats unclosed * as literal", () => {
			const result = parseMarkdown("hello *world");
			expect(result.text).toBe("hello *world");
			expect(result.facets).toEqual([]);
		});
	});

	describe("empty spans", () => {
		it("ignores empty bold ****", () => {
			const result = parseMarkdown("a****b");
			expect(result.text).toBe("ab");
			expect(result.facets).toEqual([]);
		});

		it("treats unpaired ** as literal", () => {
			const result = parseMarkdown("a**b");
			expect(result.text).toBe("a**b");
			expect(result.facets).toEqual([]);
		});
	});

	describe("unicode", () => {
		it("handles multi-byte characters", () => {
			const result = parseMarkdown("**日本語**");
			expect(result.text).toBe("日本語");
			expect(result.facets).toEqual([
				{ index: { byteStart: 0, byteEnd: 9 }, features: [BOLD] },
			]);
		});

		it("handles emoji", () => {
			const result = parseMarkdown("**🔥**");
			expect(result.text).toBe("🔥");
			expect(result.facets).toEqual([
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			]);
		});

		it("handles mixed ASCII and unicode", () => {
			const result = parseMarkdown("hi **日本語** bye");
			expect(result.text).toBe("hi 日本語 bye");
			expect(result.facets).toEqual([
				{ index: { byteStart: 3, byteEnd: 12 }, features: [BOLD] },
			]);
		});
	});

	describe.each([
		["Hello **world**!"],
		["This is *italic* text"],
		["***bold and italic***"],
		["**nested *italic* in bold**"],
		["Multi-byte: **日本語** emoji **🔥**"],
		["Unclosed **bold"],
		["Unclosed *italic"],
		["**a**b**c**"],
		["*a*b*c*"],
		["****"],
		["***"],
		["**"],
		["*"],
		[""],
		["no formatting here"],
		["**bold** and *italic* together"],
		["a**b**c**d**e"],
		// Unicode byte offset edge cases
		["**🔥**"],
		["🔥 **bold**"],
		["**日本語**"],
		["👨‍👩‍👧‍👧 **text** 🔥"],
		["prefix **日本語** suffix"],
		["*🔥* and **🔥**"],
		["**a日b**"],
	])("snapshot: %s", (input) => {
		it("parses correctly", () => {
			expect(parseMarkdown(input)).toMatchSnapshot();
		});
	});
});
