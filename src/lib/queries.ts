/**
 * Shared TanStack Query definitions
 */

import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getCardsWorker, initializeWorker } from "./cards-worker-client";
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

/**
 * Search cards by name
 */
export const searchCardsQueryOptions = (query: string) =>
	queryOptions({
		queryKey: ["cards", "search", query] as const,
		queryFn: async (): Promise<{ cards: Card[]; totalCount: number }> => {
			await initializeWorker();
			const worker = getCardsWorker();

			if (!query.trim()) {
				// No search query - return empty results
				return { cards: [], totalCount: 0 };
			}

			const cards = await worker.searchCards(query, 200);
			const metadata = await worker.getMetadata();

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
			await initializeWorker();
			const worker = getCardsWorker();

			const result = await worker.getCardWithPrintings(id);
			return result;
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
			await initializeWorker();
			const worker = getCardsWorker();

			return worker.getPrintingsByOracleId(oracleId);
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
			await initializeWorker();
			const worker = getCardsWorker();
			return worker.getMetadata();
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * Prefetch cards data into the query client
 * Useful for route loaders that want to preload data
 */
export async function prefetchCards(queryClient: QueryClient) {
	await queryClient.prefetchQuery(cardsQueryOptions);
}
