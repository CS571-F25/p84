/**
 * Section marker parsing for deck lists
 *
 * Handles various ways different formats indicate deck sections:
 * - Arena: "Deck", "Sideboard", "Commander" on their own line
 * - Deckstats: //Section comments
 * - Archidekt: inline [Sideboard], [Commander{...}] markers
 * - XMage: SB: prefix
 */

import type {
	DeckSection,
	InlineSectionResult,
	SectionMarkerResult,
} from "./types";

/**
 * Parse a line to see if it's a section marker.
 *
 * Returns the section and whether to consume the line (not parse as a card).
 * Returns null if the line is not a section marker.
 */
export function parseSectionMarker(line: string): SectionMarkerResult | null {
	const trimmed = line.trim();

	if (!trimmed) {
		return null;
	}

	// Arena-style section headers (on their own line, optionally with colon)
	const arenaMatch =
		/^(Deck|Sideboard|Commander|Companion|Maybeboard):?$/i.exec(trimmed);
	if (arenaMatch) {
		const section = normalizeSectionName(arenaMatch[1]);
		return { section, consumeLine: true };
	}

	// Deckstats //Section comments
	if (trimmed.startsWith("//")) {
		const sectionName = trimmed.slice(2).trim().toLowerCase();

		// //NAME: is metadata, not a section - let parse.ts handle it
		if (sectionName.startsWith("name:")) {
			return null;
		}

		// Map known section names
		if (sectionName === "main" || sectionName === "mainboard") {
			return { section: "mainboard", consumeLine: true };
		}
		if (sectionName === "sideboard" || sectionName === "side") {
			return { section: "sideboard", consumeLine: true };
		}
		if (sectionName === "maybeboard" || sectionName === "maybe") {
			return { section: "maybeboard", consumeLine: true };
		}
		if (sectionName === "commander") {
			return { section: "commander", consumeLine: true };
		}

		// Other // comments are custom categories - let parse.ts handle them
		return null;
	}

	// XMage metadata lines - don't treat as section marker
	// (handled by parse.ts to extract deck name)
	if (trimmed.startsWith("NAME:") || trimmed.startsWith("LAYOUT ")) {
		return null;
	}

	// TappedOut "About" and "Name ..." metadata lines - don't treat as section marker
	// (handled by parse.ts to extract deck name)
	if (/^About$/i.test(trimmed) || /^Name\s+/i.test(trimmed)) {
		return null;
	}

	// Deckstats generic txt uses plain section names without //
	// e.g., "Main", "burn", "draw" as category headers
	// Only match if it's a single word and a known section
	const plainSectionMatch =
		/^(Main|Mainboard|Sideboard|Maybeboard|Commander)$/i.exec(trimmed);
	if (plainSectionMatch) {
		const section = normalizeSectionName(plainSectionMatch[1]);
		return { section, consumeLine: true };
	}

	return null;
}

// Card types to ignore when extracting category tags
const CARD_TYPES = new Set([
	"creature",
	"instant",
	"sorcery",
	"artifact",
	"enchantment",
	"land",
	"planeswalker",
	"battle",
	"kindred",
	"tribal",
]);

// Section names that indicate deck sections, not categories
const SECTION_NAMES = new Set(["sideboard", "commander", "maybeboard"]);

/**
 * Options for extractInlineSection
 */
export interface ExtractInlineSectionOptions {
	/** Format hint to determine bracket handling (XMage uses [SET:NUM], Archidekt uses [Category]) */
	format?: string;
	/** Strip tags that match card types (creature, land, etc.) - default true */
	stripRedundantTypeTags?: boolean;
}

/**
 * Extract inline section markers and category tags from a card line.
 *
 * Handles:
 * - Archidekt: [Sideboard], [Commander{top}], [Maybeboard{noDeck}{noPrice}], [Removal,Draw]
 * - Deckstats: # !Commander
 * - XMage/Deckstats: SB: prefix
 *
 * Returns the section (if found), category tags, and the card line with markers removed.
 */
export function extractInlineSection(
	line: string,
	options?: ExtractInlineSectionOptions,
): InlineSectionResult {
	const { format, stripRedundantTypeTags = true } = options ?? {};
	let cardLine = line;
	let section: DeckSection | undefined;
	const tags: string[] = [];

	// XMage/Deckstats SB: prefix
	const sbPrefixMatch = /^SB:\s*(.*)$/i.exec(cardLine);
	if (sbPrefixMatch) {
		return {
			section: "sideboard",
			cardLine: sbPrefixMatch[1],
		};
	}

	// Deckstats # !Commander marker
	const commanderMarkerMatch = /\s*#\s*!Commander\s*$/i.exec(cardLine);
	if (commanderMarkerMatch) {
		return {
			section: "commander",
			cardLine: cardLine.slice(0, commanderMarkerMatch.index),
		};
	}

	// XMage uses [SET:NUM] for set codes, MTGGoldfish uses [SET] after name
	// Don't extract brackets as categories for these formats
	if (format === "xmage" || format === "mtggoldfish") {
		return { section, cardLine };
	}

	// Extract all [...] markers from Archidekt format
	// Match [Content] or [Content{options}] or [Content{options},MoreContent]
	const bracketMatches = cardLine.matchAll(/\[([^\]]+)\]/g);
	for (const match of bracketMatches) {
		const content = match[1];
		// Split by comma to handle [Burn,Recursion] or [Sideboard,Artifact]
		const parts = content.split(",").map((p) => p.trim());

		for (const part of parts) {
			// Strip {options} like {top}, {noDeck}, {noPrice}
			const name = part.replace(/\{[^}]*\}/g, "").trim();
			if (!name) continue;

			const lower = name.toLowerCase();

			// Check if it's a section marker
			if (SECTION_NAMES.has(lower)) {
				section = normalizeSectionName(name);
			}
			// Skip card types if stripping is enabled
			else if (!stripRedundantTypeTags || !CARD_TYPES.has(lower)) {
				// It's a category tag
				tags.push(name);
			}
		}
	}

	// Remove all [...] markers from the card line
	cardLine = cardLine.replace(/\s*\[[^\]]+\]/g, "").trim();

	return {
		section,
		cardLine,
		tags: tags.length > 0 ? tags : undefined,
	};
}

/**
 * Normalize various section name variations to our standard names.
 */
function normalizeSectionName(name: string): DeckSection {
	const lower = name.toLowerCase();

	switch (lower) {
		case "deck":
		case "main":
		case "mainboard":
			return "mainboard";
		case "side":
		case "sideboard":
		case "companion":
			// Companion is rules-wise part of sideboard
			return "sideboard";
		case "maybe":
		case "maybeboard":
			return "maybeboard";
		case "commander":
			return "commander";
		default:
			return "mainboard";
	}
}
