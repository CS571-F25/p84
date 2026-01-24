/**
 * Deck format library
 *
 * Universal parser and exporters for MTG deck list formats:
 * - Arena, MTGO, Moxfield, TappedOut, Deckstats, XMage, MTGGoldfish, Archidekt
 *
 * @example
 * ```ts
 * import { parseDeck, formatDeck, detectFormat } from "@/lib/deck-formats";
 *
 * // Parse any format (auto-detected)
 * const deck = parseDeck(text);
 *
 * // Export to specific format
 * const arenaExport = formatDeck(deck, "arena");
 * ```
 */

// Format detection
export { detectFormat } from "./detect";
// Exporting
export {
	formatArena,
	formatCardLine,
	formatDeck,
	formatMoxfield,
	formatMtgo,
} from "./export";
// Line matching (for previews)
export { type MatchedLine, matchLinesToParsedCards } from "./match-lines";
// Parsing
export { parseCardLine, parseDeck } from "./parse";
// Section utilities (for advanced use)
export { extractInlineSection, parseSectionMarker } from "./sections";
export type {
	DeckFormat,
	DeckSection,
	InlineSectionResult,
	ParsedCardLine,
	ParsedDeck,
	SectionMarkerResult,
} from "./types";
// Types and constants
export { DECK_FORMATS } from "./types";
