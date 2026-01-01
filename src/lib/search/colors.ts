/**
 * Color set comparison utilities for Scryfall search
 *
 * Scryfall uses set theory for color comparisons:
 * - : or >= means "superset of" (card has at least these colors)
 * - = means "exactly these colors"
 * - <= means "subset of" (card has at most these colors) - key for commander deckbuilding
 * - < means "strict subset"
 * - > means "strict superset"
 */

import type { ComparisonOp } from "./types";

/**
 * Valid color characters
 */
export const COLOR_CHARS = new Set(["W", "U", "B", "R", "G", "C"]);

/**
 * Check if set A is a subset of set B (A ⊆ B)
 * Every element in A is also in B
 */
export function isSubset<T>(a: Set<T>, b: Set<T>): boolean {
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

/**
 * Check if set A is a superset of set B (A ⊇ B)
 * Every element in B is also in A
 */
export function isSuperset<T>(a: Set<T>, b: Set<T>): boolean {
	return isSubset(b, a);
}

/**
 * Check if two sets are equal
 */
export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size === b.size && isSubset(a, b);
}

/**
 * Check if set A is a strict subset of set B (A ⊂ B)
 * A is subset of B and A ≠ B
 */
export function isStrictSubset<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size < b.size && isSubset(a, b);
}

/**
 * Check if set A is a strict superset of set B (A ⊃ B)
 * A is superset of B and A ≠ B
 */
export function isStrictSuperset<T>(a: Set<T>, b: Set<T>): boolean {
	return a.size > b.size && isSuperset(a, b);
}

/**
 * Compare card colors against search colors using the given operator
 *
 * @param cardColors - The card's colors (from card.colors or card.color_identity)
 * @param searchColors - The colors from the search query
 * @param operator - The comparison operator
 * @returns Whether the card matches the search
 */
export function compareColors(
	cardColors: string[] | undefined,
	searchColors: Set<string>,
	operator: ComparisonOp,
): boolean {
	const cardSet = new Set(cardColors ?? []);

	switch (operator) {
		case ":":
		case ">=":
			// Card has at least these colors (superset)
			return isSuperset(cardSet, searchColors);

		case "=":
			// Card has exactly these colors
			return setsEqual(cardSet, searchColors);

		case "!=":
			// Card doesn't have exactly these colors
			return !setsEqual(cardSet, searchColors);

		case "<=":
			// Card has at most these colors (subset) - commander deckbuilding
			return isSubset(cardSet, searchColors);

		case "<":
			// Card has strictly fewer colors (strict subset)
			return isStrictSubset(cardSet, searchColors);

		case ">":
			// Card has strictly more colors (strict superset)
			return isStrictSuperset(cardSet, searchColors);
	}
}

/**
 * Parse a color string into a set of color characters
 *
 * Supports:
 * - Single letters: W, U, B, R, G, C
 * - Combined: wubrg, bg, ur
 * - Full names: white, blue, black, red, green, colorless
 * - Guild/shard names could be added here
 */
export function parseColors(input: string): Set<string> {
	const colors = new Set<string>();
	const upper = input.toUpperCase();

	// Single character parsing
	for (const char of upper) {
		if (COLOR_CHARS.has(char)) {
			colors.add(char);
		}
	}

	// Full name parsing
	const lower = input.toLowerCase();
	if (lower.includes("white")) colors.add("W");
	if (lower.includes("blue")) colors.add("U");
	if (lower.includes("black")) colors.add("B");
	if (lower.includes("red")) colors.add("R");
	if (lower.includes("green")) colors.add("G");
	if (lower.includes("colorless")) colors.add("C");

	return colors;
}
