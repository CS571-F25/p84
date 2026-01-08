import { describe, expect, it } from "vitest";
import { ByteString } from "../byte-string";
import { parseMarkdown } from "../parser";
import { serializeToMarkdown } from "../serializer";
import { BOLD, type Facet, ITALIC } from "../types";

describe("byte offset handling (Bluesky-inspired)", () => {
	describe("grapheme vs byte length", () => {
		it("ASCII has equal byte and character length", () => {
			const bs = new ByteString("Hello!");
			expect(bs.length).toBe(6);
			expect(bs.text.length).toBe(6);
		});

		it("family emoji is 25 bytes but 1 grapheme cluster", () => {
			const bs = new ByteString("👨‍👩‍👧‍👧");
			expect(bs.length).toBe(25);
		});

		it("mixed emoji and text", () => {
			const bs = new ByteString("👨‍👩‍👧‍👧🔥 good!✅");
			expect(bs.length).toBe(38);
		});

		it("CJK characters are 3 bytes each", () => {
			const bs = new ByteString("日本語");
			expect(bs.length).toBe(9);
		});
	});

	describe("facet byte indices with unicode", () => {
		it("bold emoji has correct byte indices", () => {
			const { text, facets } = parseMarkdown("**🔥**");
			expect(text).toBe("🔥");
			expect(facets).toHaveLength(1);
			expect(facets[0].index.byteStart).toBe(0);
			expect(facets[0].index.byteEnd).toBe(4); // 🔥 is 4 bytes
		});

		it("bold CJK has correct byte indices", () => {
			const { text, facets } = parseMarkdown("**日本語**");
			expect(text).toBe("日本語");
			expect(facets).toHaveLength(1);
			expect(facets[0].index.byteStart).toBe(0);
			expect(facets[0].index.byteEnd).toBe(9); // 3 chars × 3 bytes
		});

		it("facet after emoji starts at correct byte offset", () => {
			const { text, facets } = parseMarkdown("🔥 **bold**");
			expect(text).toBe("🔥 bold");
			expect(facets).toHaveLength(1);
			// 🔥 = 4 bytes, space = 1 byte
			expect(facets[0].index.byteStart).toBe(5);
			expect(facets[0].index.byteEnd).toBe(9);
		});

		it("facet between emojis", () => {
			const { text, facets } = parseMarkdown("👨‍👩‍👧‍👧 **text** 🔥");
			expect(text).toBe("👨‍👩‍👧‍👧 text 🔥");
			expect(facets).toHaveLength(1);
			// family emoji = 25 bytes, space = 1 byte
			expect(facets[0].index.byteStart).toBe(26);
			expect(facets[0].index.byteEnd).toBe(30);
		});
	});

	describe("serializer respects byte boundaries", () => {
		it("serializes facet at unicode boundary correctly", () => {
			const text = "🔥 hello";
			const facets: Facet[] = [
				{ index: { byteStart: 5, byteEnd: 10 }, features: [BOLD] },
			];
			expect(serializeToMarkdown(text, facets)).toBe("🔥 **hello**");
		});

		it("serializes facet spanning emoji correctly", () => {
			const text = "🔥";
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			];
			expect(serializeToMarkdown(text, facets)).toBe("**🔥**");
		});

		it("serializes multiple facets around unicode", () => {
			const text = "日本語 text 日本語";
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 9 }, features: [BOLD] },
				{ index: { byteStart: 15, byteEnd: 24 }, features: [ITALIC] },
			];
			expect(serializeToMarkdown(text, facets)).toBe(
				"**日本語** text *日本語*",
			);
		});
	});

	describe("slicing at byte boundaries", () => {
		it("sliceByBytes handles emoji boundaries", () => {
			const bs = new ByteString("🔥hello");
			expect(bs.sliceByBytes(0, 4)).toBe("🔥");
			expect(bs.sliceByBytes(4, 9)).toBe("hello");
		});

		it("sliceByBytes handles CJK boundaries", () => {
			const bs = new ByteString("日本語");
			expect(bs.sliceByBytes(0, 3)).toBe("日");
			expect(bs.sliceByBytes(3, 6)).toBe("本");
			expect(bs.sliceByBytes(6, 9)).toBe("語");
		});

		it("sliceByBytes handles mixed content", () => {
			const bs = new ByteString("a日🔥b");
			expect(bs.sliceByBytes(0, 1)).toBe("a");
			expect(bs.sliceByBytes(1, 4)).toBe("日");
			expect(bs.sliceByBytes(4, 8)).toBe("🔥");
			expect(bs.sliceByBytes(8, 9)).toBe("b");
		});
	});

	describe("edge cases from real-world scenarios", () => {
		it("empty input", () => {
			const { text, facets } = parseMarkdown("");
			expect(text).toBe("");
			expect(facets).toHaveLength(0);
			expect(serializeToMarkdown(text, facets)).toBe("");
		});

		it("text with no formatting preserves unicode", () => {
			const input = "👨‍👩‍👧‍👧 family emoji and 日本語 text";
			const { text, facets } = parseMarkdown(input);
			expect(text).toBe(input);
			expect(facets).toHaveLength(0);
		});

		it("overlapping facets serialize correctly", () => {
			const text = "hello world";
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 11 }, features: [BOLD] },
				{ index: { byteStart: 6, byteEnd: 11 }, features: [ITALIC] },
			];
			// Bold wraps everything, italic starts at "world"
			// At byte 6: close nothing, open italic → *
			// At byte 11: close italic, close bold → ***
			expect(serializeToMarkdown(text, facets)).toBe("**hello *world***");
		});
	});
});
