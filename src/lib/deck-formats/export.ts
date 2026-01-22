/**
 * Deck list exporters for various formats
 *
 * Handles exporting to:
 * - Moxfield: `4 Name (SET) 123 #tag`
 * - Arena: `4 Name (SET) 123`
 * - MTGO: `4 Name` with `Sideboard:` section
 * - XMage: `4 [SET:123] Name`
 * - TappedOut: `4x Name`
 * - MTGGoldfish: `4 Name [SET]`
 */

import type { DeckFormat, ParsedDeck } from "./types";

interface CardForExport {
	quantity: number;
	name: string;
	setCode?: string;
	collectorNumber?: string;
	tags?: string[];
}

/**
 * Format a single card line for export.
 */
export function formatCardLine(
	card: CardForExport,
	format: DeckFormat,
): string {
	const { quantity, name, setCode, collectorNumber, tags = [] } = card;

	switch (format) {
		case "xmage": {
			if (setCode && collectorNumber) {
				return `${quantity} [${setCode}:${collectorNumber}] ${name}`;
			}
			if (setCode) {
				return `${quantity} [${setCode}] ${name}`;
			}
			return `${quantity} ${name}`;
		}

		case "tappedout": {
			const parts = [`${quantity}x`, name];
			if (setCode) {
				parts.push(`(${setCode})`);
				if (collectorNumber) {
					parts.push(collectorNumber);
				}
			}
			return parts.join(" ");
		}

		case "archidekt": {
			const parts = [`${quantity}x`, name];
			if (setCode) {
				parts.push(`(${setCode.toLowerCase()})`);
				if (collectorNumber) {
					parts.push(collectorNumber);
				}
			}
			// Archidekt uses [Category] markers for tags
			if (tags.length > 0) {
				parts.push(`[${tags.join(",")}]`);
			}
			return parts.join(" ");
		}

		case "mtggoldfish": {
			const parts = [`${quantity}`, name];
			if (collectorNumber) {
				parts.push(`<${collectorNumber}>`);
			}
			if (setCode) {
				parts.push(`[${setCode}]`);
			}
			return parts.join(" ");
		}

		case "mtgo":
			return `${quantity} ${name}`;

		case "moxfield": {
			// Moxfield supports #tags
			const parts = [String(quantity), name];
			if (setCode) {
				parts.push(`(${setCode})`);
				if (collectorNumber) {
					parts.push(collectorNumber);
				}
			}
			if (tags.length > 0) {
				parts.push(...tags.map((t) => `#${t}`));
			}
			return parts.join(" ");
		}

		default: {
			// arena, deckstats, generic, unknown - no tag support
			const parts = [String(quantity), name];
			if (setCode) {
				parts.push(`(${setCode})`);
				if (collectorNumber) {
					parts.push(collectorNumber);
				}
			}
			return parts.join(" ");
		}
	}
}

/**
 * Format a complete deck for export.
 */
export function formatDeck(deck: ParsedDeck, format?: DeckFormat): string {
	const targetFormat = format ?? deck.format ?? "moxfield";

	switch (targetFormat) {
		case "arena":
			return formatArena(deck);
		case "mtgo":
			return formatMtgo(deck);
		case "xmage":
			return formatXmage(deck);
		case "tappedout":
			return formatTappedOut(deck);
		case "mtggoldfish":
			return formatMtggoldfish(deck);
		case "deckstats":
			return formatDeckstats(deck);
		case "archidekt":
			return formatArchidekt(deck);
		case "generic":
			return formatGeneric(deck);
		default:
			// moxfield and unknown formats
			return formatMoxfield(deck);
	}
}

/**
 * Moxfield format - no header for mainboard, SIDEBOARD: (uppercase with colon).
 */
export function formatMoxfield(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.commander.length > 0) {
		sections.push(...deck.commander.map((c) => formatCardLine(c, "moxfield")));
	}

	if (deck.mainboard.length > 0) {
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "moxfield")));
	}

	if (deck.sideboard.length > 0) {
		sections.push("");
		sections.push("SIDEBOARD:");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "moxfield")));
	}

	if (deck.maybeboard.length > 0) {
		sections.push("");
		sections.push("MAYBEBOARD:");
		sections.push(...deck.maybeboard.map((c) => formatCardLine(c, "moxfield")));
	}

	return sections.join("\n").trim();
}

/**
 * Generic format - just cards, blank line separator between main/side.
 */
function formatGeneric(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.mainboard.length > 0) {
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "generic")));
	}

	if (deck.sideboard.length > 0) {
		sections.push("");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "generic")));
	}

	return sections.join("\n").trim();
}

/**
 * Archidekt format with Nx quantity, lowercase set codes.
 * Uses [Category] markers for tags. Commander uses [Commander] inline tag.
 * Only Sideboard and Maybeboard have section headers (`# Sideboard`, `# Maybeboard`).
 */
