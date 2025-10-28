/**
 * Web Worker for managing card data
 *
 * Loads card data in background thread to keep main thread responsive.
 * Exposes RPC API via Comlink for querying cards.
 */

import * as Comlink from "comlink";
import MiniSearch from "minisearch";
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
	private canonicalCards: Card[] = [];
	private searchIndex: MiniSearch<Card> | null = null;

	async initialize(): Promise<void> {
		// Prevent re-initialization in SharedWorker mode (shared across tabs)
		if (this.data) {
			console.log("[CardsWorker] Already initialized, skipping");
			return;
		}

		console.log("[CardsWorker] Initializing card data...");
		const response = await fetch("/data/cards.json");
		if (!response.ok) {
			throw new Error("Failed to load card data");
		}

		const data: CardDataOutput = await response.json();
		this.data = data;

		// Build canonical cards array (one per oracle ID, excluding art cards)
		this.canonicalCards = Object.values(data.canonicalPrintingByOracleId)
			.map((scryfallId) => data.cards[scryfallId])
			.filter((card): card is Card => card !== undefined)
			.filter((card) => card.layout !== "art_series");

		// Build fuzzy search index
		console.log("[CardsWorker] Building search index...");
		this.searchIndex = new MiniSearch<Card>({
			fields: ["name"],
			storeFields: ["id", "oracle_id", "name"],
			searchOptions: {
				prefix: true, // "bol" matches "bolt"
				fuzzy: 0.2, // ~2 char tolerance
				combineWith: "AND", // all terms must match
				weights: {
					prefix: 0.7, // exact (1.0) > prefix (0.7) > fuzzy
					fuzzy: 0.4,
				},
			},
		});

		this.searchIndex.addAll(this.canonicalCards);

		console.log(
			`[CardsWorker] Initialized: ${data.cardCount.toLocaleString()} cards, ${this.canonicalCards.length.toLocaleString()} unique`,
		);
	}

	searchCards(query: string, limit = 100): Card[] {
		if (!this.data || !this.searchIndex) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		// Empty query returns no results
		if (!query.trim()) {
			return [];
		}

		// Perform fuzzy search with exact-match priority
		const results = this.searchIndex.search(query);

		// Map search results back to full Card objects and limit
		const data = this.data;
		return results
			.map((result) => data.cards[result.id as ScryfallId])
			.filter((card): card is Card => card !== undefined)
			.slice(0, limit);
	}

	getCardById(id: ScryfallId): Card | undefined {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}
		return this.data.cards[id];
	}

	getPrintingsByOracleId(oracleId: OracleId): ScryfallId[] {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}
		return this.data.oracleIdToPrintings[oracleId] ?? [];
	}

	getMetadata(): { version: string; cardCount: number } {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}
		return {
			version: this.data.version,
			cardCount: this.data.cardCount,
		};
	}

	getCanonicalPrinting(oracleId: OracleId): ScryfallId | undefined {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}
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
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		const card = this.data.cards[id];
		if (!card) return null;

		const allPrintingIds = this.data.oracleIdToPrintings[card.oracle_id] ?? [];
		const otherPrintingIds = allPrintingIds.filter((printId) => printId !== id);

		const data = this.data;
		const otherPrintings = otherPrintingIds
			.map((printId) => {
				const printing = data.cards[printId];
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

// Support both SharedWorker and regular Worker modes
if ("SharedWorkerGlobalScope" in self) {
	// SharedWorker mode - handle multiple connections
	console.log("[CardsWorker] Running in SharedWorker mode");
	(self as unknown as { onconnect: (e: MessageEvent) => void }).onconnect = (
		e: MessageEvent,
	) => {
		const port = e.ports[0];
		console.log("[CardsWorker] New tab connected");
		Comlink.expose(worker, port);
	};
} else {
	// Regular Worker mode - single connection
	console.log("[CardsWorker] Running in Worker mode");
	Comlink.expose(worker);
}

export type { CardsWorkerAPI };
