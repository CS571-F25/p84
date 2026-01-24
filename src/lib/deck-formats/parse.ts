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

interface ParseCardLineOptions {
	/** Original raw line to store in result (before any marker stripping) */
	raw: string;
	/** Format hint for format-specific marker handling */
	format?: string;
}

/**
 * Strip format-specific markers from a card line.
 *
 * Removes visual markers that don't affect card identity:
 * - *F*, *A* (Moxfield foil/alter)
 * - (F) at end (MTGGoldfish foil)
 * - ^...^ (Archidekt color markers)
 * - <...> (MTGGoldfish variant markers)
 * - [...] (Archidekt category markers, unless XMage/MTGGoldfish format)
 */
export function stripMarkers(line: string, format?: string): string {
	let result = line;

	// Strip *F* (foil) and *A* (alter) markers (Moxfield style)
	result = result.replace(/\s*\*[FA]\*\s*/g, " ");

	// Strip (F) foil marker at end (MTGGoldfish style)
	result = result.replace(/\s*\(F\)\s*$/i, "");

	// Strip ^Tag,#color^ markers (Archidekt)
	result = result.replace(/\s*\^[^^]+\^\s*/g, " ");

	// Strip <variant> markers (MTGGoldfish)
	result = result.replace(/<[^>]+>/g, " ");

	// Strip [...] category markers (Archidekt) - but not for XMage/MTGGoldfish
	// which use brackets for set codes
	if (format !== "xmage" && format !== "mtggoldfish") {
		result = result.replace(/\s*\[[^\]]+\]/g, "");
	}

	// Normalize whitespace
	return result.replace(/\s+/g, " ").trim();
}

/**
 * Parse a single line of card text.
 *
 * Handles all format variations for quantity, set code, and collector number.
 * Tries patterns in order of specificity - most distinctive first.
 */
export function parseCardLine(
	line: string,
	options: ParseCardLineOptions,
): ParsedCardLine | null {
	const trimmedLine = line.trim();
	if (!trimmedLine) {
		return null;
	}

	// Extract <collector#> from MTGGoldfish variant markers before stripping
	let variantCollectorNumber: string | undefined;
	const collectorInVariant = trimmedLine.match(/<(\d+[a-z★†]?)>/i);
	if (collectorInVariant) {
		variantCollectorNumber = collectorInVariant[1];
	}

	// Strip format markers
	let remaining = stripMarkers(trimmedLine, options.format);

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
			raw: options.raw,
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
			raw: options.raw,
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
			raw: options.raw,
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
		raw: options.raw,
	};
}

// Known section names that shouldn't be treated as categories
const SECTION_NAMES = new Set([
	"commander",
	"companion",
	"mainboard",
	"main",
	"deck",
	"sideboard",
	"side",
	"maybeboard",
	"maybe",
]);

/**
 * Check if a line is a category header (not a section or card).
 * - Archidekt: Line that doesn't start with a digit (not a card line)
 * - Deckstats: //category comment that's not a known section
 */
function parseCategoryHeader(line: string, format: string): string | undefined {
	// Deckstats: //category (but not //Main, //Sideboard, etc.)
	if (format === "deckstats" && line.startsWith("//")) {
		const category = line.slice(2).trim();
		const lower = category.toLowerCase();
		if (category && !SECTION_NAMES.has(lower) && !lower.startsWith("name:")) {
			return category;
		}
	}

	// Archidekt: Line that doesn't start with a digit and isn't a section name
	if (format === "archidekt" && line && !/^\d/.test(line)) {
		const lower = line.toLowerCase();
		if (!SECTION_NAMES.has(lower)) {
			return line;
		}
	}

	return undefined;
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
	let currentCategory: string | undefined;
	let sawBlankLine = false;
	let hasExplicitSections = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Check for section marker (Arena headers, //Section, etc.)
		const sectionResult = parseSectionMarker(trimmed);
		if (sectionResult) {
			if (sectionResult.consumeLine) {
				currentSection = sectionResult.section;
				currentCategory = undefined; // Reset category on section change
				hasExplicitSections = true;
				sawBlankLine = false;
				continue;
			}
		}

		// Check for category header (Archidekt "Burn", Deckstats "//burn")
		const category = parseCategoryHeader(trimmed, format);
		if (category !== undefined) {
			currentCategory = category;
			// Category headers implicitly switch to mainboard (unless already in a specific section)
			if (currentSection === "commander") {
				currentSection = "mainboard";
			}
			continue;
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

		// If inline section changed, reset category
		if (inlineResult.section && inlineResult.section !== currentSection) {
			currentCategory = undefined;
		}

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
			currentCategory = undefined;
		}
		sawBlankLine = false;

		// Parse the card line (cardLine is cleaned by extractInlineSection, trimmed is original)
		const parsed = parseCardLine(cardLine, { raw: trimmed, format });
		if (parsed) {
			// Merge tags: category header + inline tags + parsed tags
			const allTags: string[] = [];
			if (currentCategory) {
				allTags.push(currentCategory);
			}
			if (inlineResult.tags) {
				allTags.push(...inlineResult.tags);
			}
			allTags.push(...parsed.tags);
			parsed.tags = [...new Set(allTags)];

			deck[effectiveSection].push(parsed);
		}
	}

	return deck;
}
