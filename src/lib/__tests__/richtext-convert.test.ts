import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { schema } from "@/components/richtext/schema";
import type {
	BulletListBlock,
	HeadingBlock,
	OrderedListBlock,
	ParagraphBlock,
} from "@/lib/lexicons/types/com/deckbelcher/richtext";
import {
	documentToPlainText,
	type LexiconDocument,
	lexiconToTree,
	treeToLexicon,
} from "@/lib/richtext-convert";

/** Type helper for tests that expect paragraph/heading blocks */
type TextBlock = ParagraphBlock | HeadingBlock;

describe("treeToLexicon", () => {
	describe("paragraphs", () => {
		it("converts empty paragraph", () => {
			const doc = schema.node("doc", null, [schema.node("paragraph")]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(1);
			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: undefined,
				facets: undefined,
			});
		});

		it("converts plain text paragraph", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [schema.text("Hello world")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(1);
			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "Hello world",
				facets: undefined,
			});
		});

		it("converts multiple paragraphs", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [schema.text("First paragraph")]),
				schema.node("paragraph", null, [schema.text("Second paragraph")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(2);
			expect(result.content[0]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "First paragraph",
			});
			expect(result.content[1]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "Second paragraph",
			});
		});
	});

	describe("headings", () => {
		it("converts heading level 1", () => {
			const doc = schema.node("doc", null, [
				schema.node("heading", { level: 1 }, [schema.text("Title")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#headingBlock",
				level: 1,
				text: "Title",
				facets: undefined,
			});
		});

		it("converts heading levels 1-6", () => {
			for (let level = 1; level <= 6; level++) {
				const doc = schema.node("doc", null, [
					schema.node("heading", { level }, [schema.text(`Heading ${level}`)]),
				]);
				const result = treeToLexicon(doc);

				expect(result.content[0]).toMatchObject({
					$type: "com.deckbelcher.richtext#headingBlock",
					level,
					text: `Heading ${level}`,
				});
			}
		});

		it("converts empty heading", () => {
			const doc = schema.node("doc", null, [
				schema.node("heading", { level: 2 }),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#headingBlock",
				level: 2,
				text: undefined,
				facets: undefined,
			});
		});
	});

	describe("code blocks", () => {
		it("converts code block with text", () => {
			const doc = schema.node("doc", null, [
				schema.node("code_block", { params: "" }, [
					schema.text("const x = 1;"),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#codeBlock",
				text: "const x = 1;",
				language: undefined,
			});
		});

		it("converts code block with language", () => {
			const doc = schema.node("doc", null, [
				schema.node("code_block", { params: "typescript" }, [
					schema.text("const x: number = 1;"),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#codeBlock",
				text: "const x: number = 1;",
				language: "typescript",
			});
		});

		it("converts empty code block", () => {
			const doc = schema.node("doc", null, [
				schema.node("code_block", { params: "" }),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#codeBlock",
				text: "",
				language: undefined,
			});
		});

		it("converts multiline code block", () => {
			const doc = schema.node("doc", null, [
				schema.node("code_block", { params: "js" }, [
					schema.text("function foo() {\n  return 42;\n}"),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#codeBlock",
				text: "function foo() {\n  return 42;\n}",
				language: "js",
			});
		});
	});

	describe("bullet lists", () => {
		it("converts single item bullet list", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Item one")]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#bulletListBlock",
				items: [
					{
						$type: "com.deckbelcher.richtext#listItem",
						text: "Item one",
						facets: undefined,
					},
				],
			});
		});

		it("converts multi-item bullet list", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("First")]),
					]),
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Second")]),
					]),
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Third")]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as BulletListBlock;

			expect(block.$type).toBe("com.deckbelcher.richtext#bulletListBlock");
			expect(block.items).toHaveLength(3);
			expect(block.items[0].text).toBe("First");
			expect(block.items[1].text).toBe("Second");
			expect(block.items[2].text).toBe("Third");
		});

		it("converts bullet list with formatted text", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [
							schema.text("bold", [schema.marks.strong.create()]),
							schema.text(" item"),
						]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as BulletListBlock;

			expect(block.items[0].text).toBe("bold item");
			expect(block.items[0].facets).toHaveLength(1);
			expect(block.items[0].facets?.[0]).toMatchObject({
				index: { byteStart: 0, byteEnd: 4 },
				features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
			});
		});

		it("converts empty bullet list item", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [schema.node("paragraph")]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as BulletListBlock;

			expect(block.items[0]).toEqual({
				$type: "com.deckbelcher.richtext#listItem",
				text: undefined,
				facets: undefined,
			});
		});
	});

	describe("ordered lists", () => {
		it("converts single item ordered list", () => {
			const doc = schema.node("doc", null, [
				schema.node("ordered_list", { order: 1 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Step one")]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#orderedListBlock",
				items: [
					{
						$type: "com.deckbelcher.richtext#listItem",
						text: "Step one",
						facets: undefined,
					},
				],
				start: undefined,
			});
		});

		it("converts ordered list with custom start", () => {
			const doc = schema.node("doc", null, [
				schema.node("ordered_list", { order: 5 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Item five")]),
					]),
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Item six")]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as OrderedListBlock;

			expect(block.$type).toBe("com.deckbelcher.richtext#orderedListBlock");
			expect(block.start).toBe(5);
			expect(block.items).toHaveLength(2);
		});

		it("converts ordered list with formatted text", () => {
			const doc = schema.node("doc", null, [
				schema.node("ordered_list", { order: 1 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [
							schema.text("Click "),
							schema.text("here", [
								schema.marks.link.create({ href: "https://example.com" }),
							]),
						]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as OrderedListBlock;

			expect(block.items[0].text).toBe("Click here");
			expect(block.items[0].facets?.[0]).toMatchObject({
				index: { byteStart: 6, byteEnd: 10 },
				features: [
					{
						$type: "com.deckbelcher.richtext.facet#link",
						uri: "https://example.com",
					},
				],
			});
		});
	});

	describe("nested lists", () => {
		it("converts bullet list with nested bullet list", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Parent item")]),
						schema.node("bullet_list", null, [
							schema.node("list_item", null, [
								schema.node("paragraph", null, [schema.text("Nested item 1")]),
							]),
							schema.node("list_item", null, [
								schema.node("paragraph", null, [schema.text("Nested item 2")]),
							]),
						]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as BulletListBlock;

			expect(block.items).toHaveLength(1);
			expect(block.items[0].text).toBe("Parent item");
			expect(block.items[0].sublist).toBeDefined();
			expect(block.items[0].sublist?.$type).toBe(
				"com.deckbelcher.richtext#bulletListBlock",
			);
			const sublist = block.items[0].sublist as BulletListBlock;
			expect(sublist.items).toHaveLength(2);
			expect(sublist.items[0].text).toBe("Nested item 1");
			expect(sublist.items[1].text).toBe("Nested item 2");
		});

		it("converts ordered list with nested ordered list", () => {
			const doc = schema.node("doc", null, [
				schema.node("ordered_list", { order: 1 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Step 1")]),
						schema.node("ordered_list", { order: 1 }, [
							schema.node("list_item", null, [
								schema.node("paragraph", null, [schema.text("Step 1.a")]),
							]),
						]),
					]),
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Step 2")]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as OrderedListBlock;

			expect(block.items).toHaveLength(2);
			expect(block.items[0].text).toBe("Step 1");
			expect(block.items[0].sublist?.$type).toBe(
				"com.deckbelcher.richtext#orderedListBlock",
			);
			expect(block.items[1].text).toBe("Step 2");
			expect(block.items[1].sublist).toBeUndefined();
		});

		it("converts mixed nested lists (bullet in ordered)", () => {
			const doc = schema.node("doc", null, [
				schema.node("ordered_list", { order: 1 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Main point")]),
						schema.node("bullet_list", null, [
							schema.node("list_item", null, [
								schema.node("paragraph", null, [schema.text("Sub-bullet")]),
							]),
						]),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as OrderedListBlock;

			expect(block.items[0].sublist?.$type).toBe(
				"com.deckbelcher.richtext#bulletListBlock",
			);
		});

		it("roundtrips nested list structure", () => {
			const doc = schema.node("doc", null, [
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Parent")]),
						schema.node("bullet_list", null, [
							schema.node("list_item", null, [
								schema.node("paragraph", null, [schema.text("Child")]),
							]),
						]),
					]),
				]),
			]);
			const lexicon = treeToLexicon(doc);
			const result = lexiconToTree(lexicon);

			expect(result.eq(doc)).toBe(true);
		});
	});

	describe("horizontal rules", () => {
		it("converts horizontal rule", () => {
			const doc = schema.node("doc", null, [schema.node("horizontal_rule")]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toEqual({
				$type: "com.deckbelcher.richtext#horizontalRuleBlock",
			});
		});

		it("converts horizontal rule between paragraphs", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [schema.text("Before")]),
				schema.node("horizontal_rule"),
				schema.node("paragraph", null, [schema.text("After")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(3);
			expect(result.content[0]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "Before",
			});
			expect(result.content[1]).toEqual({
				$type: "com.deckbelcher.richtext#horizontalRuleBlock",
			});
			expect(result.content[2]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "After",
			});
		});
	});

	describe("mixed block types", () => {
		it("converts document with all block types", () => {
			const doc = schema.node("doc", null, [
				schema.node("heading", { level: 1 }, [schema.text("Title")]),
				schema.node("paragraph", null, [schema.text("Intro text")]),
				schema.node("code_block", { params: "js" }, [schema.text("code()")]),
				schema.node("bullet_list", null, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Bullet")]),
					]),
				]),
				schema.node("ordered_list", { order: 1 }, [
					schema.node("list_item", null, [
						schema.node("paragraph", null, [schema.text("Numbered")]),
					]),
				]),
				schema.node("horizontal_rule"),
				schema.node("paragraph", null, [schema.text("End")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(7);
			expect(result.content[0].$type).toBe(
				"com.deckbelcher.richtext#headingBlock",
			);
			expect(result.content[1].$type).toBe(
				"com.deckbelcher.richtext#paragraphBlock",
			);
			expect(result.content[2].$type).toBe(
				"com.deckbelcher.richtext#codeBlock",
			);
			expect(result.content[3].$type).toBe(
				"com.deckbelcher.richtext#bulletListBlock",
			);
			expect(result.content[4].$type).toBe(
				"com.deckbelcher.richtext#orderedListBlock",
			);
			expect(result.content[5].$type).toBe(
				"com.deckbelcher.richtext#horizontalRuleBlock",
			);
			expect(result.content[6].$type).toBe(
				"com.deckbelcher.richtext#paragraphBlock",
			);
		});
	});

	describe("marks", () => {
		it("converts bold text", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("bold", [schema.marks.strong.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "bold",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 4 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("converts italic text", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("italic", [schema.marks.em.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "italic",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 6 },
						features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
					},
				],
			});
		});

		it("converts code text", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("code", [schema.marks.code.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "code",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 4 },
						features: [{ $type: "com.deckbelcher.richtext.facet#code" }],
					},
				],
			});
		});

		it("converts link", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("click here", [
						schema.marks.link.create({ href: "https://example.com" }),
					]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "click here",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 10 },
						features: [
							{
								$type: "com.deckbelcher.richtext.facet#link",
								uri: "https://example.com",
							},
						],
					},
				],
			});
		});

		it("converts text with mark in middle", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("before "),
					schema.text("bold", [schema.marks.strong.create()]),
					schema.text(" after"),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "before bold after",
				facets: [
					{
						index: { byteStart: 7, byteEnd: 11 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("converts adjacent different marks", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("bold", [schema.marks.strong.create()]),
					schema.text("italic", [schema.marks.em.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				text: "bolditalic",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 4 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
					{
						index: { byteStart: 4, byteEnd: 10 },
						features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
					},
				],
			});
		});
	});

	describe("unicode and byte offsets", () => {
		it("handles emoji correctly", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("Hello "),
					schema.text("🎉", [schema.marks.strong.create()]),
					schema.text(" world"),
				]),
			]);
			const result = treeToLexicon(doc);

			// "Hello " = 6 bytes
			// "🎉" = 4 bytes (UTF-8)
			expect(result.content[0]).toMatchObject({
				text: "Hello 🎉 world",
				facets: [
					{
						index: { byteStart: 6, byteEnd: 10 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("handles multi-byte characters", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("日本語", [schema.marks.strong.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			// Each Japanese character is 3 bytes in UTF-8
			expect(result.content[0]).toMatchObject({
				text: "日本語",
				facets: [
					{
						index: { byteStart: 0, byteEnd: 9 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("handles mixed ASCII and unicode", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("Café "),
					schema.text("résumé", [schema.marks.em.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			// "Café " = 6 bytes (é is 2 bytes)
			// "résumé" = 8 bytes (é is 2 bytes each)
			expect(result.content[0]).toMatchObject({
				text: "Café résumé",
				facets: [
					{
						index: { byteStart: 6, byteEnd: 14 },
						features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
					},
				],
			});
		});
	});

	describe("overlapping marks", () => {
		it("converts text with bold AND italic", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("both", [
						schema.marks.strong.create(),
						schema.marks.em.create(),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as TextBlock;

			// Marks with the same byte range are merged into a single facet
			expect(block.facets).toHaveLength(1);
			expect(block.facets?.[0]).toMatchObject({
				index: { byteStart: 0, byteEnd: 4 },
				features: expect.arrayContaining([
					{ $type: "com.deckbelcher.richtext.facet#bold" },
					{ $type: "com.deckbelcher.richtext.facet#italic" },
				]),
			});
		});

		it("converts partially overlapping marks", () => {
			// "normal BOLD bolditalic ITALIC normal"
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("normal "),
					schema.text("BOLD ", [schema.marks.strong.create()]),
					schema.text("both", [
						schema.marks.strong.create(),
						schema.marks.em.create(),
					]),
					schema.text(" ITALIC", [schema.marks.em.create()]),
					schema.text(" normal"),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as TextBlock;

			// Should have facets for the bold region and italic region
			// Bold: "BOLD both" = bytes 7-16
			// Italic: "both ITALIC" = bytes 12-23
			expect(block.text).toBe("normal BOLD both ITALIC normal");

			const facets = block.facets ?? [];
			const boldFacet = facets.find(
				(f) => f.features[0]?.$type === "com.deckbelcher.richtext.facet#bold",
			);
			const italicFacet = facets.find(
				(f) => f.features[0]?.$type === "com.deckbelcher.richtext.facet#italic",
			);

			expect(boldFacet?.index).toEqual({ byteStart: 7, byteEnd: 16 });
			expect(italicFacet?.index).toEqual({ byteStart: 12, byteEnd: 23 });
		});

		it("converts bold link", () => {
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("click", [
						schema.marks.strong.create(),
						schema.marks.link.create({ href: "https://example.com" }),
					]),
				]),
			]);
			const result = treeToLexicon(doc);
			const block = result.content[0] as TextBlock;

			// Marks with the same byte range are merged into a single facet
			expect(block.facets).toHaveLength(1);
			expect(block.facets?.[0]).toMatchObject({
				index: { byteStart: 0, byteEnd: 5 },
				features: expect.arrayContaining([
					{ $type: "com.deckbelcher.richtext.facet#bold" },
					{
						$type: "com.deckbelcher.richtext.facet#link",
						uri: "https://example.com",
					},
				]),
			});
		});
	});

	describe("mixed content", () => {
		it("converts document with paragraphs and headings", () => {
			const doc = schema.node("doc", null, [
				schema.node("heading", { level: 1 }, [schema.text("Introduction")]),
				schema.node("paragraph", null, [schema.text("Some text here.")]),
				schema.node("heading", { level: 2 }, [schema.text("Details")]),
				schema.node("paragraph", null, [schema.text("More details.")]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content).toHaveLength(4);
			expect(result.content[0]).toMatchObject({
				$type: "com.deckbelcher.richtext#headingBlock",
				level: 1,
				text: "Introduction",
			});
			expect(result.content[1]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "Some text here.",
			});
			expect(result.content[2]).toMatchObject({
				$type: "com.deckbelcher.richtext#headingBlock",
				level: 2,
				text: "Details",
			});
			expect(result.content[3]).toMatchObject({
				$type: "com.deckbelcher.richtext#paragraphBlock",
				text: "More details.",
			});
		});

		it("converts heading with formatting", () => {
			const doc = schema.node("doc", null, [
				schema.node("heading", { level: 1 }, [
					schema.text("Important "),
					schema.text("Title", [schema.marks.strong.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			expect(result.content[0]).toMatchObject({
				$type: "com.deckbelcher.richtext#headingBlock",
				level: 1,
				text: "Important Title",
				facets: [
					{
						index: { byteStart: 10, byteEnd: 15 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});
	});
});

describe("lexiconToTree", () => {
	describe("paragraphs", () => {
		it("converts empty paragraph", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.childCount).toBe(1);
			expect(result.child(0).type.name).toBe("paragraph");
			expect(result.child(0).childCount).toBe(0);
		});

		it("converts plain text paragraph", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "Hello world",
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.childCount).toBe(1);
			expect(result.child(0).type.name).toBe("paragraph");
			expect(result.child(0).textContent).toBe("Hello world");
		});

		it("converts multiple paragraphs", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "First",
					},
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "Second",
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.childCount).toBe(2);
			expect(result.child(0).textContent).toBe("First");
			expect(result.child(1).textContent).toBe("Second");
		});
	});

	describe("headings", () => {
		it("converts heading with level", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#headingBlock",
						level: 2,
						text: "Section Title",
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.child(0).type.name).toBe("heading");
			expect(result.child(0).attrs.level).toBe(2);
			expect(result.child(0).textContent).toBe("Section Title");
		});

		it("converts empty heading", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#headingBlock",
						level: 1,
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.child(0).type.name).toBe("heading");
			expect(result.child(0).attrs.level).toBe(1);
			expect(result.child(0).childCount).toBe(0);
		});
	});

	describe("facets/marks", () => {
		it("converts bold facet", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "hello bold world",
						facets: [
							{
								index: { byteStart: 6, byteEnd: 10 },
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			// Should have 3 text nodes: "hello ", "bold", " world"
			expect(para.childCount).toBe(3);
			expect(para.child(0).text).toBe("hello ");
			expect(para.child(0).marks).toHaveLength(0);

			expect(para.child(1).text).toBe("bold");
			expect(para.child(1).marks).toHaveLength(1);
			expect(para.child(1).marks[0].type.name).toBe("strong");

			expect(para.child(2).text).toBe(" world");
			expect(para.child(2).marks).toHaveLength(0);
		});

		it("converts italic facet", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "emphasis",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 8 },
								features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.child(0).child(0).marks[0].type.name).toBe("em");
		});

		it("converts code facet", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "inline code",
						facets: [
							{
								index: { byteStart: 7, byteEnd: 11 },
								features: [{ $type: "com.deckbelcher.richtext.facet#code" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			expect(para.child(1).text).toBe("code");
			expect(para.child(1).marks[0].type.name).toBe("code");
		});

		it("converts link facet", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "click here",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 10 },
								features: [
									{
										$type: "com.deckbelcher.richtext.facet#link",
										uri: "https://example.com",
									},
								],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);

			const link = result.child(0).child(0);
			expect(link.marks[0].type.name).toBe("link");
			expect(link.marks[0].attrs.href).toBe("https://example.com");
		});

		it("converts mention facet to inline node", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "hello @alice.test world",
						facets: [
							{
								index: { byteStart: 6, byteEnd: 17 },
								features: [
									{
										$type: "com.deckbelcher.richtext.facet#mention",
										did: "did:plc:12345",
									},
								],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			// Should have 3 children: "hello ", mention node, " world"
			expect(para.childCount).toBe(3);
			expect(para.child(0).text).toBe("hello ");
			expect(para.child(1).type.name).toBe("mention");
			expect(para.child(1).attrs.handle).toBe("alice.test");
			expect(para.child(1).attrs.did).toBe("did:plc:12345");
			expect(para.child(2).text).toBe(" world");
		});

		it("converts cardRef facet to inline node", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "check out Lightning Bolt for removal",
						facets: [
							{
								index: { byteStart: 10, byteEnd: 24 },
								features: [
									{
										$type: "com.deckbelcher.richtext.facet#cardRef",
										scryfallId: "e3285e6b-3e79-4d7c-bf96-d920f973b122",
									},
								],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			// Should have 3 children: "check out ", cardRef node, " for removal"
			expect(para.childCount).toBe(3);
			expect(para.child(0).text).toBe("check out ");
			expect(para.child(1).type.name).toBe("cardRef");
			expect(para.child(1).attrs.name).toBe("Lightning Bolt");
			expect(para.child(1).attrs.scryfallId).toBe(
				"e3285e6b-3e79-4d7c-bf96-d920f973b122",
			);
			expect(para.child(2).text).toBe(" for removal");
		});

		it("converts tag facet to inline node", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "tagged with combo for deck",
						facets: [
							{
								index: { byteStart: 12, byteEnd: 17 },
								features: [
									{
										$type: "com.deckbelcher.richtext.facet#tag",
										tag: "combo",
									},
								],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			// Should have 3 children: "tagged with ", tag node, " for deck"
			expect(para.childCount).toBe(3);
			expect(para.child(0).text).toBe("tagged with ");
			expect(para.child(1).type.name).toBe("tag");
			expect(para.child(1).attrs.tag).toBe("combo");
			expect(para.child(2).text).toBe(" for deck");
		});

		it("converts adjacent facets", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "bolditalic",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 4 },
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
							{
								index: { byteStart: 4, byteEnd: 10 },
								features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			expect(para.child(0).text).toBe("bold");
			expect(para.child(0).marks[0].type.name).toBe("strong");

			expect(para.child(1).text).toBe("italic");
			expect(para.child(1).marks[0].type.name).toBe("em");
		});
	});

	describe("unicode", () => {
		it("handles emoji byte offsets", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "Hello 🎉 world",
						facets: [
							{
								index: { byteStart: 6, byteEnd: 10 }, // 🎉 is 4 bytes
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			expect(para.child(1).text).toBe("🎉");
			expect(para.child(1).marks[0].type.name).toBe("strong");
		});

		it("handles multi-byte characters", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "日本語",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 9 }, // 3 chars × 3 bytes
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.child(0).child(0).text).toBe("日本語");
			expect(result.child(0).child(0).marks[0].type.name).toBe("strong");
		});
	});

	describe("overlapping facets", () => {
		it("converts overlapping bold and italic", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "overlap",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 7 },
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
							{
								index: { byteStart: 0, byteEnd: 7 },
								features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const textNode = result.child(0).child(0);

			expect(textNode.text).toBe("overlap");
			expect(textNode.marks).toHaveLength(2);
			expect(textNode.marks.map((m) => m.type.name).sort()).toEqual([
				"em",
				"strong",
			]);
		});

		it("converts partially overlapping facets", () => {
			// "BOLD both ITALIC"
			// Bold covers "BOLD both" (0-9)
			// Italic covers "both ITALIC" (5-16)
			const lexicon: LexiconDocument = {
				content: [
					{
						$type: "com.deckbelcher.richtext#paragraphBlock",
						text: "BOLD both ITALIC",
						facets: [
							{
								index: { byteStart: 0, byteEnd: 9 },
								features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
							},
							{
								index: { byteStart: 5, byteEnd: 16 },
								features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
							},
						],
					},
				],
			};
			const result = lexiconToTree(lexicon);
			const para = result.child(0);

			// Segmenter should split into: "BOLD " (bold), "both" (bold+italic), " ITALIC" (italic)
			expect(para.childCount).toBe(3);

			expect(para.child(0).text).toBe("BOLD ");
			expect(para.child(0).marks.map((m) => m.type.name)).toEqual(["strong"]);

			expect(para.child(1).text).toBe("both");
			expect(
				para
					.child(1)
					.marks.map((m) => m.type.name)
					.sort(),
			).toEqual(["em", "strong"]);

			expect(para.child(2).text).toBe(" ITALIC");
			expect(para.child(2).marks.map((m) => m.type.name)).toEqual(["em"]);
		});
	});

	describe("unknown block types", () => {
		it("treats unknown block type as paragraph", () => {
			const lexicon: LexiconDocument = {
				content: [
					{
						// biome-ignore lint/suspicious/noExplicitAny: testing unknown block types
						$type: "com.deckbelcher.richtext#unknownBlock" as any,
						text: "Some text",
					},
				],
			};
			const result = lexiconToTree(lexicon);

			expect(result.child(0).type.name).toBe("paragraph");
			expect(result.child(0).textContent).toBe("Some text");
		});
	});
});

describe("roundtrip", () => {
	function roundtrip(doc: ReturnType<typeof schema.node>) {
		const lexicon = treeToLexicon(doc);
		return lexiconToTree(lexicon);
	}

	it("preserves overlapping bold and italic", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("both", [
					schema.marks.strong.create(),
					schema.marks.em.create(),
				]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves partially overlapping marks", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("BOLD ", [schema.marks.strong.create()]),
				schema.text("both", [
					schema.marks.strong.create(),
					schema.marks.em.create(),
				]),
				schema.text(" ITALIC", [schema.marks.em.create()]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves triple marks", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("everything", [
					schema.marks.strong.create(),
					schema.marks.em.create(),
					schema.marks.code.create(),
				]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves plain text paragraph", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [schema.text("Hello world")]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves bold text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("normal "),
				schema.text("bold", [schema.marks.strong.create()]),
				schema.text(" normal"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves italic text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("emphasis", [schema.marks.em.create()]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves code text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("const x = 1", [schema.marks.code.create()]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves links", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("Visit "),
				schema.text("our site", [
					schema.marks.link.create({ href: "https://example.com" }),
				]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves mentions", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("hello "),
				schema.nodes.mention.create({
					handle: "alice.test",
					did: "did:plc:12345",
				}),
				schema.text(" world"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("converts mentions without DID to plain text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.nodes.mention.create({
					handle: "bob.example",
					did: null,
				}),
			]),
		]);

		const lexicon = treeToLexicon(original);
		const paragraph = lexicon.content[0] as {
			text?: string;
			facets?: unknown[];
		};

		expect(paragraph.text).toBe("@bob.example");
		expect(paragraph.facets).toBeUndefined();
	});

	it("preserves multiple mentions with correct byte offsets", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("cc "),
				schema.nodes.mention.create({
					handle: "alice.test",
					did: "did:plc:alice",
				}),
				schema.text(" and "),
				schema.nodes.mention.create({
					handle: "bob.test",
					did: "did:plc:bob",
				}),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves mentions adjacent to unicode", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("🎉 "),
				schema.nodes.mention.create({
					handle: "alice.test",
					did: "did:plc:alice",
				}),
				schema.text(" 日本語"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves mentions mixed with formatting", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("hello ", [schema.marks.strong.create()]),
				schema.nodes.mention.create({
					handle: "alice.test",
					did: "did:plc:alice",
				}),
				schema.text(" world", [schema.marks.em.create()]),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves cardRefs", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("run "),
				schema.nodes.cardRef.create({
					name: "Lightning Bolt",
					scryfallId: "e3285e6b-3e79-4d7c-bf96-d920f973b122",
				}),
				schema.text(" for removal"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("converts cardRefs without scryfallId to plain text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.nodes.cardRef.create({
					name: "Lightning Bolt",
					scryfallId: "",
				}),
			]),
		]);

		const lexicon = treeToLexicon(original);
		const paragraph = lexicon.content[0] as {
			text?: string;
			facets?: unknown[];
		};

		expect(paragraph.text).toBe("Lightning Bolt");
		expect(paragraph.facets).toBeUndefined();
	});

	it("preserves multiple cardRefs with correct byte offsets", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("run "),
				schema.nodes.cardRef.create({
					name: "Lightning Bolt",
					scryfallId: "e3285e6b-3e79-4d7c-bf96-d920f973b122",
				}),
				schema.text(" and "),
				schema.nodes.cardRef.create({
					name: "Path to Exile",
					scryfallId: "163b68e8-33e9-4e4e-a2c1-e1c884c7a3b8",
				}),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves tags", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("tagged with "),
				schema.nodes.tag.create({ tag: "combo" }),
				schema.text(" and "),
				schema.nodes.tag.create({ tag: "budget" }),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves tags with spaces", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.nodes.tag.create({ tag: "budget friendly" }),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("converts tags without tag value to undefined text", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [schema.nodes.tag.create({ tag: "" })]),
		]);

		const lexicon = treeToLexicon(original);
		const paragraph = lexicon.content[0] as {
			text?: string;
			facets?: unknown[];
		};

		expect(paragraph.text).toBeUndefined();
		expect(paragraph.facets).toBeUndefined();
	});

	it("preserves headings", () => {
		const original = schema.node("doc", null, [
			schema.node("heading", { level: 2 }, [schema.text("Section Title")]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves mixed document", () => {
		const original = schema.node("doc", null, [
			schema.node("heading", { level: 1 }, [schema.text("Title")]),
			schema.node("paragraph", null, [
				schema.text("This is "),
				schema.text("bold", [schema.marks.strong.create()]),
				schema.text(" and "),
				schema.text("italic", [schema.marks.em.create()]),
				schema.text("."),
			]),
			schema.node("heading", { level: 2 }, [schema.text("Links")]),
			schema.node("paragraph", null, [
				schema.text("Check out "),
				schema.text("this link", [
					schema.marks.link.create({ href: "https://example.com" }),
				]),
				schema.text("!"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves unicode content", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("Hello "),
				schema.text("🎉", [schema.marks.strong.create()]),
				schema.text(" 日本語!"),
			]),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves empty document", () => {
		const original = schema.node("doc", null, [schema.node("paragraph")]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});

	it("preserves multiple empty paragraphs", () => {
		const original = schema.node("doc", null, [
			schema.node("paragraph"),
			schema.node("paragraph"),
			schema.node("paragraph"),
		]);
		const result = roundtrip(original);

		expect(result.eq(original)).toBe(true);
	});
});

describe("complex unicode", () => {
	describe("treeToLexicon", () => {
		it("handles combining characters (e + combining acute)", () => {
			// "café" with combining acute (e + ́) vs precomposed é
			const combining = "cafe\u0301"; // e + combining acute accent
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("before "),
					schema.text(combining, [schema.marks.strong.create()]),
					schema.text(" after"),
				]),
			]);
			const result = treeToLexicon(doc);

			// "before " = 7 bytes
			// "cafe" = 4 bytes, combining acute = 2 bytes = 6 bytes total
			expect(result.content[0]).toMatchObject({
				text: `before ${combining} after`,
				facets: [
					{
						index: { byteStart: 7, byteEnd: 13 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("handles ZWJ emoji sequences (family emoji)", () => {
			// Family emoji: 👨‍👩‍👧 (man + ZWJ + woman + ZWJ + girl)
			const family = "👨\u200D👩\u200D👧";
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text(family, [schema.marks.em.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			// Each person emoji = 4 bytes, ZWJ = 3 bytes
			// Total: 4 + 3 + 4 + 3 + 4 = 18 bytes
			expect(result.content[0]).toMatchObject({
				text: family,
				facets: [
					{
						index: { byteStart: 0, byteEnd: 18 },
						features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
					},
				],
			});
		});

		it("handles flag emoji (regional indicators)", () => {
			// US flag: 🇺🇸 (regional indicator U + regional indicator S)
			const flag = "🇺🇸";
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("Go "),
					schema.text(flag, [schema.marks.strong.create()]),
					schema.text("!"),
				]),
			]);
			const result = treeToLexicon(doc);

			// "Go " = 3 bytes
			// Each regional indicator = 4 bytes, total 8 bytes
			expect(result.content[0]).toMatchObject({
				text: `Go ${flag}!`,
				facets: [
					{
						index: { byteStart: 3, byteEnd: 11 },
						features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
					},
				],
			});
		});

		it("handles skin tone modifiers", () => {
			// Waving hand with skin tone: 👋🏽
			const wave = "👋🏽";
			const doc = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text(wave, [schema.marks.code.create()]),
				]),
			]);
			const result = treeToLexicon(doc);

			// Base emoji = 4 bytes, skin tone modifier = 4 bytes = 8 bytes
			expect(result.content[0]).toMatchObject({
				text: wave,
				facets: [
					{
						index: { byteStart: 0, byteEnd: 8 },
						features: [{ $type: "com.deckbelcher.richtext.facet#code" }],
					},
				],
			});
		});
	});

	describe("roundtrip", () => {
		function roundtrip(doc: ReturnType<typeof schema.node>) {
			const lexicon = treeToLexicon(doc);
			return lexiconToTree(lexicon);
		}

		it("preserves combining characters", () => {
			const combining = "cafe\u0301";
			const original = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text(combining, [schema.marks.strong.create()]),
				]),
			]);
			const result = roundtrip(original);

			expect(result.eq(original)).toBe(true);
		});

		it("preserves ZWJ sequences", () => {
			const family = "👨\u200D👩\u200D👧";
			const original = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text(family, [schema.marks.em.create()]),
				]),
			]);
			const result = roundtrip(original);

			expect(result.eq(original)).toBe(true);
		});

		it("preserves flag emoji", () => {
			const flag = "🇺🇸";
			const original = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text(`Go ${flag}!`, [schema.marks.strong.create()]),
				]),
			]);
			const result = roundtrip(original);

			expect(result.eq(original)).toBe(true);
		});

		it("preserves mixed complex unicode with marks", () => {
			const original = schema.node("doc", null, [
				schema.node("paragraph", null, [
					schema.text("Hello "),
					schema.text("👨‍👩‍👧", [schema.marks.strong.create()]),
					schema.text(" from "),
					schema.text("🇺🇸", [schema.marks.em.create()]),
					schema.text("!"),
				]),
			]);
			const result = roundtrip(original);

			expect(result.eq(original)).toBe(true);
		});
	});
});

