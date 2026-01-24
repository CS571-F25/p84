/**
 * Match raw text lines to parsed cards, handling duplicates correctly.
 *
 * When the same card text appears multiple times (e.g., in mainboard and sideboard),
 * this matches them in order of appearance, ensuring each parsed card is claimed once.
 */

import type { DeckSection, ParsedCardLine, ParsedDeck } from "./types";

export interface MatchedLine {
	/** Unique key for React (stable unless line content changes) */
	key: string;
	/** The trimmed line text */
	trimmed: string;
	/** The parsed card for this line, or undefined if it's a header/metadata */
	parsed?: ParsedCardLine;
	/** The section this card belongs to */
	section?: DeckSection;
}

/**
 * Match raw text lines to their parsed cards and sections.
 *
 * Handles duplicate lines correctly by claiming parsed cards in order.
 * Each line gets a stable key (content-based, not index-based) for React.
 *
 * @param lines - Raw text lines from the textarea
 * @param parsedDeck - The parsed deck with cards organized by section
 * @returns Array parallel to `lines` with matched card info
 */
export function matchLinesToParsedCards(
	lines: string[],
	parsedDeck: ParsedDeck,
): MatchedLine[] {
	// Build ordered array of all parsed cards with their sections
	const cardsBySection: { section: DeckSection; card: ParsedCardLine }[] = [];
	for (const card of parsedDeck.commander)
		cardsBySection.push({ section: "commander", card });
	for (const card of parsedDeck.mainboard)
		cardsBySection.push({ section: "mainboard", card });
	for (const card of parsedDeck.sideboard)
		cardsBySection.push({ section: "sideboard", card });
	for (const card of parsedDeck.maybeboard)
		cardsBySection.push({ section: "maybeboard", card });

	// Track which parsed cards have been claimed
	const claimed = new Set<number>();
	// Track occurrence counts for key generation
	const counts = new Map<string, number>();

	return lines.map((line) => {
		const trimmed = line.trim();
		const occurrence = counts.get(trimmed) ?? 0;
		counts.set(trimmed, occurrence + 1);
		const key = `${trimmed}:${occurrence}`;

		if (!trimmed) {
			return { key, trimmed };
		}

		// Find the first unclaimed parsed card with matching raw text
		for (let j = 0; j < cardsBySection.length; j++) {
			if (!claimed.has(j) && cardsBySection[j].card.raw === trimmed) {
				claimed.add(j);
				return {
					key,
					trimmed,
					parsed: cardsBySection[j].card,
					section: cardsBySection[j].section,
				};
			}
		}

		// No match found - this line is a section header or metadata
		return { key, trimmed };
	});
}
