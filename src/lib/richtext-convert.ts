import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "@/components/richtext/schema";
import type {
	HeadingBlock,
	Document as LexiconDocument,
	ParagraphBlock,
} from "@/lib/lexicons/types/com/deckbelcher/richtext";
import type {
	Bold,
	Code,
	Main as Facet,
	Italic,
	Link,
} from "@/lib/lexicons/types/com/deckbelcher/richtext/facet";

export type { LexiconDocument };

/**
 * Make $type required - distributes over unions.
 * Use this when creating records for storage where $type must be present.
 */
type Typed<T> = T extends { $type?: string }
	? T & { $type: NonNullable<T["$type"]> }
	: T;

type Block = Typed<ParagraphBlock | HeadingBlock>;
type Feature = Typed<Bold | Italic | Code | Link>;

/**
 * Convert a tree (ProseMirror doc) to lexicon format for storage.
 */
export function treeToLexicon(doc: ProseMirrorNode): LexiconDocument {
	const content: Block[] = [];

	doc.forEach((block) => {
		if (block.type.name === "paragraph") {
			content.push(paragraphToLexicon(block));
		} else if (block.type.name === "heading") {
			content.push(headingToLexicon(block));
		}
		// TODO: handle other block types (code_block, blockquote)
	});

	return { content };
}

/**
 * Convert a paragraph node to lexicon format.
 */
function paragraphToLexicon(node: ProseMirrorNode): Typed<ParagraphBlock> {
	const { text, facets } = extractTextAndFacets(node);
	return {
		$type: "com.deckbelcher.richtext#paragraphBlock",
		text: text || undefined,
		facets: facets.length > 0 ? facets : undefined,
	};
}

/**
 * Convert a heading node to lexicon format.
 */
function headingToLexicon(node: ProseMirrorNode): Typed<HeadingBlock> {
	const { text, facets } = extractTextAndFacets(node);
	const level = (node.attrs.level as number) || 1;
	return {
		$type: "com.deckbelcher.richtext#headingBlock",
		level,
		text: text || undefined,
		facets: facets.length > 0 ? facets : undefined,
	};
}

/**
 * Extract text content and facets from a block node.
 */
function extractTextAndFacets(node: ProseMirrorNode): {
	text: string;
	facets: Facet[];
} {
	const textParts: string[] = [];
	const facets: Facet[] = [];

	// Track active marks and their start byte positions
	const activeMarks = new Map<string, { byteStart: number; attrs?: unknown }>();

	let byteOffset = 0;

	node.forEach((child) => {
		if (child.isText && child.text) {
			const text = child.text;
			const textBytes = new TextEncoder().encode(text);
			const startByte = byteOffset;
			const endByte = byteOffset + textBytes.length;

			textParts.push(text);

			// Get current marks on this text node
			const currentMarkKeys = new Set(child.marks.map((m) => markKey(m)));

			// Close marks that are no longer active
			for (const [key, data] of activeMarks) {
				if (!currentMarkKeys.has(key)) {
					const feature = markToFeature(key, data.attrs);
					if (feature) {
						facets.push({
							index: { byteStart: data.byteStart, byteEnd: startByte },
							features: [feature],
						});
					}
					activeMarks.delete(key);
				}
			}

			// Open new marks
			for (const mark of child.marks) {
				const key = markKey(mark);
				if (!activeMarks.has(key)) {
					activeMarks.set(key, { byteStart: startByte, attrs: mark.attrs });
				}
			}

			byteOffset = endByte;
		} else if (child.type.name === "mention") {
			// Inline node - render as @handle placeholder
			const handle = (child.attrs.handle as string) || "";
			const displayText = `@${handle}`;
			const textBytes = new TextEncoder().encode(displayText);

			textParts.push(displayText);

			if (child.attrs.did) {
				facets.push({
					index: {
						byteStart: byteOffset,
						byteEnd: byteOffset + textBytes.length,
					},
					features: [
						{
							$type: "com.deckbelcher.richtext.facet#mention",
							did: child.attrs.did as `did:${string}:${string}`,
						},
					],
				});
			}

			byteOffset += textBytes.length;
		}
		// TODO: handle cardRef and other inline nodes
	});

	// Close any remaining active marks
	for (const [key, data] of activeMarks) {
		const feature = markToFeature(key, data.attrs);
		if (feature) {
			facets.push({
				index: { byteStart: data.byteStart, byteEnd: byteOffset },
				features: [feature],
			});
		}
	}

	// Merge facets with the same byte range
	const mergedFacets = mergeFacets(facets);

	return { text: textParts.join(""), facets: mergedFacets };
}

/**
 * Merge facets that have the same byte range into single facets with multiple features.
 */
function mergeFacets(facets: Facet[]): Facet[] {
	if (facets.length === 0) return [];

	const byRange = new Map<string, Facet>();

	for (const facet of facets) {
		const key = `${facet.index.byteStart}:${facet.index.byteEnd}`;
		const existing = byRange.get(key);
		if (existing) {
			existing.features.push(...facet.features);
		} else {
			byRange.set(key, {
				index: { ...facet.index },
				features: [...facet.features],
			});
		}
	}

	return Array.from(byRange.values());
}

