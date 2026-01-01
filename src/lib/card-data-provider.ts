/**
 * Unified interface for accessing card data
 *
 * Implementations:
 * - ClientCardProvider: Client-side, uses Web Worker with full dataset
 * - ServerCardProvider: Server-side, reads from filesystem
 */

// import { ClientCardProvider } from "./cards-client-provider";
import { createIsomorphicFn } from "@tanstack/react-start";
import type {
	Card,
	OracleId,
	ScryfallId,
	SearchRestrictions,
} from "./scryfall-types";

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
}

let providerPromise: Promise<CardDataProvider> | null = null;

/**
 * Get the card data provider for the current environment
 *
 * - Client: ClientCardProvider (uses Web Worker with full dataset)
 * - Server: TODO - D1 local dev is flaky, disabled for now
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
