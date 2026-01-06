/**
 * Shared TanStack Query definitions
 */

import { queryOptions } from "@tanstack/react-query";
import { getCardDataProvider } from "./card-data-provider";
import type { OracleId, ScryfallId, VolatileData } from "./scryfall-types";
import type {
	Card,
	PaginatedSearchResult,
	SearchRestrictions,
	SortOption,
	UnifiedSearchResult,
} from "./search-types";

/**
 * Combine function for useQueries - converts query results into a Map.
 * Returns undefined until all cards are loaded.
 */
export function combineCardQueries(
	results: Array<{ data?: Card | undefined }>,
): Map<ScryfallId, Card> | undefined {
	const map = new Map<ScryfallId, Card>();
	for (const result of results) {
		if (result.data) {
			map.set(result.data.id, result.data);
		}
	}
	return results.every((r) => r.data) ? map : undefined;
}

/**
 * Search cards by name with optional restrictions
 */
export const searchCardsQueryOptions = (
	query: string,
	restrictions?: SearchRestrictions,
	maxResults = 50,
) =>
	queryOptions({
		queryKey: ["cards", "search", query, restrictions, maxResults] as const,
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

			const cards = await provider.searchCards(query, restrictions, maxResults);
			const metadata = await provider.getMetadata();

			return {
				cards,
				totalCount: metadata.cardCount,
			};
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

/**
 * Get a single card by ID
 */
export const getCardByIdQueryOptions = (id: ScryfallId) =>
	queryOptions({
		queryKey: ["cards", "byId", id] as const,
		queryFn: async () => {
			const provider = await getCardDataProvider();
			return provider.getCardById(id);
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

export type SyntaxSearchResult =
	| { ok: true; cards: Card[] }
	| { ok: false; error: { message: string; start: number; end: number } };

/**
 * Search cards using Scryfall-like syntax (e.g., "t:creature cmc<=3 s:lea")
 */
export const syntaxSearchQueryOptions = (query: string, maxResults = 100) =>
	queryOptions({
		queryKey: ["cards", "syntaxSearch", query, maxResults] as const,
		queryFn: async (): Promise<SyntaxSearchResult> => {
			const provider = await getCardDataProvider();

			if (!query.trim()) {
				return { ok: true, cards: [] };
			}

			if (!provider.syntaxSearch) {
				return {
					ok: false,
					error: { message: "Syntax search not available", start: 0, end: 0 },
				};
			}

			return provider.syntaxSearch(query, maxResults);
		},
		staleTime: 5 * 60 * 1000,
	});

/**
 * Get volatile data (prices, EDHREC rank) for a card
 */
export const getVolatileDataQueryOptions = (id: ScryfallId) =>
	queryOptions({
		queryKey: ["cards", "volatile", id] as const,
		queryFn: async (): Promise<VolatileData | null> => {
			const provider = await getCardDataProvider();
			return provider.getVolatileData(id);
		},
		staleTime: 5 * 60 * 1000, // 5 minutes - prices change frequently
	});

export type { UnifiedSearchResult };

/**
 * Unified search that automatically routes to fuzzy or syntax search
 * based on query complexity. Returns mode indicator and description for syntax queries.
 */
export const unifiedSearchQueryOptions = (
	query: string,
	restrictions?: SearchRestrictions,
	maxResults = 50,
) =>
	queryOptions({
		queryKey: [
			"cards",
			"unifiedSearch",
			query,
			restrictions,
			maxResults,
		] as const,
		queryFn: async (): Promise<UnifiedSearchResult> => {
			const provider = await getCardDataProvider();

			if (!query.trim()) {
				return { mode: "fuzzy", cards: [], description: null, error: null };
			}

			if (!provider.unifiedSearch) {
				return {
					mode: "fuzzy",
					cards: [],
					description: null,
					error: { message: "Unified search not available", start: 0, end: 0 },
				};
			}

			return provider.unifiedSearch(query, restrictions, maxResults);
		},
		staleTime: 5 * 60 * 1000,
	});

export const PAGE_SIZE = 50;

/**
 * Single page query for visibility-based fetching.
 * Used with useQueries to load pages based on scroll position.
 */
export const searchPageQueryOptions = (
	query: string,
	offset: number,
	restrictions?: SearchRestrictions,
	sort: SortOption = { field: "name", direction: "auto" },
) =>
	queryOptions({
		queryKey: [
			"cards",
			"searchPage",
			query,
			offset,
			restrictions,
			sort,
		] as const,
		queryFn: async (): Promise<PaginatedSearchResult> => {
			const provider = await getCardDataProvider();

			if (!query.trim()) {
				return {
					mode: "fuzzy",
					cards: [],
					totalCount: 0,
					description: null,
					error: null,
				};
			}

			if (!provider.paginatedUnifiedSearch) {
				return {
					mode: "fuzzy",
					cards: [],
					totalCount: 0,
					description: null,
					error: {
						message: "Paginated search not available",
						start: 0,
						end: 0,
					},
				};
			}

			return provider.paginatedUnifiedSearch(
				query,
				restrictions,
				sort,
				offset,
				PAGE_SIZE,
			);
		},
		staleTime: 5 * 60 * 1000,
	});
