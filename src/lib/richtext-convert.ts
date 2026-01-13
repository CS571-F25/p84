import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { schema } from "@/components/richtext/schema";
import type {
	BulletListBlock,
	CodeBlock,
	HeadingBlock,
	HorizontalRuleBlock,
	Document as LexiconDocument,
	ListItem,
	OrderedListBlock,
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

type Block = Typed<
	| ParagraphBlock
	| HeadingBlock
	| CodeBlock
	| BulletListBlock
	| OrderedListBlock
	| HorizontalRuleBlock
>;
type Feature = Typed<Bold | Italic | Code | Link>;

/**
 * Convert a tree (ProseMirror doc) to lexicon format for storage.
 */
export function treeToLexicon(doc: ProseMirrorNode): LexiconDocument {
	const content: Block[] = [];

	doc.forEach((block) => {
		switch (block.type.name) {
			case "paragraph":
				content.push(paragraphToLexicon(block));
				break;
			case "heading":
				content.push(headingToLexicon(block));
				break;
			case "code_block":
				content.push(codeBlockToLexicon(block));
				break;
			case "bullet_list":
				content.push(bulletListToLexicon(block));
				break;
			case "ordered_list":
				content.push(orderedListToLexicon(block));
				break;
			case "horizontal_rule":
				content.push(horizontalRuleToLexicon());
				break;
		}
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
 * Convert a code_block node to lexicon format.
 */
function codeBlockToLexicon(node: ProseMirrorNode): Typed<CodeBlock> {
	return {
		$type: "com.deckbelcher.richtext#codeBlock",
		text: node.textContent,
		language: (node.attrs.params as string) || undefined,
	};
}

/**
 * Collect children of a node into an array.
 */
function childrenOf(node: ProseMirrorNode): ProseMirrorNode[] {
	const children: ProseMirrorNode[] = [];
	node.forEach((child) => {
		children.push(child);
	});
	return children;
}

/**
 * Convert a bullet_list node to lexicon format.
 */
function bulletListToLexicon(node: ProseMirrorNode): Typed<BulletListBlock> {
	return {
		$type: "com.deckbelcher.richtext#bulletListBlock",
		items: childrenOf(node).map(listItemToLexicon),
	};
}

/**
 * Convert an ordered_list node to lexicon format.
 */
function orderedListToLexicon(node: ProseMirrorNode): Typed<OrderedListBlock> {
	const start = (node.attrs.order as number) || 1;
	return {
		$type: "com.deckbelcher.richtext#orderedListBlock",
		items: childrenOf(node).map(listItemToLexicon),
		start: start !== 1 ? start : undefined,
	};
}

/**
 * Convert a list_item node to lexicon format.
 * Extracts text from the first paragraph child and any nested list.
 */
function listItemToLexicon(node: ProseMirrorNode): Typed<ListItem> {
	const children = childrenOf(node);
	const firstParagraph = children[0];

	let text: string | undefined;
	let facets: Facet[] | undefined;

	if (firstParagraph?.type.name === "paragraph") {
		const extracted = extractTextAndFacets(firstParagraph);
		text = extracted.text || undefined;
		facets = extracted.facets.length > 0 ? extracted.facets : undefined;
	}

	// Look for nested list after the first paragraph
	let sublist: Typed<BulletListBlock> | Typed<OrderedListBlock> | undefined;
	for (let i = 1; i < children.length; i++) {
		const child = children[i];
		if (child.type.name === "bullet_list") {
			sublist = bulletListToLexicon(child);
			break;
		}
		if (child.type.name === "ordered_list") {
			sublist = orderedListToLexicon(child);
			break;
		}
	}

	return {
		$type: "com.deckbelcher.richtext#listItem",
		text,
		facets,
		sublist,
	};
}

/**
 * Convert a horizontal_rule node to lexicon format.
 */
function horizontalRuleToLexicon(): Typed<HorizontalRuleBlock> {
	return { $type: "com.deckbelcher.richtext#horizontalRuleBlock" };
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

			// TODO: resolve handle to DID if not already resolved
			// For now, use a placeholder DID based on handle to preserve roundtrip
			const did =
				(child.attrs.did as `did:${string}:${string}` | null) ||
				(`did:handle:${handle}` as `did:${string}:${string}`);

			facets.push({
				index: {
					byteStart: byteOffset,
					byteEnd: byteOffset + textBytes.length,
				},
				features: [
					{
						$type: "com.deckbelcher.richtext.facet#mention",
						did,
					},
				],
			});

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

function lexiconBlockToTree(block: Block): ProseMirrorNode {
	switch (block.$type) {
		case "com.deckbelcher.richtext#headingBlock":
			return lexiconHeadingToTree(block);
		case "com.deckbelcher.richtext#codeBlock":
			return lexiconCodeBlockToTree(block);
		case "com.deckbelcher.richtext#bulletListBlock":
			return lexiconBulletListToTree(block);
		case "com.deckbelcher.richtext#orderedListBlock":
			return lexiconOrderedListToTree(block);
		case "com.deckbelcher.richtext#horizontalRuleBlock":
			return schema.node("horizontal_rule");
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

function lexiconCodeBlockToTree(block: CodeBlock): ProseMirrorNode {
	return schema.node(
		"code_block",
		{ params: block.language || "" },
		block.text ? [schema.text(block.text)] : undefined,
	);
}

function lexiconBulletListToTree(block: BulletListBlock): ProseMirrorNode {
	const items = block.items.map(lexiconListItemToTree);
	return schema.node("bullet_list", null, items);
}

function lexiconOrderedListToTree(block: OrderedListBlock): ProseMirrorNode {
	const items = block.items.map(lexiconListItemToTree);
	return schema.node("ordered_list", { order: block.start || 1 }, items);
}

function lexiconListItemToTree(item: ListItem): ProseMirrorNode {
	const text = item.text || "";
	const content: ProseMirrorNode[] = [];

	// First paragraph (required by schema)
	if (text) {
		const nodes = textAndFacetsToNodes(text, item.facets || []);
		content.push(
			schema.node("paragraph", null, nodes.length > 0 ? nodes : undefined),
		);
	} else {
		content.push(schema.node("paragraph"));
	}

	// Nested sublist if present
	if (item.sublist) {
		const sublistType = (item.sublist as { $type?: string }).$type;
		if (sublistType === "com.deckbelcher.richtext#bulletListBlock") {
			content.push(
				lexiconBulletListToTree(item.sublist as unknown as BulletListBlock),
			);
		} else if (sublistType === "com.deckbelcher.richtext#orderedListBlock") {
			content.push(
				lexiconOrderedListToTree(item.sublist as unknown as OrderedListBlock),
			);
		}
	}

	return schema.node("list_item", null, content);
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

		// Check for mention facet - these become inline nodes, not marked text
		const mentionFeature = segment.features.find(
			(f) =>
				(f as { $type?: string }).$type ===
				"com.deckbelcher.richtext.facet#mention",
		) as { $type: string; did?: string } | undefined;

		if (mentionFeature) {
			// Extract handle from text (strip @ prefix)
			const handle = segment.text.startsWith("@")
				? segment.text.slice(1)
				: segment.text;
			nodes.push(
				schema.nodes.mention.create({
					handle,
					did: mentionFeature.did || null,
				}),
			);
			continue;
		}

		const marks: Mark[] = [];
		for (const feature of segment.features) {
			const mark = featureToMark(feature);
			if (mark) {
				marks.push(mark);
			}
		}

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
