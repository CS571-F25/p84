/**
 * Shared TanStack Query definitions
 */

import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { CardDataOutput } from "./scryfall-types";

export const cardsQueryOptions = queryOptions({
	queryKey: ["cards"] as const,
	queryFn: async (): Promise<CardDataOutput> => {
		const response = await fetch("/data/cards.json");
		if (!response.ok) {
			throw new Error("Failed to load card data!!");
		}
		return response.json();
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
