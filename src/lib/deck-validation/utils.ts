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

/**
 * Get the front face type line only.
 * For DFCs/MDFCs, commander legality is determined by the front face.
 * A Saga that transforms into a creature (e.g., Behold the Unspeakable)
 * is NOT a legal commander because the front face is a Saga.
 */
export function getFrontFaceTypeLine(card: Card): string {
	if (card.card_faces && card.card_faces.length > 0) {
		return card.card_faces[0].type_line ?? "";
	}
	return card.type_line ?? "";
}
