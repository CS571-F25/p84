import type { Card } from "@/lib/scryfall-types";
import { getOracleText, getTypeLine } from "./utils";

/**
 * Copy exception types for cards that bypass normal deck construction limits
 */
export type CopyException =
	| { type: "unlimited" }
	| { type: "limited"; max: number };

/**
 * Pattern for "a deck can have any number of cards named X"
 */
const UNLIMITED_PATTERN = /a deck can have any number of cards named/i;

/**
 * Pattern for "a deck can have up to X cards named Y"
 */
const LIMITED_PATTERN = /a deck can have up to (\w+) cards named/i;

/**
 * Word to number mapping for limited patterns
 */
const WORD_TO_NUMBER: Record<string, number> = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
};

/**
 * Detect copy limit exception from oracle text.
 * Returns undefined if no exception found.
 */
export function detectCopyException(card: Card): CopyException | undefined {
	const text = getOracleText(card);

	if (UNLIMITED_PATTERN.test(text)) {
		return { type: "unlimited" };
	}

	const limitedMatch = text.match(LIMITED_PATTERN);
	if (limitedMatch) {
		const word = limitedMatch[1].toLowerCase();
		const num = WORD_TO_NUMBER[word] ?? parseInt(word, 10);
		if (!Number.isNaN(num)) {
			return { type: "limited", max: num };
		}
	}

	return undefined;
}

/**
 * Check if card is a basic land (unlimited copies always allowed)
 */
export function isBasicLand(card: Card): boolean {
	const typeLine = getTypeLine(card);
	return typeLine.includes("Basic") && typeLine.includes("Land");
}

/**
 * Get the maximum allowed copies for a card given format rules.
 * @param card The card to check
 * @param defaultLimit The default limit (1 for singleton, 4 for playset)
 * @returns The maximum copies allowed (Infinity for unlimited)
 */
export function getCopyLimit(card: Card, defaultLimit: number): number {
	if (isBasicLand(card)) {
		return Infinity;
	}

	const exception = detectCopyException(card);
	if (exception?.type === "unlimited") {
		return Infinity;
	}
	if (exception?.type === "limited") {
		return exception.max;
	}

	return defaultLimit;
}
