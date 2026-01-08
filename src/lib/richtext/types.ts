export interface ByteSlice {
	byteStart: number;
	byteEnd: number;
}

export interface BoldFeature {
	$type: "com.deckbelcher.richtext.facet#bold";
}

export interface ItalicFeature {
	$type: "com.deckbelcher.richtext.facet#italic";
}

export interface CodeFeature {
	$type: "com.deckbelcher.richtext.facet#code";
}

export interface CodeBlockFeature {
	$type: "com.deckbelcher.richtext.facet#codeBlock";
}

export interface LinkFeature {
	$type: "com.deckbelcher.richtext.facet#link";
	uri: string;
}

export interface MentionFeature {
	$type: "com.deckbelcher.richtext.facet#mention";
	did: string;
}

export type FormatFeature =
	| BoldFeature
	| ItalicFeature
	| CodeFeature
	| CodeBlockFeature
	| LinkFeature
	| MentionFeature;

export interface Facet {
	index: ByteSlice;
	features: FormatFeature[];
}

export interface ParseResult {
	text: string;
	facets: Facet[];
}

export function isBold(feature: FormatFeature): feature is BoldFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#bold";
}

export function isItalic(feature: FormatFeature): feature is ItalicFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#italic";
}

export function isCode(feature: FormatFeature): feature is CodeFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#code";
}

export function isCodeBlock(
	feature: FormatFeature,
): feature is CodeBlockFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#codeBlock";
}

export function isLink(feature: FormatFeature): feature is LinkFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#link";
}

export function isMention(feature: FormatFeature): feature is MentionFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#mention";
}

export const BOLD: BoldFeature = {
	$type: "com.deckbelcher.richtext.facet#bold",
};

export const ITALIC: ItalicFeature = {
	$type: "com.deckbelcher.richtext.facet#italic",
};

export const CODE: CodeFeature = {
	$type: "com.deckbelcher.richtext.facet#code",
};

export const CODE_BLOCK: CodeBlockFeature = {
	$type: "com.deckbelcher.richtext.facet#codeBlock",
};

export function link(uri: string): LinkFeature {
	return { $type: "com.deckbelcher.richtext.facet#link", uri };
}

export function mention(did: string): MentionFeature {
	return { $type: "com.deckbelcher.richtext.facet#mention", did };
}
