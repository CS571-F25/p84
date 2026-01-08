import type { Main as LexiconRichText } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import type {
	ByteSlice as LexiconByteSlice,
	Link as LexiconLink,
	Mention as LexiconMention,
} from "@/lib/lexicons/types/com/deckbelcher/richtext/facet";

// ByteSlice matches lexicon exactly
export interface ByteSlice {
	byteStart: number;
	byteEnd: number;
}

// Feature types with required $type for our internal use
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
	uri: LexiconLink["uri"];
}

export interface MentionFeature {
	$type: "com.deckbelcher.richtext.facet#mention";
	did: LexiconMention["did"];
}

export interface TagFeature {
	$type: "com.deckbelcher.richtext.facet#tag";
	tag: string;
}

export type FormatFeature =
	| BoldFeature
	| ItalicFeature
	| CodeFeature
	| CodeBlockFeature
	| LinkFeature
	| MentionFeature
	| TagFeature;

export interface Facet {
	index: ByteSlice;
	features: FormatFeature[];
}

export interface ParseResult {
	text: string;
	facets: Facet[];
}

// Type alias for lexicon compatibility
export type RichText = LexiconRichText;
export type { LexiconByteSlice };

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

export function isTag(feature: FormatFeature): feature is TagFeature {
	return feature.$type === "com.deckbelcher.richtext.facet#tag";
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
	return {
		$type: "com.deckbelcher.richtext.facet#link",
		uri: uri as LinkFeature["uri"],
	};
}

export function mention(did: string): MentionFeature {
	return {
		$type: "com.deckbelcher.richtext.facet#mention",
		did: did as MentionFeature["did"],
	};
}

export function tag(value: string): TagFeature {
	return {
		$type: "com.deckbelcher.richtext.facet#tag",
		tag: value,
	};
}
