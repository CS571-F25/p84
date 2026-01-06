/**
 * Unified interface for accessing card data
 *
 * Implementations:
 * - ClientCardProvider: Client-side, uses Web Worker with full dataset
 * - ServerCardProvider: Server-side, reads from filesystem
 */

import { createIsomorphicFn } from "@tanstack/react-start";
import type { OracleId, ScryfallId, VolatileData } from "./scryfall-types";
import type {
	Card,
	PaginatedSearchResult,
	SearchRestrictions,
	SortOption,
	UnifiedSearchResult,
} from "./search-types";

export type { UnifiedSearchResult, PaginatedSearchResult };

export interface CardDataProvider {
	/**
	 * Get card by ID
	 */
	getCardById(id: ScryfallId): Promise<Card | undefined>;

	/**
	 * Get all printings for an oracle ID
	 */
	getPrintingsByOracleId(oracleId: OracleId): Promise<ScryfallId[]>;

	/**
	 * Get metadata (version, card count)
	 */
	getMetadata(): Promise<{ version: string; cardCount: number }>;

	/**
	 * Get canonical printing ID for an oracle ID
	 */
	getCanonicalPrinting(oracleId: OracleId): Promise<ScryfallId | undefined>;

	/**
	 * Search cards by name with optional restrictions (optional - may not be available on all providers)
	 */
	searchCards?(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults?: number,
	): Promise<Card[]>;

	/**
	 * Search cards using Scryfall-like syntax (e.g., "t:creature cmc<=3 s:lea")
	 * Returns error info if query is invalid
	 */
	syntaxSearch?(
		query: string,
		maxResults?: number,
	): Promise<
		| { ok: true; cards: Card[] }
		| { ok: false; error: { message: string; start: number; end: number } }
	>;

	/**
	 * Get volatile data (prices, EDHREC rank) for a card
	 * Waits for volatile data to load if not ready yet
	 * Returns null if card not found
	 */
	getVolatileData(id: ScryfallId): Promise<VolatileData | null>;

	/**
	 * Unified search that automatically routes to fuzzy or syntax search
	 * based on query complexity. Returns mode indicator and optional description.
	 */
	unifiedSearch?(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults?: number,
	): Promise<UnifiedSearchResult>;

	/**
	 * Paginated unified search with caching for virtual scroll
	 * Caches full result set in LRU cache, returns requested slice
	 */
	paginatedUnifiedSearch?(
		query: string,
		restrictions: SearchRestrictions | undefined,
		sort: SortOption,
		offset: number,
		limit: number,
	): Promise<PaginatedSearchResult>;
}

let providerPromise: Promise<CardDataProvider> | null = null;

/**
 * Get the card data provider for the current environment
 *
 * - Client: ClientCardProvider (uses Web Worker with full dataset)
 * - Server: ServerCardProvider (uses binary searchable index for slice parsing)
 */
export const getCardDataProvider = createIsomorphicFn()
	.client(() => {
		if (!providerPromise) {
			providerPromise = (async () => {
				const { ClientCardProvider } = await import("./cards-client-provider");
				const provider = new ClientCardProvider();
				await provider.initialize();
				return provider;
			})();
		}
		return providerPromise;
	})
	.server(() => {
		if (!providerPromise) {
			providerPromise = (async () => {
				const { ServerCardProvider } = await import("./cards-server-provider");
				return new ServerCardProvider();
			})();
		}
		return providerPromise;
	});
