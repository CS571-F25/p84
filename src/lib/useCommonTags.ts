import { useEffect, useState } from "react";
import type { Deck } from "./deck-types";

export interface TagCount {
	tagName: string;
	count: number;
}

/**
 * Compare two Sets for equality
 */
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

/**
 * Calculate the top N most common tags in a deck
 */
function calculateTopNTags(deck: Deck, maxTags: number): TagCount[] {
	const tagCounts = new Map<string, number>();

	// Count all tags across all cards
	for (const card of deck.cards) {
		if (card.tags) {
			for (const tag of card.tags) {
				tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		}
	}

	// Convert to array and sort by count (descending)
	const sortedTags = Array.from(tagCounts.entries())
		.map(([tagName, count]) => ({ tagName, count }))
		.sort((a, b) => b.count - a.count);

	// Return top N tags
	return sortedTags.slice(0, maxTags);
}

/**
 * Hook to get the top N most common tags in a deck with stable results
 *
 * Tags are only recalculated when the UNIQUE SET of tags changes (tag added/removed from deck entirely),
 * not on every deck card change. This prevents the tag list from flickering or reordering unnecessarily.
 */
export function useCommonTags(deck: Deck, maxTags: number): TagCount[] {
	const [stableCommonTags, setStableCommonTags] = useState<TagCount[]>([]);
	const [lastTagSet, setLastTagSet] = useState<Set<string>>(new Set());

	useEffect(() => {
		// Extract all unique tags from the deck
		const currentTagSet = new Set<string>(
			deck.cards.flatMap((card) => card.tags ?? []),
		);

		// Only recalculate if the set of unique tags changed
		if (!setsEqual(currentTagSet, lastTagSet)) {
			const newCommonTags = calculateTopNTags(deck, maxTags);
			setStableCommonTags(newCommonTags);
			setLastTagSet(currentTagSet);
		}
	}, [deck, maxTags, lastTagSet]);

	return stableCommonTags;
}
