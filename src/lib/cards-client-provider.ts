/**
 * Client-side card data provider
 *
 * Uses Web Worker to load full card dataset and provide search functionality
 */

import type { CardDataProvider } from "./card-data-provider";
import { getCardsWorker, initializeWorker } from "./cards-worker-client";
import type {
	Card,
	OracleId,
	ScryfallId,
	SearchRestrictions,
} from "./scryfall-types";

export class ClientCardProvider implements CardDataProvider {
	async initialize(): Promise<void> {
		await initializeWorker();
	}

	async getCardById(id: ScryfallId): Promise<Card | undefined> {
		const worker = getCardsWorker();
		return worker.getCardById(id);
	}

	async getPrintingsByOracleId(oracleId: OracleId): Promise<ScryfallId[]> {
		const worker = getCardsWorker();
		return worker.getPrintingsByOracleId(oracleId);
	}

	async getMetadata(): Promise<{ version: string; cardCount: number }> {
		const worker = getCardsWorker();
		return worker.getMetadata();
	}

	async getCanonicalPrinting(
		oracleId: OracleId,
	): Promise<ScryfallId | undefined> {
		const worker = getCardsWorker();
		return worker.getCanonicalPrinting(oracleId);
	}

	async searchCards(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults = 100,
	): Promise<Card[]> {
		const worker = getCardsWorker();
		return worker.searchCards(query, restrictions, maxResults);
	}

	async syntaxSearch(
		query: string,
		maxResults = 100,
	): Promise<
		| { ok: true; cards: Card[] }
		| { ok: false; error: { message: string; start: number; end: number } }
	> {
		const worker = getCardsWorker();
		return worker.syntaxSearch(query, maxResults);
	}
}
