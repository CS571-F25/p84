/**
 * Universal deck list parser
 *
 * Handles multiple formats:
 * - Arena: `4 Name (SET) 123`
 * - TappedOut: `4x Name`
 * - XMage: `4 [SET:123] Name`
 * - MTGGoldfish: `4 Name [SET]` or `4 Name <variant> [SET]`
 * - Moxfield: `4 Name (SET) 123 *F* #tag`
 * - Archidekt: `4x Name (set) 123 [Section] ^Tag^`
 * - Deckstats: `4 Name # !Commander`
 */

import { detectFormat } from "./detect";
import { extractInlineSection, parseSectionMarker } from "./sections";
import type {
	DeckSection,
	ParsedCardLine,
	ParsedDeck,
	ParseOptions,
} from "./types";

/**
 * Parse a single line of card text.
 *
 * Handles all format variations for quantity, set code, and collector number.
 * Tries patterns in order of specificity - most distinctive first.
 */
export function parseCardLine(line: string): ParsedCardLine | null {
	let remaining = line.trim();
	if (!remaining) {
		return null;
	}

	// Strip *F* (foil) and *A* (alter) markers
	remaining = remaining.replace(/\s*\*[FA]\*\s*/g, " ").trim();

	// Strip ^Tag,#color^ markers (Archidekt)
	remaining = remaining.replace(/\s*\^[^^]+\^\s*/g, " ").trim();

	// Extract <collector#> from MTGGoldfish variant markers before stripping
	let variantCollectorNumber: string | undefined;
	const collectorInVariant = remaining.match(/<(\d+[a-z★†]?)>/i);
	if (collectorInVariant) {
		variantCollectorNumber = collectorInVariant[1];
	}
	// Strip <variant> markers (MTGGoldfish)
	remaining = remaining
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	// Extract tags (#tag #!global #multi word tag)
	// Tags start at first # and go to end of line (after stripping other markers)
	let tags: string[] = [];
	const firstHashIndex = remaining.indexOf("#");
	if (firstHashIndex !== -1) {
		const tagsPart = remaining.slice(firstHashIndex);
		remaining = remaining.slice(0, firstHashIndex).trim();

		// Split by # and process each tag
		tags = Array.from(
			new Set(
				tagsPart
					.split("#")
					.map((t) => t.trim())
					.filter((t) => t.length > 0)
					.map((t) => (t.startsWith("!") ? t.slice(1).trim() : t)),
			),
		);
	}

	// Parse quantity: "4 Name" or "4x Name"
	let quantity = 1;
	const quantityMatch = remaining.match(/^(\d+)x?\s+/i);
	if (quantityMatch) {
		quantity = Math.max(1, Number.parseInt(quantityMatch[1], 10));
		remaining = remaining.slice(quantityMatch[0].length);
	}

	// Try XMage format first: [SET:123] or [SET] before name (most distinctive)
	// Use [^\]]+ for collector number to handle any characters (letters, ★, †, etc.)
	const xmageMatch = remaining.match(
		/^\[([A-Z0-9]{2,5})(?::([^\]]+))?\]\s+(.+)$/i,
	);
	if (xmageMatch) {
		return {
			quantity,
			name: xmageMatch[3].trim(),
			setCode: xmageMatch[1].toUpperCase(),
			collectorNumber: xmageMatch[2],
			tags: [...new Set(tags)],
			raw: line.trim(),
		};
	}

	// Try MTGGoldfish format: Name [SET] at end
	const goldfishMatch = remaining.match(/^(.+?)\s+\[([A-Z0-9]{2,5})\]\s*$/i);
	if (goldfishMatch) {
		return {
			quantity,
			name: goldfishMatch[1].trim(),
			setCode: goldfishMatch[2].toUpperCase(),
			collectorNumber: variantCollectorNumber,
			tags: [...new Set(tags)],
			raw: line.trim(),
		};
	}

	// Try Arena/Moxfield format: Name (SET) 123
	const arenaMatch = remaining.match(
		/^(.+?)\s+\(([A-Z0-9]{2,5})\)(?:\s+(\S+))?\s*$/i,
	);
	if (arenaMatch) {
		return {
			quantity,
			name: arenaMatch[1].trim(),
			setCode: arenaMatch[2].toUpperCase(),
			collectorNumber: arenaMatch[3],
			tags: [...new Set(tags)],
			raw: line.trim(),
		};
	}

	// No set code - just card name
	const name = remaining.trim();

	// Reject malformed lines with no actual card name
	// Also reject lines that are just quantity prefixes without actual card names
	// (e.g., "4", "4x", "100") - these are clearly malformed
	if (!name || /^\d+x?$/i.test(name)) {
		return null;
	}

	return {
		quantity,
		name,
		tags: [...new Set(tags)],
		raw: line.trim(),
	};
}

