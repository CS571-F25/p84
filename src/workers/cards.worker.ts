/**
 * Web Worker for managing card data
 *
 * Loads card data in background thread to keep main thread responsive.
 * Exposes RPC API via Comlink for querying cards.
 */

import * as Comlink from "comlink";
import MiniSearch from "minisearch";
import { CARD_CHUNKS } from "../lib/card-chunks";
import type {
	Card,
	CardDataOutput,
	ManaColor,
	OracleId,
	ScryfallId,
	SearchRestrictions,
} from "../lib/scryfall-types";

interface CardsWorkerAPI {
	/**
	 * Initialize worker by loading all card data
	 */
	initialize(): Promise<void>;

	/**
	 * Search cards by name with optional restrictions
	 */
	searchCards(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults?: number,
	): Card[];

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
		console.log(
			`[CardsWorker] Loading ${CARD_CHUNKS.length} chunks + indexes...`,
		);

		// Fetch everything in parallel
		const [indexes, ...chunks] = await Promise.all([
			fetch("/data/cards-indexes.json").then((r) => {
				if (!r.ok) throw new Error("Failed to load card indexes");
				return r.json() as Promise<
					Pick<
						CardDataOutput,
						| "version"
						| "cardCount"
						| "oracleIdToPrintings"
						| "canonicalPrintingByOracleId"
					>
				>;
			}),
			...CARD_CHUNKS.map((filename) =>
				fetch(`/data/${filename}`).then((r) => {
					if (!r.ok) throw new Error(`Failed to load chunk: ${filename}`);
					return r.json() as Promise<{ cards: Record<string, Card> }>;
				}),
			),
		]);

		// Merge all chunks into single cards object
		const cards = Object.assign({}, ...chunks.map((c) => c.cards));

		console.log(
			`[CardsWorker] Loaded ${Object.keys(cards).length} cards from ${CARD_CHUNKS.length} chunks`,
		);

		this.data = {
			version: indexes.version,
			cardCount: indexes.cardCount,
			cards,
			oracleIdToPrintings: indexes.oracleIdToPrintings,
			canonicalPrintingByOracleId: indexes.canonicalPrintingByOracleId,
		};

		// Build canonical cards array (one per oracle ID, excluding art cards)
		this.canonicalCards = Object.values(this.data.canonicalPrintingByOracleId)
			.map((scryfallId) => this.data?.cards[scryfallId])
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
			`[CardsWorker] Initialized: ${this.data.cardCount.toLocaleString()} cards, ${this.canonicalCards.length.toLocaleString()} unique`,
		);
	}

	searchCards(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults = 50,
	): Card[] {
		if (!this.data || !this.searchIndex) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		// Empty query returns no results
		if (!query.trim()) {
			return [];
		}

		// Perform fuzzy search with exact-match priority
		const searchResults = this.searchIndex.search(query);
		const results: Card[] = [];

		// Iterate incrementally, applying filters and stopping at maxResults
		for (const result of searchResults) {
			const card = this.data.cards[result.id as ScryfallId];
			if (!card) continue;

			// Apply restrictions
			if (restrictions) {
				// Format legality check
				if (restrictions.format) {
					const legality = card.legalities?.[restrictions.format];
					if (legality !== "legal" && legality !== "restricted") {
						continue;
					}
				}

				// Color identity subset check (Scryfall order not guaranteed)
				if (restrictions.colorIdentity) {
					const cardIdentity = card.color_identity ?? [];
					const allowedSet = new Set(restrictions.colorIdentity);

					// Card must be subset of allowed colors
					if (!cardIdentity.every((c) => allowedSet.has(c as ManaColor))) {
						continue;
					}
				}
			}

			results.push(card);
			if (results.length >= maxResults) break; // Early exit
		}

		return results;
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
export { CardsWorker as __CardsWorkerForTestingOnly };
