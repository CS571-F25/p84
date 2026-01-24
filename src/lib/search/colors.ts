/**
 * Color set comparison utilities for Scryfall search
 *
 * Scryfall uses set theory for color comparisons:
 * - For color (c:), : means "superset of" (card has at least these colors)
 * - For identity (id:/ci:), : means "subset of" (card fits in this commander's deck)
 * - >= means "superset of" (card has at least these colors)
 * - = means "exactly these colors"
 * - <= means "subset of" (card has at most these colors)
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
 * Special handling for colorless (C) in colors/color_identity:
 * - "C" in search means "colorless" = empty color set
 * - Colorless cards have [] for colors/color_identity, not ["C"]
 *
 * For produced_mana, C is literal - set literalColorless=true
 */
export function compareColors(
	cardColors: string[] | undefined,
	searchColors: Set<string>,
	operator: ComparisonOp,
	literalColorless = false,
): boolean {
	const cardSet = new Set(cardColors ?? []);

	// For colors/color_identity, colorless means empty array
	// For produced_mana, C is literal in the array
	if (!literalColorless) {
		const isColorlessSearch = searchColors.size === 1 && searchColors.has("C");
		const cardIsColorless = cardSet.size === 0;

		if (isColorlessSearch) {
			switch (operator) {
				case ":":
				case ">=":
				case "=":
					return cardIsColorless;
				case "!=":
					return !cardIsColorless;
				case "<=":
					return cardIsColorless;
				case "<":
					return false;
				case ">":
					return !cardIsColorless;
			}
		}

		// Remove C from search - it doesn't appear in colors/color_identity
		const normalizedSearch = new Set(searchColors);
		normalizedSearch.delete("C");
		searchColors = normalizedSearch;
	}

	switch (operator) {
		case ":":
		case ">=":
			return isSuperset(cardSet, searchColors);

		case "=":
			return setsEqual(cardSet, searchColors);

		case "!=":
			return !setsEqual(cardSet, searchColors);

		case "<=":
			return isSubset(cardSet, searchColors);

		case "<":
			return isStrictSubset(cardSet, searchColors);

		case ">":
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
	const lower = input.toLowerCase();

	// Check full names first (before single char parsing)
	if (lower.includes("white")) colors.add("W");
	if (lower.includes("blue")) colors.add("U");
	if (lower.includes("black")) colors.add("B");
	if (lower.includes("red")) colors.add("R");
	if (lower.includes("green")) colors.add("G");
	if (lower.includes("colorless")) colors.add("C");

	// If we found full names, don't do character parsing
	// (avoids "blue" matching B from the letter)
	if (colors.size > 0) {
		return colors;
	}

	// Single character parsing for short color codes like "wubrg" or "bg"
	const upper = input.toUpperCase();
	for (const char of upper) {
		if (COLOR_CHARS.has(char)) {
			colors.add(char);
		}
	}

	return colors;
}