/**
 * Parse a complete deck list with sections.
 *
 * Auto-detects format if not specified. Uses format hint to resolve
 * ambiguous situations (e.g., blank line handling).
 */
export function parseDeck(text: string, options?: ParseOptions): ParsedDeck {
	const format = options?.format ?? detectFormat(text);
	const stripRedundantTypeTags = options?.stripRedundantTypeTags ?? true;
	const lines = text.split("\n");

	const deck: ParsedDeck = {
		commander: [],
		mainboard: [],
		sideboard: [],
		maybeboard: [],
		format,
	};

	let currentSection: DeckSection = "mainboard";
	let sawBlankLine = false;
	let hasExplicitSections = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Check for section marker (Arena headers, //Section, etc.)
		const sectionResult = parseSectionMarker(trimmed);
		if (sectionResult) {
			if (sectionResult.consumeLine) {
				currentSection = sectionResult.section;
				hasExplicitSections = true;
				sawBlankLine = false;
				continue;
			}
		}

		// Handle blank lines
		if (!trimmed) {
			sawBlankLine = true;
			continue;
		}

		// XMage NAME: metadata line
		if (trimmed.startsWith("NAME:")) {
			deck.name = trimmed.slice(5).trim();
			continue;
		}

		// Skip XMage LAYOUT lines
		if (trimmed.startsWith("LAYOUT ")) {
			continue;
		}

		// Arena/TappedOut "About" header and "Name ..." line
		if (/^About$/i.test(trimmed)) {
			continue;
		}
		if (/^Name\s+/i.test(trimmed)) {
			deck.name = trimmed.slice(5).trim();
			continue;
		}

		// Deckstats //NAME: comment
		if (trimmed.startsWith("//NAME:")) {
			deck.name = trimmed.slice(7).trim();
			continue;
		}

		// Check for inline section markers (SB:, [Sideboard], # !Commander)
		const inlineResult = extractInlineSection(trimmed, {
			format,
			stripRedundantTypeTags,
		});
		let effectiveSection: DeckSection = inlineResult.section ?? currentSection;
		const cardLine = inlineResult.cardLine;

		// Format-specific: blank line as sideboard separator
		// Only for MTGGoldfish/generic when no explicit sections exist
		if (
			sawBlankLine &&
			!hasExplicitSections &&
			!inlineResult.section &&
			currentSection === "mainboard" &&
			deck.mainboard.length > 0 &&
			(format === "mtggoldfish" || format === "generic")
		) {
			currentSection = "sideboard";
			effectiveSection = "sideboard";
		}
		sawBlankLine = false;

		// Parse the card line
		const parsed = parseCardLine(cardLine);
		if (parsed) {
			// Merge inline tags (from [Category]) with parsed tags (from #tag)
			if (inlineResult.tags) {
				parsed.tags = [...new Set([...inlineResult.tags, ...parsed.tags])];
			}
			deck[effectiveSection].push(parsed);
		}
	}

	return deck;
}
