import { useQueries } from "@tanstack/react-query";
import { useDeferredValue, useMemo } from "react";
import type { Deck } from "@/lib/deck-types";
import { type ValidationResult, validateDeck } from "@/lib/deck-validation";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";

/**
 * Hook to validate a deck with automatic debouncing.
 *
 * Uses useDeferredValue to debounce rapid deck changes.
 * Returns null while loading card data.
 */
export function useDeckValidation(
	deck: Deck | undefined,
): ValidationResult | null {
	const deferredDeck = useDeferredValue(deck);

	// Get unique card IDs from deck
	const cardIds = useMemo(() => {
		if (!deferredDeck) return [];
		return [...new Set(deferredDeck.cards.map((c) => c.scryfallId))];
	}, [deferredDeck]);

	// Query all cards in the deck
	const queryResults = useQueries({
		queries: cardIds.map((id) => getCardByIdQueryOptions(id)),
	});

	const isLoading = queryResults.some((r) => r.isLoading);

	// biome-ignore lint/correctness/useExhaustiveDependencies: queryResults excluded intentionally - card data is immutable (staleTime: Infinity). cardIds included to re-validate when different cards are queried.
	return useMemo(() => {
		if (!deferredDeck || isLoading) return null;

		// Build maps fresh inside useMemo
		const cardMap = new Map<ScryfallId, Card>();
		const oracleMap = new Map<OracleId, Card>();

		for (const result of queryResults) {
			if (result.data) {
				cardMap.set(result.data.id, result.data);
				if (result.data.oracle_id) {
					oracleMap.set(result.data.oracle_id, result.data);
				}
			}
		}

		return validateDeck({
			deck: deferredDeck,
			cardLookup: (id) => cardMap.get(id),
			oracleLookup: (id) => oracleMap.get(id),
			// For now, just return the card we have - PDH may need async printings later
			getPrintings: (oracleId) => {
				const card = oracleMap.get(oracleId);
				return card ? [card] : [];
			},
		});
	}, [deferredDeck, isLoading, cardIds]);
}
