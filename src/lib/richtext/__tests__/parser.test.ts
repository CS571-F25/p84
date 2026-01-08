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
		it("preserves empty bold **** as literal text", () => {
			const result = parseMarkdown("a****b");
			expect(result.text).toBe("a****b");
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

	describe("inline code", () => {
		it("parses inline code", () => {
			const result = parseMarkdown("`code`");
			expect(result.text).toBe("code");
			expect(result.facets).toHaveLength(1);
			expect(result.facets[0].features[0].$type).toBe(
				"com.deckbelcher.richtext.facet#code",
			);
		});

		it("parses code in text", () => {
			const result = parseMarkdown("run `npm install` now");
			expect(result.text).toBe("run npm install now");
			expect(result.facets[0].index).toEqual({ byteStart: 4, byteEnd: 15 });
		});

		it("preserves empty code `` as literal", () => {
			const result = parseMarkdown("a``b");
			expect(result.text).toBe("a``b");
			expect(result.facets).toEqual([]);
		});
	});

	describe("code blocks", () => {
		it("parses code block", () => {
			const result = parseMarkdown("```\nconst x = 1;\n```");
			expect(result.text).toBe("const x = 1;");
			expect(result.facets).toHaveLength(1);
			expect(result.facets[0].features[0].$type).toBe(
				"com.deckbelcher.richtext.facet#codeBlock",
			);
		});

		it("parses code block with language", () => {
			const result = parseMarkdown("```typescript\nconst x = 1;\n```");
			expect(result.text).toBe("const x = 1;");
		});

		it("parses multi-line code block", () => {
			const result = parseMarkdown("```\nline1\nline2\n```");
			expect(result.text).toBe("line1\nline2");
		});

		it("ignores ``` in middle of line", () => {
			const result = parseMarkdown("text ``` more");
			expect(result.text).toBe("text ``` more");
		});

		it("preserves newline between code block and content after", () => {
			const result = parseMarkdown("```\ncode\n```\ncontent after");
			expect(result.text).toBe("code\ncontent after");
			expect(result.facets).toHaveLength(1);
			expect(result.facets[0].index).toEqual({ byteStart: 0, byteEnd: 4 });
		});
	});

	describe("links", () => {
		it("parses markdown link", () => {
			const result = parseMarkdown("[click here](https://example.com)");
			expect(result.text).toBe("click here");
			expect(result.facets).toHaveLength(1);
			expect(result.facets[0].features[0]).toEqual({
				$type: "com.deckbelcher.richtext.facet#link",
				uri: "https://example.com",
			});
		});

		it("parses link in text", () => {
			const result = parseMarkdown("check [this](https://x.com) out");
			expect(result.text).toBe("check this out");
		});

		it("treats incomplete link as literal", () => {
			const result = parseMarkdown("[text]");
			expect(result.text).toBe("[text]");
		});

		it("treats link without url as literal", () => {
			const result = parseMarkdown("[text]()");
			expect(result.text).toBe("[text]()");
		});
	});

	describe("mentions", () => {
		it("parses valid handle", () => {
			const result = parseMarkdown("@user.bsky.social");
			expect(result.text).toBe("@user.bsky.social");
			expect(result.facets).toHaveLength(1);
			expect(result.facets[0].features[0]).toEqual({
				$type: "com.deckbelcher.richtext.facet#mention",
				did: "user.bsky.social",
			});
		});

		it("ignores @ without valid handle", () => {
			const result = parseMarkdown("email@");
			expect(result.text).toBe("email@");
			expect(result.facets).toEqual([]);
		});

		it("ignores @ without dot", () => {
			const result = parseMarkdown("@username");
			expect(result.text).toBe("@username");
			expect(result.facets).toEqual([]);
		});

		it("parses mention in sentence", () => {
			const result = parseMarkdown("hello @alice.dev!");
			expect(result.text).toBe("hello @alice.dev!");
			expect(result.facets[0].index).toEqual({ byteStart: 6, byteEnd: 16 });
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
		// New features
		["`code`"],
		["``"],
		["[link](https://example.com)"],
		["@user.bsky.social"],
	])("snapshot: %s", (input) => {
		it("parses correctly", () => {
			expect(parseMarkdown(input)).toMatchSnapshot();
		});
	});
});