function markKey(mark: Mark): string {
	if (mark.type.name === "link" && mark.attrs) {
		return `link:${(mark.attrs as { href?: string }).href}`;
	}
	return mark.type.name;
}

function markToFeature(key: string, attrs?: unknown): Feature | null {
	if (key === "strong") {
		return { $type: "com.deckbelcher.richtext.facet#bold" };
	}
	if (key === "em") {
		return { $type: "com.deckbelcher.richtext.facet#italic" };
	}
	if (key === "code") {
		return { $type: "com.deckbelcher.richtext.facet#code" };
	}
	if (key.startsWith("link:")) {
		const href = (attrs as { href?: string })?.href || "";
		return {
			$type: "com.deckbelcher.richtext.facet#link",
			uri: href as `${string}:${string}`,
		};
	}
	return null;
}

/**
 * Convert lexicon format to a tree (ProseMirror doc) for editing.
 */
export function lexiconToTree(doc: LexiconDocument): ProseMirrorNode {
	const blocks = doc.content.map((block) => lexiconBlockToTree(block));
	return schema.node("doc", null, blocks);
}

function lexiconBlockToTree(
	block: ParagraphBlock | HeadingBlock,
): ProseMirrorNode {
	switch (block.$type) {
		case "com.deckbelcher.richtext#headingBlock":
			return lexiconHeadingToTree(block);
		default:
			return lexiconParagraphToTree(block as ParagraphBlock);
	}
}

function lexiconParagraphToTree(block: ParagraphBlock): ProseMirrorNode {
	const text = block.text || "";
	if (!text) {
		return schema.node("paragraph");
	}

	const nodes = textAndFacetsToNodes(text, block.facets || []);
	return schema.node("paragraph", null, nodes.length > 0 ? nodes : undefined);
}

function lexiconHeadingToTree(block: HeadingBlock): ProseMirrorNode {
	const text = block.text || "";
	const level = block.level || 1;

	if (!text) {
		return schema.node("heading", { level });
	}

	const nodes = textAndFacetsToNodes(text, block.facets || []);
	return schema.node(
		"heading",
		{ level },
		nodes.length > 0 ? nodes : undefined,
	);
}

export interface Segment {
	text: string;
	features: unknown[];
}

/**
 * Segment text by facet boundaries, accumulating features from all facets
 * that cover each byte range. Handles overlapping facets correctly.
 */
export function segmentize(text: string, facets: Facet[]): Segment[] {
	if (facets.length === 0) {
		return [{ text, features: [] }];
	}

	// Collect all unique byte positions where facets start or end
	const positions = new Set<number>([0]);
	const textBytes = new TextEncoder().encode(text);
	positions.add(textBytes.length);

	for (const facet of facets) {
		positions.add(facet.index.byteStart);
		positions.add(facet.index.byteEnd);
	}

	// Sort positions
	const sortedPositions = Array.from(positions).sort((a, b) => a - b);

	// Create segments between each pair of adjacent positions
	const segments: Segment[] = [];
	const decoder = new TextDecoder();

	for (let i = 0; i < sortedPositions.length - 1; i++) {
		const start = sortedPositions[i];
		const end = sortedPositions[i + 1];

		// Extract text for this byte range
		const segmentText = decoder.decode(textBytes.slice(start, end));
		if (!segmentText) continue;

		// Collect all features from facets that cover this segment
		const features: unknown[] = [];
		for (const facet of facets) {
			if (facet.index.byteStart <= start && facet.index.byteEnd >= end) {
				features.push(...facet.features);
			}
		}

		segments.push({ text: segmentText, features });
	}

	return segments;
}

function textAndFacetsToNodes(
	text: string,
	facets: Facet[],
): ProseMirrorNode[] {
	if (facets.length === 0) {
		return [schema.text(text)];
	}

	const segments = segmentize(text, facets);

	const nodes: ProseMirrorNode[] = [];
	for (const segment of segments) {
		if (!segment.text) continue;

		const marks: Mark[] = [];
		for (const feature of segment.features) {
			const mark = featureToMark(feature);
			if (mark) {
				marks.push(mark);
			}
		}

		// TODO: handle mentions as inline nodes instead of marked text

		nodes.push(schema.text(segment.text, marks));
	}

	return nodes;
}

function featureToMark(feature: unknown): Mark | null {
	const f = feature as { $type?: string; uri?: string };
	switch (f.$type) {
		case "com.deckbelcher.richtext.facet#bold":
			return schema.marks.strong.create();
		case "com.deckbelcher.richtext.facet#italic":
			return schema.marks.em.create();
		case "com.deckbelcher.richtext.facet#code":
			return schema.marks.code.create();
		case "com.deckbelcher.richtext.facet#link":
			return schema.marks.link.create({ href: f.uri });
		// Mentions are inline nodes, not marks - handled separately
		default:
			return null;
	}
}
