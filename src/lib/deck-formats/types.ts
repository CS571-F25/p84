/**
 * Deck format types for multi-format import/export
 */

/**
 * Supported deck formats for import/export
 *
 * - arena: MTG Arena format (de facto standard)
 * - mtgo: MTGO format (names only, Sideboard: section)
 * - moxfield: Moxfield format (Arena + foil markers + tags)
 * - archidekt: Archidekt text export (inline section markers)
 * - mtggoldfish: MTGGoldfish exact versions (square brackets for set)
 * - xmage: XMage .dck format (set before name)
 * - deckstats: Deckstats.net format (comment sections)
 * - tappedout: TappedOut format (quantity with x suffix)
 * - generic: Plain card list (quantity + name only)
 */
export type DeckFormat =
	| "arena"
	| "mtgo"
	| "moxfield"
	| "archidekt"
	| "mtggoldfish"
	| "xmage"
	| "deckstats"
	| "tappedout"
	| "generic";

/**
 * Sections in a parsed deck
 */
export type DeckSection =
	| "commander"
	| "mainboard"
	| "sideboard"
	| "maybeboard";

/**
 * A parsed card line with all extracted information
 */
export interface ParsedCardLine {
	/** Number of copies (defaults to 1) */
	quantity: number;
	/** Card name as written */
	name: string;
	/** Set code if specified (normalized to uppercase) */
	setCode?: string;
	/** Collector number if specified */
	collectorNumber?: string;
	/** Tags (Moxfield #tag style) */
	tags: string[];
	/** Original raw line text */
	raw: string;
}

/**
 * A fully parsed deck with all sections
 */
export interface ParsedDeck {
	/** Commander zone cards */
	commander: ParsedCardLine[];
	/** Main deck cards */
	mainboard: ParsedCardLine[];
	/** Sideboard cards */
	sideboard: ParsedCardLine[];
	/** Maybeboard cards */
	maybeboard: ParsedCardLine[];
	/** Detected or specified format */
	format?: DeckFormat;
	/** Deck name if found in file (e.g., XMage NAME: line) */
	name?: string;
}

/**
 * Result of parsing a section marker line
 */
export interface SectionMarkerResult {
	/** The section this marker indicates */
	section: DeckSection;
	/** Whether to consume the line (don't parse as card) */
	consumeLine: boolean;
}

/**
 * Result of extracting inline section from a card line
 */
export interface InlineSectionResult {
	/** Section extracted from inline marker (e.g., [Sideboard]) */
	section?: DeckSection;
	/** The card line with inline marker removed */
	cardLine: string;
	/** Category tags extracted from inline markers (e.g., [Removal,Draw]) */
	tags?: string[];
}

/**
 * Options for parsing a deck
 */
export interface ParseOptions {
	/** Override format detection */
	format?: DeckFormat;
	/** Default section for cards without explicit section */
	defaultSection?: DeckSection;
	/**
	 * Strip tags that match card types (creature, land, instant, etc.)
	 * These are often redundant with the card's actual type.
	 * Default: true
	 */
	stripRedundantTypeTags?: boolean;
}

/**
 * Options for exporting a deck
 */
export interface ExportOptions {
	/** Include maybeboard in export (default: false) */
	includeMaybeboard?: boolean;
	/** Include tags in export (only for formats that support them) */
	includeTags?: boolean;
}

/**
 * Create an empty ParsedDeck
 */
export function emptyParsedDeck(): ParsedDeck {
	return {
		commander: [],
		mainboard: [],
		sideboard: [],
		maybeboard: [],
	};
}

/**
 * Get total card count across all sections
 */
export function totalCards(deck: ParsedDeck): number {
	return (
		sumQuantities(deck.commander) +
		sumQuantities(deck.mainboard) +
		sumQuantities(deck.sideboard) +
		sumQuantities(deck.maybeboard)
	);
}

/**
 * Sum quantities of parsed card lines
 */
function sumQuantities(cards: ParsedCardLine[]): number {
	return cards.reduce((sum, card) => sum + card.quantity, 0);
}
