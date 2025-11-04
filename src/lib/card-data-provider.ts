/**
 * Unified interface for accessing card data
 *
 * Implementations:
 * - ClientCardProvider: Client-side, uses Web Worker with full dataset
 * - ServerCardProvider: Server-side, reads from filesystem
 */

import { ClientCardProvider } from "./cards-client-provider";
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

export interface CardDataProvider {
	/**
	 * Get card by ID
	 */
	getCardById(id: ScryfallId): Promise<Card | undefined>;

	/**
	 * Get multiple cards by IDs (bulk fetch for efficient grouping/sorting)
	 */
	getCardsByIds(ids: ScryfallId[]): Promise<Map<ScryfallId, Card>>;

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
	 * Get card with all its printings data
	 */
	getCardWithPrintings(id: ScryfallId): Promise<{
		card: Card;
		otherPrintings: Array<{
			id: ScryfallId;
			name: string;
			set_name?: string;
		}>;
	} | null>;

	/**
	 * Search cards by name (optional - may not be available on all providers)
	 */
	searchCards?(query: string, limit?: number): Promise<Card[]>;
}

let providerPromise: Promise<CardDataProvider> | null = null;

/**
 * Get the card data provider for the current environment
 *
 * - Client: ClientCardProvider (uses Web Worker with full dataset)
 * - Server: ServerCardProvider (fetches from static assets)
 */
export async function getCardDataProvider(): Promise<CardDataProvider> {
	if (!providerPromise) {
		providerPromise = (async () => {
			if (typeof window === "undefined") {
				// Server-side: dynamic import to avoid bundling fs in client
				const { ServerCardProvider } = await import("./cards-server-provider");
				return new ServerCardProvider();
			}

			// Client-side: use worker provider
			const provider = new ClientCardProvider();
			await provider.initialize();
			return provider;
		})();
	}
	return providerPromise;
}
