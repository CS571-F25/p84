/**
 * Isomorphic card prefetching for route loaders
 *
 * Design constraints this module addresses:
 *
 * 1. SERVER CHUNK THRASHING: Cards are stored across multiple chunks with an LRU cache.
 *    Parallel individual fetches cause cache thrashing when cards span chunks (load
 *    chunk A, then B, then A again after eviction). Solution: batch lookups that group
 *    by chunk index before fetching.
 *
 * 2. CLIENT HAS NO CHUNK ISSUE: The web worker loads all chunks into memory upfront.
 *    No LRU eviction means parallel fetches are fine and preferred.
 *
 * 3. AVOID DUPLICATE BINARY SEARCHES: ServerCardProvider.getCardsByIds() does one
 *    binary search per card to find chunk locations, then groups and fetches. A naive
 *    "sort by chunk first, then fetch individually" would double the binary searches.
 *
 * 4. QUERY CACHE INTEGRATION: Both paths populate individual card entries in the
 *    TanStack Query cache. This function itself is NOT a cached query - it's a prefetch
 *    utility that warms the cache with individual card entries so useQuery hits cache.
 *
 * Dynamic import note: `await import()` is cached by the ES module loader - the module
 * is evaluated once and subsequent imports return the cached module object.
 */

import type { QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCardByIdQueryOptions } from "./queries";
import type { ScryfallId } from "./scryfall-types";

export const prefetchCards = createIsomorphicFn()
	.client(async (queryClient: QueryClient, ids: ScryfallId[]) => {
		await Promise.all(
			ids.map((id) => queryClient.ensureQueryData(getCardByIdQueryOptions(id))),
		);
	})
	.server(async (queryClient: QueryClient, ids: ScryfallId[]) => {
		const { ServerCardProvider } = await import("./cards-server-provider");
		const provider = new ServerCardProvider();
		const cards = await provider.getCardsByIds(ids);
		for (const [id, card] of cards) {
			queryClient.setQueryData(getCardByIdQueryOptions(id).queryKey, card);
		}
	});
