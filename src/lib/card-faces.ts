/**
 * Multi-faced card helpers
 *
 * Provides utilities for working with transform, MDFC, split, flip,
 * adventure, and meld cards.
 */

import type { Card, CardFace, Layout } from "./scryfall-types";

export type FlipBehavior = "transform" | "rotate90" | "rotate180" | "none";

/**
 * Layouts where both faces can be cast independently from hand.
 * Stats should count BOTH faces for these cards.
 */
const MODAL_LAYOUTS: Layout[] = ["modal_dfc", "split", "adventure"];

/**
 * Layouts where the card transforms/flips on the battlefield.
 * Only the front face can be cast - stats should count only front.
 */
const TRANSFORM_IN_PLAY_LAYOUTS: Layout[] = ["transform", "flip", "meld"];

/**
 * Layouts that have a separate back face image.
 */
const HAS_BACK_IMAGE_LAYOUTS: Layout[] = [
	"transform",
	"modal_dfc",
	"meld",
	"reversible_card",
	"double_faced_token",
];

/**
 * Parse mana value from a mana cost string.
 *
 * This is a standalone function so it can be tested independently
 * and proptested against cards with known cmc values.
 *
 * Examples:
 *   "{2}{U}" => 3
 *   "{X}{G}{G}" => 2 (X counts as 0)
 *   "{W/U}{W/U}" => 2 (hybrid costs 1 each)
 *   "{5}{B}{R}" => 7
 */
export function parseManaValue(manaCost: string | undefined): number {
	if (!manaCost) return 0;

	let mv = 0;
	const symbols = manaCost.matchAll(/\{([^}]+)\}/g);

	for (const match of symbols) {
		const symbol = match[1];

		// Generic mana (numbers like {2}, {10})
		const numericMatch = symbol.match(/^(\d+)$/);
		if (numericMatch) {
			mv += Number.parseInt(numericMatch[1], 10);
			continue;
		}

		// X, Y, Z cost nothing
		if (/^[XYZ]$/.test(symbol)) {
			continue;
		}

		// Half mana (HW, HR, etc.) - costs 0.5
		if (symbol.startsWith("H")) {
			mv += 0.5;
			continue;
		}

		// Single color (W, U, B, R, G) or colorless (C)
		if (/^[WUBRGC]$/.test(symbol)) {
			mv += 1;
			continue;
		}

		// Hybrid with generic (2/W, 2/U, etc.) - costs 2 (the generic portion)
		const twoHybridMatch = symbol.match(/^(\d+)\/[WUBRGC]$/);
		if (twoHybridMatch) {
			mv += Number.parseInt(twoHybridMatch[1], 10);
			continue;
		}

		// Regular hybrid mana (W/U, W/P, etc.) - costs 1
		if (symbol.includes("/")) {
			mv += 1;
			continue;
		}

		// Snow mana (S) - costs 1
		if (symbol === "S") {
			mv += 1;
		}
	}

	return mv;
}

/**
 * Create a synthetic CardFace from top-level Card properties.
 * Used for single-faced cards that don't have card_faces array.
 */
function cardToFace(card: Card): CardFace {
	return {
		object: "card_face",
		name: card.name,
		mana_cost: card.mana_cost,
		type_line: card.type_line,
		oracle_text: card.oracle_text,
		power: card.power,
		toughness: card.toughness,
		loyalty: card.loyalty,
		defense: card.defense,
		colors: card.colors,
	};
}

/**
 * Check if a card has multiple faces.
 */
export function isMultiFaced(card: Card): boolean {
	return (card.card_faces?.length ?? 0) > 1;
}

/**
 * Get the primary (front) face of a card.
 * For display purposes - what you see in deck lists.
 */
export function getPrimaryFace(card: Card): CardFace {
	if (card.card_faces && card.card_faces.length > 0) {
		return card.card_faces[0];
	}
	return cardToFace(card);
}

/**
 * Get all faces of a card for display purposes.
 * Returns all faces regardless of castability.
 */
export function getAllFaces(card: Card): CardFace[] {
	if (card.card_faces && card.card_faces.length > 0) {
		return card.card_faces;
	}
	return [cardToFace(card)];
}

/**
 * Get all independently castable faces of a card.
 *
 * For stats calculations - each returned face should be counted.
 *
 * - MDFC/split/adventure: Returns ALL faces (either can be cast from hand)
 * - Transform/flip/meld: Returns ONLY front face (back transforms in play)
 * - Normal cards: Returns single synthetic face
 */
export function getCastableFaces(card: Card): CardFace[] {
	const layout = card.layout;

	// Modal layouts: both faces are independently castable
	if (layout && MODAL_LAYOUTS.includes(layout)) {
		if (card.card_faces && card.card_faces.length > 0) {
			return card.card_faces;
		}
	}

	// Transform-in-play layouts: only front face is castable
	if (layout && TRANSFORM_IN_PLAY_LAYOUTS.includes(layout)) {
		if (card.card_faces && card.card_faces.length > 0) {
			return [card.card_faces[0]];
		}
	}

	// Normal cards or unknown layouts: use top-level card properties
	if (card.card_faces && card.card_faces.length > 0) {
		return [card.card_faces[0]];
	}
	return [cardToFace(card)];
}

/**
 * Get the flip/rotate behavior for animation purposes.
 */
export function getFlipBehavior(layout: Layout | undefined): FlipBehavior {
	if (!layout) return "none";

	if (HAS_BACK_IMAGE_LAYOUTS.includes(layout)) {
		return "transform";
	}

	if (layout === "split") {
		return "rotate90";
	}

	if (layout === "flip") {
		return "rotate180";
	}

	return "none";
}

/**
 * Check if a card can be flipped/rotated in the UI.
 */
export function canFlip(card: Card): boolean {
	return getFlipBehavior(card.layout) !== "none";
}

/**
 * Check if a card has a separate back face image.
 */
export function hasBackImage(layout: Layout | undefined): boolean {
	if (!layout) return false;
	return HAS_BACK_IMAGE_LAYOUTS.includes(layout);
}

/**
 * Get the mana value for a face.
 *
 * For the primary face, prefer card.cmc if available (it's authoritative).
 * For other faces, parse from mana_cost.
 */
export function getFaceManaValue(
	face: CardFace,
	card: Card,
	faceIndex: number,
): number {
	// For the primary face, use card.cmc if available
	if (faceIndex === 0 && card.cmc !== undefined) {
		return card.cmc;
	}
	return parseManaValue(face.mana_cost);
}
