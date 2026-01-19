/**
 * Format detection for deck lists
 *
 * Detection order matters - check most distinctive patterns first.
 */

import type { DeckFormat } from "./types";

/**
 * Detect the format of a deck list from its text content.
 *
 * Detection priority (most specific first):
 * 1. XMage: [SET:num] before card name
 * 2. Archidekt: inline [Sideboard]/[Commander] markers or ^Tag^ colors
 * 3. MTGGoldfish: [SET] after card name (not before)
 * 4. Deckstats: //Section comments or # !Commander
 * 5. TappedOut: Nx quantity pattern (e.g., 4x Card)
 * 6. Moxfield: *F* foil markers or #tags (without inline section markers)
 * 7. Arena: Deck/Sideboard/Commander section headers on own line
 * 8. Generic: fallback for plain card lists
 */
export function detectFormat(text: string): DeckFormat {
	if (!text.trim()) {
		return "generic";
	}

	const lines = text.split("\n");

	// XMage: [SET:num] pattern BEFORE card name (most distinctive)
	// e.g., "4 [2XM:141] Lightning Bolt"
	if (lines.some((l) => /^\d+\s+\[\w{2,5}:\d+\]/.test(l.trim()))) {
		return "xmage";
	}

	// Also check for XMage SB: lines with [SET:num]
	if (lines.some((l) => /^SB:\s*\d+\s+\[\w{2,5}:\d+\]/.test(l.trim()))) {
		return "xmage";
	}

	// Archidekt: inline section markers [Sideboard], [Commander{...}], [Maybeboard{...}]
	// or ^Tag,#color^ markers
	if (
		lines.some(
			(l) =>
				/\[(?:Sideboard|Commander|Maybeboard)/.test(l) || /\^[^^]+\^/.test(l),
		)
	) {
		return "archidekt";
	}

	// MTGGoldfish exact versions: [SET] AFTER card name
	// e.g., "4 Lightning Bolt [2XM]" or "4 Card <extended> [SET]"
	// Must not match XMage pattern (which has [SET:num] BEFORE name)
	if (
		lines.some((l) => {
			const trimmed = l.trim();
			// Match: ends with [SET] (2-5 chars, uppercase)
			// But not XMage pattern (which starts with quantity then [SET:num])
			return (
				/\s\[[A-Z0-9]{2,5}\]\s*$/.test(trimmed) &&
				!/^\d+\s+\[\w+:\d+\]/.test(trimmed)
			);
		})
	) {
		return "mtggoldfish";
	}

	// Deckstats: //Section comments or # !Commander marker
	if (lines.some((l) => /^\/\/\w+/.test(l.trim()) || /# !Commander/.test(l))) {
		return "deckstats";
	}

	// TappedOut: Nx quantity pattern (e.g., "4x Card Name")
	if (lines.some((l) => /^\d+x\s+/i.test(l.trim()))) {
		return "tappedout";
	}

	// Moxfield: *F* foil markers or #tags
	// Check for *F* or *A* markers, or #tag patterns
	// (but not if Archidekt markers already matched)
	if (lines.some((l) => /\*[FA]\*/.test(l) || /#\w+/.test(l))) {
		return "moxfield";
	}

	// Arena: section headers on their own line
	// "Deck", "Sideboard", "Commander", "Companion"
	if (
		lines.some((l) => /^(Deck|Sideboard|Commander|Companion)$/i.test(l.trim()))
	) {
		return "arena";
	}

	// Generic: plain card list, no distinctive markers
	return "generic";
}