describe("property tests", () => {
	// Arbitrary for text that includes various unicode
	const arbText = fc.oneof(
		fc.string({ minLength: 1, maxLength: 50 }), // Basic strings including unicode
		fc.constant("🎉test"), // Emoji with text
		fc.constant("👨‍👩‍👧"), // ZWJ sequence
		fc.constant("🇺🇸"), // Flag
		fc.constant("café"), // Precomposed
		fc.constant("cafe\u0301"), // Combining
		fc.constant("日本語テスト"), // Japanese
	);

	// Arbitrary for marks (subset)
	const arbMarkSet = fc
		.subarray(["strong", "em", "code"] as const, { minLength: 0, maxLength: 3 })
		.map((markNames) => markNames.map((name) => schema.marks[name].create()));

	// Arbitrary for a text node with optional marks
	const arbTextNode = fc
		.tuple(arbText, arbMarkSet)
		.map(([text, marks]) => schema.text(text, marks));

	// Arbitrary for mention node
	const arbMention = fc
		.tuple(
			fc
				.string({ minLength: 1, maxLength: 20 })
				.filter((s) => !s.includes(" ")),
			fc.string({ minLength: 10, maxLength: 30 }),
		)
		.map(([handle, did]) =>
			schema.nodes.mention.create({ handle, did: `did:plc:${did}` }),
		);

	// Arbitrary for cardRef node (scryfall IDs are UUIDs, names can have unicode)
	const arbCardName = fc.oneof(
		fc.string({ minLength: 1, maxLength: 30 }),
		fc.constant("Lightning Bolt"),
		fc.constant("Jötun Grunt"), // non-ASCII
		fc.constant("Fire // Ice"), // split card
		fc.constant("闪电击"), // Chinese (Lightning Bolt)
		fc.constant("בָּרָק"), // Hebrew (lightning) - RTL
		fc.constant("صاعقة"), // Arabic (thunderbolt) - RTL
	);
	const arbCardRef = fc
		.tuple(arbCardName, fc.uuid())
		.map(([name, scryfallId]) =>
			schema.nodes.cardRef.create({ name, scryfallId }),
		);

	// Arbitrary for tag node (include unicode to catch byte offset bugs)
	const arbTagText = fc.oneof(
		fc.string({ minLength: 1, maxLength: 30 }),
		fc.constant("日本語"), // Japanese
		fc.constant("🎉party"), // emoji
		fc.constant("café"), // accented
		fc.constant("组合技"), // Chinese (combo)
		fc.constant("תקציב"), // Hebrew (budget) - RTL
		fc.constant("ميزانية"), // Arabic (budget) - RTL
	);
	const arbTag = arbTagText.map((tag) => schema.nodes.tag.create({ tag }));

	// Arbitrary for any inline node (text with marks, or atom nodes)
	const arbInlineNode = fc.oneof(
		{ weight: 5, arbitrary: arbTextNode },
		{ weight: 1, arbitrary: arbMention },
		{ weight: 1, arbitrary: arbCardRef },
		{ weight: 1, arbitrary: arbTag },
	);

	// Arbitrary for paragraph content (1-5 inline nodes, including atoms)
	const arbParagraphContent = fc.array(arbInlineNode, {
		minLength: 1,
		maxLength: 5,
	});

	// Arbitrary for text-only paragraph content (no atoms - for text-specific tests)
	const arbTextOnlyParagraphContent = fc.array(arbTextNode, {
		minLength: 1,
		maxLength: 5,
	});

	// Arbitrary for a paragraph block
	const arbParagraph = arbParagraphContent.map((content) =>
		schema.node("paragraph", null, content),
	);

	// Arbitrary for heading level
	const arbHeadingLevel = fc.integer({ min: 1, max: 6 });

	// Arbitrary for a heading block
	const arbHeading = fc
		.tuple(arbHeadingLevel, arbParagraphContent)
		.map(([level, content]) => schema.node("heading", { level }, content));

	// Arbitrary for code block text (can include newlines, no marks)
	const arbCodeText = fc.oneof(
		fc.string({ minLength: 0, maxLength: 100 }),
		fc.constant("function foo() {\n  return 42;\n}"),
		fc.constant("const x = 1;"),
		fc.constant(""),
	);

	// Arbitrary for language hint
	const arbLanguage = fc.oneof(
		fc.constant(""),
		fc.constant("js"),
		fc.constant("typescript"),
		fc.constant("python"),
		fc.constant("rust"),
	);

	// Arbitrary for code block
	const arbCodeBlock = fc
		.tuple(arbCodeText, arbLanguage)
		.map(([text, lang]) =>
			schema.node(
				"code_block",
				{ params: lang },
				text ? [schema.text(text)] : undefined,
			),
		);

	// Arbitrary for a flat list item (no nesting)
	const arbFlatListItem = arbParagraphContent.map((content) =>
		schema.node("list_item", null, [schema.node("paragraph", null, content)]),
	);

	// Arbitrary for flat bullet list (no nesting)
	const arbFlatBulletList = fc
		.array(arbFlatListItem, { minLength: 1, maxLength: 3 })
		.map((items) => schema.node("bullet_list", null, items));

	// Arbitrary for flat ordered list (no nesting)
	const arbFlatOrderedList = fc
		.tuple(
			fc.array(arbFlatListItem, { minLength: 1, maxLength: 3 }),
			fc.integer({ min: 1, max: 10 }),
		)
		.map(([items, start]) =>
			schema.node("ordered_list", { order: start }, items),
		);

	// Arbitrary for a nested sublist (bullet or ordered, flat)
	const arbSublist = fc.oneof(arbFlatBulletList, arbFlatOrderedList);

	// Arbitrary for a list item with optional nested sublist
	const arbListItem = fc
		.tuple(arbParagraphContent, fc.option(arbSublist, { nil: undefined }))
		.map(([content, sublist]) => {
			const children = [schema.node("paragraph", null, content)];
			if (sublist) {
				children.push(sublist);
			}
			return schema.node("list_item", null, children);
		});

	// Arbitrary for bullet list (1-4 items, may have nesting)
	const arbBulletList = fc
		.array(arbListItem, { minLength: 1, maxLength: 4 })
		.map((items) => schema.node("bullet_list", null, items));

	// Arbitrary for ordered list with optional start number (may have nesting)
	const arbOrderedList = fc
		.tuple(
			fc.array(arbListItem, { minLength: 1, maxLength: 4 }),
			fc.integer({ min: 1, max: 10 }),
		)
		.map(([items, start]) =>
			schema.node("ordered_list", { order: start }, items),
		);

	// Arbitrary for horizontal rule
	const arbHorizontalRule = fc.constant(schema.node("horizontal_rule"));

	// Arbitrary for a block (all types)
	const arbBlock = fc.oneof(
		{ weight: 3, arbitrary: arbParagraph },
		{ weight: 2, arbitrary: arbHeading },
		{ weight: 1, arbitrary: arbCodeBlock },
		{ weight: 1, arbitrary: arbBulletList },
		{ weight: 1, arbitrary: arbOrderedList },
		{ weight: 1, arbitrary: arbHorizontalRule },
	);

	// Arbitrary for a document
	const arbDocument = fc
		.array(arbBlock, { minLength: 1, maxLength: 5 })
		.map((blocks) => schema.node("doc", null, blocks));

	// Arbitrary for documents with only text blocks (for text-specific property tests)
	// These use text-only content (no atom nodes like mentions/cardRefs/tags)
	const arbTextOnlyParagraph = arbTextOnlyParagraphContent.map((content) =>
		schema.node("paragraph", null, content),
	);
	const arbTextOnlyHeading = fc
		.tuple(arbHeadingLevel, arbTextOnlyParagraphContent)
		.map(([level, content]) => schema.node("heading", { level }, content));
	const arbTextBlock = fc.oneof(arbTextOnlyParagraph, arbTextOnlyHeading);
	const arbTextOnlyDocument = fc
		.array(arbTextBlock, { minLength: 1, maxLength: 5 })
		.map((blocks) => schema.node("doc", null, blocks));

	it("roundtrip preserves document equality for all block types", () => {
		fc.assert(
			fc.property(arbDocument, (doc) => {
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return result.eq(doc);
			}),
			{ numRuns: 10_000 },
		);
	});

	it("roundtrip preserves text-only documents", () => {
		fc.assert(
			fc.property(arbTextOnlyDocument, (doc) => {
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return result.eq(doc);
			}),
			{ numRuns: 500 },
		);
	});

	it("lexicon text matches tree textContent for text blocks", () => {
		fc.assert(
			fc.property(arbTextOnlyDocument, (doc) => {
				const lexicon = treeToLexicon(doc);

				for (let i = 0; i < doc.childCount; i++) {
					const blockText = doc.child(i).textContent;
					const lexiconBlock = lexicon.content[i] as TextBlock | undefined;
					const lexiconText = lexiconBlock?.text ?? "";

					if (blockText !== lexiconText) {
						return false;
					}
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});

	it("feature count matches or exceeds mark types for text blocks", () => {
		fc.assert(
			fc.property(arbTextOnlyDocument, (doc) => {
				const lexicon = treeToLexicon(doc);

				for (let i = 0; i < doc.childCount; i++) {
					const block = doc.child(i);
					const lexiconBlock = lexicon.content[i] as TextBlock | undefined;

					// Count unique marks in this block
					const markTypes = new Set<string>();
					block.forEach((child) => {
						for (const mark of child.marks) {
							markTypes.add(mark.type.name);
						}
					});

					// Count total features across all facets
					const featureCount =
						lexiconBlock?.facets?.reduce(
							(acc, f) => acc + f.features.length,
							0,
						) ?? 0;

					// Total features should match or exceed unique mark types
					// (could have more if mark appears in non-contiguous regions)
					if (featureCount < markTypes.size) {
						return false;
					}
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});

	it("byte offsets are valid UTF-8 positions for text blocks", () => {
		fc.assert(
			fc.property(arbTextOnlyDocument, (doc) => {
				const lexicon = treeToLexicon(doc);

				for (const lexiconBlock of lexicon.content) {
					const block = lexiconBlock as TextBlock;
					const text = block.text ?? "";
					const textBytes = new TextEncoder().encode(text);
					const facets = block.facets ?? [];

					for (const facet of facets) {
						const { byteStart, byteEnd } = facet.index;

						// Check bounds
						if (byteStart < 0 || byteEnd > textBytes.length) {
							return false;
						}
						if (byteStart > byteEnd) {
							return false;
						}

						// Check that slicing at these positions produces valid UTF-8
						try {
							new TextDecoder("utf-8", { fatal: true }).decode(
								textBytes.slice(byteStart, byteEnd),
							);
						} catch {
							return false;
						}
					}
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});

	it("code blocks preserve text content exactly", () => {
		fc.assert(
			fc.property(arbCodeBlock, (codeBlock) => {
				const doc = schema.node("doc", null, [codeBlock]);
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return result.eq(doc);
			}),
			{ numRuns: 500 },
		);
	});

	it("bullet lists preserve all item text and marks", () => {
		fc.assert(
			fc.property(arbBulletList, (list) => {
				const doc = schema.node("doc", null, [list]);
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return result.eq(doc);
			}),
			{ numRuns: 500 },
		);
	});

	it("ordered lists preserve start number", () => {
		fc.assert(
			fc.property(arbOrderedList, (list) => {
				const doc = schema.node("doc", null, [list]);
				const lexicon = treeToLexicon(doc);
				const block = lexicon.content[0] as OrderedListBlock;
				const originalStart = list.attrs.order as number;
				const lexiconStart = block.start ?? 1;
				return (
					originalStart === lexiconStart ||
					(originalStart === 1 && block.start === undefined)
				);
			}),
			{ numRuns: 500 },
		);
	});

	it("horizontal rules roundtrip", () => {
		fc.assert(
			fc.property(arbHorizontalRule, (hr) => {
				const doc = schema.node("doc", null, [hr]);
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return result.eq(doc);
			}),
			{ numRuns: 100 },
		);
	});

	it("block count is preserved through roundtrip", () => {
		fc.assert(
			fc.property(arbDocument, (doc) => {
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);
				return doc.childCount === result.childCount;
			}),
			{ numRuns: 1000 },
		);
	});

	it("block types are preserved through roundtrip", () => {
		fc.assert(
			fc.property(arbDocument, (doc) => {
				const lexicon = treeToLexicon(doc);
				const result = lexiconToTree(lexicon);

				for (let i = 0; i < doc.childCount; i++) {
					if (doc.child(i).type.name !== result.child(i).type.name) {
						return false;
					}
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});
});

describe("documentToPlainText", () => {
	it("returns undefined for empty content", () => {
		const doc: LexiconDocument = { content: [] };
		expect(documentToPlainText(doc)).toBeUndefined();
	});

	it("returns undefined for missing content", () => {
		const doc: LexiconDocument = {} as LexiconDocument;
		expect(documentToPlainText(doc)).toBeUndefined();
	});

	it("extracts text from paragraph", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "Hello world",
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`"Hello world"`);
	});

	it("extracts text from heading", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#headingBlock",
					level: 1,
					text: "My Heading",
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`"My Heading"`);
	});

	it("extracts text from code block", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#codeBlock",
					text: "const x = 1;",
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`"const x = 1;"`);
	});

	it("extracts text from bullet list", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#bulletListBlock",
					items: [
						{ $type: "com.deckbelcher.richtext#listItem", text: "Item one" },
						{ $type: "com.deckbelcher.richtext#listItem", text: "Item two" },
					],
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`
			"Item one
			Item two"
		`);
	});

	it("extracts text from ordered list", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#orderedListBlock",
					items: [
						{ $type: "com.deckbelcher.richtext#listItem", text: "First" },
						{ $type: "com.deckbelcher.richtext#listItem", text: "Second" },
					],
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`
			"First
			Second"
		`);
	});

	it("ignores horizontal rules", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "Before",
				},
				{ $type: "com.deckbelcher.richtext#horizontalRuleBlock" },
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "After",
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`
			"Before

			After"
		`);
	});

	it("joins multiple blocks with newlines", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#headingBlock",
					level: 1,
					text: "Title",
				},
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "First paragraph.",
				},
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "Second paragraph.",
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(`
			"Title
			First paragraph.
			Second paragraph."
		`);
	});

	it("strips formatting facets", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "Bold and italic text",
					facets: [
						{
							index: { byteStart: 0, byteEnd: 4 },
							features: [{ $type: "com.deckbelcher.richtext.facet#bold" }],
						},
						{
							index: { byteStart: 9, byteEnd: 15 },
							features: [{ $type: "com.deckbelcher.richtext.facet#italic" }],
						},
					],
				},
			],
		};
		expect(documentToPlainText(doc)).toMatchInlineSnapshot(
			`"Bold and italic text"`,
		);
	});

	it("returns undefined for whitespace-only content", () => {
		const doc: LexiconDocument = {
			content: [
				{
					$type: "com.deckbelcher.richtext#paragraphBlock",
					text: "   ",
				},
			],
		};
		expect(documentToPlainText(doc)).toBeUndefined();
	});
});
