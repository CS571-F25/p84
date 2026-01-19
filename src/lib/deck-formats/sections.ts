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

		// Other // comments are custom categories - treat as mainboard, consume line
		return { section: "mainboard", consumeLine: true };
	}

	// TappedOut "About" header line (and "Name ..." line)
	if (/^About$/i.test(trimmed) || /^Name\s+/i.test(trimmed)) {
		// These are metadata lines, consume but don't change section
		return { section: "mainboard", consumeLine: true };
	}

	// XMage metadata lines - consume but don't treat as section
	if (trimmed.startsWith("NAME:") || trimmed.startsWith("LAYOUT ")) {
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

/**
 * Extract inline section markers from a card line.
 *
 * Handles:
 * - Archidekt: [Sideboard], [Commander{top}], [Maybeboard{noDeck}{noPrice}]
 * - Deckstats: # !Commander
 * - XMage/Deckstats: SB: prefix
 *
 * Returns the section (if found) and the card line with the marker removed.
 */
export function extractInlineSection(line: string): InlineSectionResult {
	let cardLine = line;
	let section: DeckSection | undefined;

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

	// Archidekt inline section markers: [Sideboard], [Commander{...}], [Maybeboard{...}]
	// These can appear with other category info like [Maybeboard{noDeck},Creature]
	const archidektMatch =
		/\[(Sideboard|Commander|Maybeboard)(?:\{[^}]*\})?[^\]]*\]/i.exec(cardLine);
	if (archidektMatch) {
		section = normalizeSectionName(archidektMatch[1]);
		// Remove the entire [...] marker
		cardLine =
			cardLine.slice(0, archidektMatch.index) +
			cardLine.slice(archidektMatch.index + archidektMatch[0].length);
	}

	return {
		section,
		cardLine,
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
