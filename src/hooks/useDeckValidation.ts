import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Deck } from "@/lib/deck-types";
import { type ValidationResult, validateDeck } from "@/lib/deck-validation";
import {
	getCardByIdQueryOptions,
	getCardPrintingsQueryOptions,
} from "@/lib/queries";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { useDebounce } from "@/lib/useDebounce";

const DEBOUNCE_MS = 5000;

/**
 * Hook to validate a deck with debouncing.
 *
 * - Skips first render entirely (no queries, no validation)
 * - Debounces deck changes by 5 seconds before running validation
 * - Returns null while debouncing or loading card data
 */
export function useDeckValidation(
	deck: Deck | undefined,
): ValidationResult | null {
	// skipInitial: don't run validation on first render, wait for debounce
	const { value: debouncedDeck } = useDebounce(deck, DEBOUNCE_MS, {
		skipInitial: true,
	});
	const isPDH = debouncedDeck?.format === "paupercommander";

	// Get unique card IDs from deck
	const cardIds = useMemo(() => {
		if (!debouncedDeck) return [];
		return [...new Set(debouncedDeck.cards.map((c) => c.scryfallId))];
	}, [debouncedDeck]);

	// Get commander oracle IDs for PDH printings lookup
	const commanderOracleIds = useMemo(() => {
		if (!debouncedDeck || !isPDH) return [];
		return debouncedDeck.cards
			.filter((c) => c.section === "commander")
			.map((c) => c.oracleId);
	}, [debouncedDeck, isPDH]);

	// Query all cards in the deck
	const queryResults = useQueries({
		queries: cardIds.map((id) => getCardByIdQueryOptions(id)),
	});

	// For PDH: query printing IDs for commanders (stage 1)
	const printingIdsResults = useQueries({
		queries: commanderOracleIds.map((id) => getCardPrintingsQueryOptions(id)),
	});

	// Flatten all printing IDs we need to fetch
	const allPrintingIds = useMemo(() => {
		if (!isPDH) return [];
		const ids: ScryfallId[] = [];
		for (const result of printingIdsResults) {
			if (result.data) {
				ids.push(...result.data);
			}
		}
		return ids;
	}, [isPDH, printingIdsResults]);

	// For PDH: query card data for all printings (stage 2)
	const printingCardsResults = useQueries({
		queries: allPrintingIds.map((id) => getCardByIdQueryOptions(id)),
	});

	const isLoading =
		queryResults.some((r) => r.isLoading) ||
		(isPDH &&
			(printingIdsResults.some((r) => r.isLoading) ||
				printingCardsResults.some((r) => r.isLoading)));

	// biome-ignore lint/correctness/useExhaustiveDependencies: query results excluded intentionally - card data is immutable (staleTime: Infinity). IDs included to re-validate when different cards are queried.
	return useMemo(() => {
		if (!debouncedDeck || isLoading) return null;

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

		// Build printings map for PDH commanders
		// WARNING: getPrintings currently only has data for PDH commanders.
		// If future validation rules need printings for other cards, this
		// will need to be expanded (and may have performance implications).
		const printingsMap = new Map<OracleId, Card[]>();
		if (isPDH) {
			for (const result of printingCardsResults) {
				if (result.data?.oracle_id) {
					const existing = printingsMap.get(result.data.oracle_id) ?? [];
					existing.push(result.data);
					printingsMap.set(result.data.oracle_id, existing);
				}
			}
		}

		return validateDeck({
			deck: debouncedDeck,
			cardLookup: (id) => cardMap.get(id),
			oracleLookup: (id) => oracleMap.get(id),
			getPrintings: (oracleId) => {
				// Return full printings for PDH commanders, single card otherwise
				const printings = printingsMap.get(oracleId);
				if (printings && printings.length > 0) {
					return printings;
				}
				const card = oracleMap.get(oracleId);
				return card ? [card] : [];
			},
		});
	}, [
		debouncedDeck,
		isLoading,
		isPDH,
		cardIds,
		commanderOracleIds,
		allPrintingIds,
	]);
}
