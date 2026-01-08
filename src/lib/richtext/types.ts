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

export type FormatFeature = BoldFeature | ItalicFeature;

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

export const BOLD: BoldFeature = {
	$type: "com.deckbelcher.richtext.facet#bold",
};

export const ITALIC: ItalicFeature = {
	$type: "com.deckbelcher.richtext.facet#italic",
};
