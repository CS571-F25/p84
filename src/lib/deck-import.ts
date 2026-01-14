/**
 * Deck import/export utilities
 *
 * Supports Moxfield-style format:
 * <quantity> <card name> (<SET>) <collector#> #<tag1> #<tag2>
 *
 * Examples:
 * 1 Lightning Bolt (2XM) 141 #removal
 * 4 Llanowar Elves #dorks #ramp
 * 1 Sol Ring
 */

import type { Card, OracleId, ScryfallId } from "./scryfall-types";

export interface ParsedCardLine {
	quantity: number;
	name: string;
	setCode?: string;
	collectorNumber?: string;
	tags: string[];
	raw: string;
}

export interface ResolvedCard {
	scryfallId: ScryfallId;
	quantity: number;
	tags: string[];
}

export interface ImportError {
	line: number;
	raw: string;
	error: string;
}

export interface ImportResult {
	resolved: ResolvedCard[];
	errors: ImportError[];
}

/**
 * Parse a single line of card text
 *
 * Format: <quantity> <card name> (<SET>) <collector#> #<tag1> #<tag2>
 * Set code, collector number, and tags are all optional
 */
export function parseCardLine(line: string): ParsedCardLine | null {
	const trimmed = line.trim();
	if (!trimmed) {
		return null;
	}

	// Extract tags first - find first # and split everything after it
	const firstHashIndex = trimmed.indexOf("#");
	let tags: string[] = [];
	let remaining = trimmed;

	if (firstHashIndex !== -1) {
		const tagsPart = trimmed.slice(firstHashIndex);
		remaining = trimmed.slice(0, firstHashIndex).trim();

		// Split by # and process each tag (dedupe to handle #foo #foo)
		tags = Array.from(
			new Set(
				tagsPart
					.split("#")
					.map((t) => t.trim())
					.filter((t) => t.length > 0)
					.map((t) => {
						// Remove optional ! prefix (Moxfield uses #! for "global" tags)
						return t.startsWith("!") ? t.slice(1).trim() : t;
					}),
			),
		);
	}

	// Parse quantity (default to 1 if not present or invalid)
	const quantityMatch = remaining.match(/^(\d+)\s+/);
	let quantity = 1;
	if (quantityMatch) {
		quantity = Math.max(1, Number.parseInt(quantityMatch[1], 10));
		remaining = remaining.slice(quantityMatch[0].length);
	}

	// Try to extract set code and collector number: "Name (SET) 123" or "Name (SET)"
	const setMatch = remaining.match(/^(.+?)\s+\(([A-Z0-9]+)\)(?:\s+(\S+))?$/i);
	if (setMatch) {
		return {
			quantity,
			name: setMatch[1].trim(),
			setCode: setMatch[2].toUpperCase(),
			collectorNumber: setMatch[3],
			tags,
			raw: trimmed,
		};
	}

	// No set code - just card name
	return {
		quantity,
		name: remaining.trim(),
		tags,
		raw: trimmed,
	};
}

/**
 * Parse multiple lines of card text
 */
export function parseCardList(text: string): ParsedCardLine[] {
	return text
		.split("\n")
		.map(parseCardLine)
		.filter((p): p is ParsedCardLine => p !== null);
}

/**
 * Format a card for export to text format
 */
export function formatCardLine(
	card: { quantity: number; scryfallId: ScryfallId; tags?: string[] },
	cardData: Card,
): string {
	const parts: string[] = [String(card.quantity), cardData.name];

	if (cardData.set && cardData.collector_number) {
		parts.push(`(${cardData.set.toUpperCase()})`, cardData.collector_number);
	} else if (cardData.set) {
		parts.push(`(${cardData.set.toUpperCase()})`);
	}

	const tags = card.tags ?? [];
	if (tags.length > 0) {
		parts.push(...tags.map((t) => `#${t}`));
	}

	return parts.join(" ");
}

/**
 * Resolve parsed cards to Scryfall IDs
 *
 * Uses card data provider to find matching cards by name,
 * then filters by set/collector number if provided.
 */
export async function resolveCards(
	parsed: ParsedCardLine[],
	lookupByName: (name: string) => Promise<Card[]>,
	getPrintings: (oracleId: OracleId) => Promise<ScryfallId[]>,
	getCardById: (id: ScryfallId) => Promise<Card | undefined>,
): Promise<ImportResult> {
	const resolved: ResolvedCard[] = [];
	const errors: ImportError[] = [];

	for (let i = 0; i < parsed.length; i++) {
		const line = parsed[i];
		const lineNum = i + 1;

		try {
			// Search by exact name first
			const matches = await lookupByName(line.name);

			if (matches.length === 0) {
				errors.push({
					line: lineNum,
					raw: line.raw,
					error: `Card not found: "${line.name}"`,
				});
				continue;
			}

			// Find best match by name (case-insensitive exact match preferred)
			const exactMatch = matches.find(
				(m) => m.name.toLowerCase() === line.name.toLowerCase(),
			);
			const baseCard = exactMatch ?? matches[0];

			// If set/collector number specified, find that exact printing
			let finalId = baseCard.id;

			if (line.setCode) {
				const printings = await getPrintings(baseCard.oracle_id);
				let found = false;

				for (const printingId of printings) {
					const printing = await getCardById(printingId);
					if (!printing) continue;

					const setMatches =
						printing.set?.toUpperCase() === line.setCode.toUpperCase();
					const collectorMatches =
						!line.collectorNumber ||
						printing.collector_number === line.collectorNumber;

					if (setMatches && collectorMatches) {
						finalId = printingId;
						found = true;
						break;
					}
				}

				if (!found && line.collectorNumber) {
					// Specific printing not found - warn but use canonical
					errors.push({
						line: lineNum,
						raw: line.raw,
						error: `Printing (${line.setCode}) ${line.collectorNumber} not found, using default printing`,
					});
				}
			}

			resolved.push({
				scryfallId: finalId,
				quantity: line.quantity,
				tags: line.tags,
			});
		} catch (err) {
			errors.push({
				line: lineNum,
				raw: line.raw,
				error: err instanceof Error ? err.message : "Unknown error",
			});
		}
	}

	return { resolved, errors };
}
