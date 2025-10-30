/**
 * Shared TanStack Query definitions
 */

import { queryOptions } from "@tanstack/react-query";
import { getCardDataProvider } from "./card-data-provider";
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

/**
 * Search cards by name
 */
export const searchCardsQueryOptions = (query: string) =>
	queryOptions({
		queryKey: ["cards", "search", query] as const,
		queryFn: async (): Promise<{ cards: Card[]; totalCount: number }> => {
			const provider = await getCardDataProvider();

			if (!query.trim()) {
				// No search query - return empty results
				return { cards: [], totalCount: 0 };
			}

			// Search may not be available on all providers (e.g., server-side)
			if (!provider.searchCards) {
				return { cards: [], totalCount: 0 };
			}

			const cards = await provider.searchCards(query, 50);
			const metadata = await provider.getMetadata();

			return {
				cards,
				totalCount: metadata.cardCount,
			};
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

/**
 * Get a single card by ID with all its printings
 */
export const getCardWithPrintingsQueryOptions = (id: ScryfallId) =>
	queryOptions({
		queryKey: ["cards", "withPrintings", id] as const,
		queryFn: async () => {
			const provider = await getCardDataProvider();
			return provider.getCardWithPrintings(id);
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * Get all printings for a card's oracle ID
 */
export const getCardPrintingsQueryOptions = (oracleId: OracleId) =>
	queryOptions({
		queryKey: ["cards", "printings", oracleId] as const,
		queryFn: async (): Promise<ScryfallId[]> => {
			const provider = await getCardDataProvider();
			return provider.getPrintingsByOracleId(oracleId);
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * Get cards metadata (version, count)
 */
export const getCardsMetadataQueryOptions = () =>
	queryOptions({
		queryKey: ["cards", "metadata"] as const,
		queryFn: async () => {
			const provider = await getCardDataProvider();
			return provider.getMetadata();
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * Get canonical printing ID for an oracle ID
 */
export const getCanonicalPrintingQueryOptions = (oracleId: OracleId) =>
	queryOptions({
		queryKey: ["cards", "canonical", oracleId] as const,
		queryFn: async (): Promise<ScryfallId | null> => {
			const provider = await getCardDataProvider();
			const result = await provider.getCanonicalPrinting(oracleId);
			return result ?? null;
		},
		staleTime: Number.POSITIVE_INFINITY,
	});