function formatArchidekt(deck: ParsedDeck): string {
	const sections: string[] = [];

	// Commander uses [Commander] inline tag, no section header
	if (deck.commander.length > 0) {
		sections.push(
			...deck.commander.map((c) => {
				const line = formatCardLine(c, "archidekt");
				// Add [Commander] marker if not already tagged
				if (!c.tags?.length) {
					return `${line} [Commander]`;
				}
				// Append Commander to existing tags
				return `${line.slice(0, -1)},Commander]`;
			}),
		);
		sections.push("");
	}

	// Mainboard has no section header
	if (deck.mainboard.length > 0) {
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "archidekt")));
		sections.push("");
	}

	// Sideboard uses # Sideboard header
	if (deck.sideboard.length > 0) {
		sections.push("# Sideboard");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "archidekt")));
		sections.push("");
	}

	// Maybeboard uses # Maybeboard header
	if (deck.maybeboard.length > 0) {
		sections.push("# Maybeboard");
		sections.push(
			...deck.maybeboard.map((c) => formatCardLine(c, "archidekt")),
		);
	}

	return sections.join("\n").trim();
}

/**
 * Arena format with section headers, no tags.
 * Includes About/Name metadata if deck name is set.
 */
export function formatArena(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.name) {
		sections.push("About");
		sections.push(`Name ${deck.name}`);
		sections.push("");
	}

	if (deck.commander.length > 0) {
		sections.push("Commander");
		sections.push(...deck.commander.map((c) => formatCardLine(c, "arena")));
		sections.push("");
	}

	if (deck.mainboard.length > 0) {
		sections.push("Deck");
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "arena")));
		sections.push("");
	}

	if (deck.sideboard.length > 0) {
		sections.push("Sideboard");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "arena")));
		sections.push("");
	}

	return sections.join("\n").trim();
}

/**
 * MTGO format with Sideboard: section header, names only.
 */
export function formatMtgo(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.mainboard.length > 0) {
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "mtgo")));
		sections.push("");
	}

	if (deck.sideboard.length > 0) {
		sections.push("Sideboard:");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "mtgo")));
	}

	return sections.join("\n").trim();
}

/**
 * XMage format with [SET:num] prefix and NAME: metadata.
 */
function formatXmage(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.name) {
		sections.push(`NAME:${deck.name}`);
	}

	if (deck.mainboard.length > 0) {
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "xmage")));
	}

	if (deck.sideboard.length > 0) {
		sections.push(
			...deck.sideboard.map((c) => `SB: ${formatCardLine(c, "xmage")}`),
		);
	}

	return sections.join("\n").trim();
}

/**
 * TappedOut format with Nx quantity.
 * Includes About/Name/Deck headers when deck name is present.
 */
function formatTappedOut(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.name) {
		sections.push("About");
		sections.push(`Name ${deck.name}`);
		sections.push("");
	}

	if (deck.mainboard.length > 0) {
		if (deck.name) {
			sections.push("Deck");
		}
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "tappedout")));
		sections.push("");
	}

	if (deck.sideboard.length > 0) {
		sections.push("//Sideboard");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "tappedout")));
	}

	return sections.join("\n").trim();
}

/**
 * MTGGoldfish format with [SET] suffix.
 */
function formatMtggoldfish(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.mainboard.length > 0) {
		sections.push(
			...deck.mainboard.map((c) => formatCardLine(c, "mtggoldfish")),
		);
		sections.push("");
	}

	if (deck.sideboard.length > 0) {
		sections.push(
			...deck.sideboard.map((c) => formatCardLine(c, "mtggoldfish")),
		);
	}

	return sections.join("\n").trim();
}

/**
 * Deckstats format with //Section comments and //NAME: metadata.
 * Commander goes in mainboard with `# !Commander` marker (no separate section).
 */
function formatDeckstats(deck: ParsedDeck): string {
	const sections: string[] = [];

	if (deck.name) {
		sections.push(`//NAME: ${deck.name}`);
		sections.push("");
	}

	// Mainboard includes commander cards (with # !Commander marker)
	const hasMainContent = deck.commander.length > 0 || deck.mainboard.length > 0;
	if (hasMainContent) {
		sections.push("//Main");
		// Commander cards first with marker
		sections.push(
			...deck.commander.map(
				(c) => `${formatCardLine(c, "deckstats")} # !Commander`,
			),
		);
		sections.push(...deck.mainboard.map((c) => formatCardLine(c, "deckstats")));
		sections.push("");
	}

	if (deck.sideboard.length > 0) {
		sections.push("//Sideboard");
		sections.push(...deck.sideboard.map((c) => formatCardLine(c, "deckstats")));
	}

	return sections.join("\n").trim();
}
