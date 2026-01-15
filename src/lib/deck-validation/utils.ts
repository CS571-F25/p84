/**
 * Internal utilities for deck validation.
 * These handle DFC/MDFC cards properly by checking all faces.
 */

import type { Card } from "@/lib/scryfall-types";

/**
 * Get combined oracle text from card, including all faces for DFCs/MDFCs.
 */
export function getOracleText(card: Card): string {
	if (card.oracle_text) {
		return card.oracle_text;
	}

	if (card.card_faces) {
		return card.card_faces.map((face) => face.oracle_text ?? "").join("\n");
	}

	return "";
}

/**
 * Get type line from card, including all faces for DFCs/MDFCs.
 */
export function getTypeLine(card: Card): string {
	if (card.type_line) {
		return card.type_line;
	}

	if (card.card_faces) {
		return card.card_faces.map((face) => face.type_line ?? "").join(" // ");
	}

	return "";
}
