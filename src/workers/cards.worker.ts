/**
 * Web Worker for managing card data
 *
 * Loads card data in background thread to keep main thread responsive.
 * Exposes RPC API via Comlink for querying cards.
 */

import * as Comlink from "comlink";
import type {
	Card,
	CardDataOutput,
	OracleId,
	ScryfallId,
} from "../lib/scryfall-types";

interface CardsWorkerAPI {
	/**
	 * Initialize worker by loading all card data
	 */
	initialize(): Promise<void>;

	/**
	 * Get all cards (up to limit)
	 */
	getCards(limit?: number): Card[];

	/**
	 * Search cards by name
	 */
	searchCards(query: string, limit?: number): Card[];

	/**
	 * Get card by ID
	 */
	getCardById(id: ScryfallId): Card | undefined;

	/**
	 * Get all printings for an oracle ID
	 */
	getPrintingsByOracleId(oracleId: OracleId): ScryfallId[];

	/**
	 * Get metadata (version, card count)
	 */
	getMetadata(): { version: string; cardCount: number };

	/**
	 * Get canonical printing ID for an oracle ID
	 */
	getCanonicalPrinting(oracleId: OracleId): ScryfallId | undefined;

	/**
	 * Get card with all its printings data
	 */
	getCardWithPrintings(id: ScryfallId): {
		card: Card;
		otherPrintings: Array<{
			id: ScryfallId;
			name: string;
			set_name?: string;
		}>;
	} | null;
}

class CardsWorker implements CardsWorkerAPI {
	private data: CardDataOutput | null = null;
	private cardsArray: Card[] = [];
	private canonicalCards: Card[] = [];

	private ensureInitialized(): asserts this is this & {
		data: CardDataOutput;
	} {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}
	}

	async initialize(): Promise<void> {
		const response = await fetch("/data/cards.json");
		if (!response.ok) {
			throw new Error("Failed to load card data");
		}

		this.data = await response.json();
		this.cardsArray = Object.values(this.data.cards);

		// Build canonical cards array (one per oracle ID)
		this.canonicalCards = Object.values(this.data.canonicalPrintingByOracleId)
			.map((scryfallId) => this.data.cards[scryfallId])
			.filter((card): card is Card => card !== undefined);
	}

	getCards(limit?: number): Card[] {
		this.ensureInitialized();
		return limit ? this.cardsArray.slice(0, limit) : this.cardsArray;
	}

	searchCards(query: string, limit = 100): Card[] {
		this.ensureInitialized();
		const lowerQuery = query.toLowerCase();
		return this.canonicalCards
			.filter((card) => card.name.toLowerCase().includes(lowerQuery))
			.slice(0, limit);
	}

	getCardById(id: ScryfallId): Card | undefined {
		this.ensureInitialized();
		return this.data.cards[id];
	}

	getPrintingsByOracleId(oracleId: OracleId): ScryfallId[] {
		this.ensureInitialized();
		return this.data.oracleIdToPrintings[oracleId] ?? [];
	}

	getMetadata(): { version: string; cardCount: number } {
		this.ensureInitialized();
		return {
			version: this.data.version,
			cardCount: this.data.cardCount,
		};
	}

	getCanonicalPrinting(oracleId: OracleId): ScryfallId | undefined {
		this.ensureInitialized();
		return this.data.canonicalPrintingByOracleId[oracleId];
	}

	getCardWithPrintings(id: ScryfallId): {
		card: Card;
		otherPrintings: Array<{
			id: ScryfallId;
			name: string;
			set_name?: string;
		}>;
	} | null {
		this.ensureInitialized();

		const card = this.data.cards[id];
		if (!card) return null;

		const allPrintingIds = this.data.oracleIdToPrintings[card.oracle_id] ?? [];
		const otherPrintingIds = allPrintingIds.filter((printId) => printId !== id);

		const otherPrintings = otherPrintingIds
			.map((printId) => {
				const printing = this.data.cards[printId];
				if (!printing) return null;
				return {
					id: printing.id,
					name: printing.name,
					set_name: printing.set_name,
				};
			})
			.filter((p): p is NonNullable<typeof p> => p !== null);

		return {
			card,
			otherPrintings,
		};
	}
}

const worker = new CardsWorker();
Comlink.expose(worker);

export type { CardsWorkerAPI };
