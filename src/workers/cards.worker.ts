/**
 * Web Worker for managing card data
 *
 * Loads card data in background thread to keep main thread responsive.
 * Exposes RPC API via Comlink for querying cards.
 */

import * as Comlink from "comlink";
import MiniSearch from "minisearch";
import { CARD_CHUNKS, CARD_INDEXES, CARD_VOLATILE } from "../lib/card-manifest";
import type {
	Card,
	CardDataOutput,
	ManaColor,
	OracleId,
	ScryfallId,
	SearchRestrictions,
	VolatileData,
} from "../lib/scryfall-types";
import {
	describeQuery,
	hasSearchOperators,
	search as parseSearch,
} from "../lib/search";

interface UnifiedSearchResult {
	mode: "fuzzy" | "syntax";
	cards: Card[];
	description: string | null;
	error: { message: string; start: number; end: number } | null;
}

const VOLATILE_RECORD_SIZE = 44; // 16 (UUID) + 4 (rank) + 6*4 (prices)
const NULL_VALUE = 0xffffffff;

function bytesToUuid(bytes: Uint8Array): string {
	const hex = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// NOTE: We always search all printings and dedup to canonical.
// If this proves slow, we could reintroduce hasPrintingQuery() to optimize
// queries without printing-specific fields (set, rarity, artist, etc.)
// by searching only canonical cards. The dedup logic would remain unchanged.

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

	/**
	 * Search cards using Scryfall-like syntax
	 */
	syntaxSearch(
		query: string,
		maxResults?: number,
	):
		| { ok: true; cards: Card[] }
		| { ok: false; error: { message: string; start: number; end: number } };

	/**
	 * Get volatile data (prices, EDHREC rank) for a card
	 * Waits for volatile data to load if not ready yet
	 * Returns null if card not found
	 */
	getVolatileData(id: ScryfallId): Promise<VolatileData | null>;

	/**
	 * Unified search that routes to fuzzy or syntax search based on query complexity
	 */
	unifiedSearch(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults?: number,
	): UnifiedSearchResult;
}

class CardsWorker implements CardsWorkerAPI {
	private data: CardDataOutput | null = null;
	private canonicalCards: Card[] = [];
	private canonicalRank: Map<ScryfallId, number> = new Map();
	private searchIndex: MiniSearch<Card> | null = null;
	private volatileDataPromise: Promise<Map<string, VolatileData>> | null = null;

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

		// Fetch card data in parallel (from immutable cache subfolder)
		const [indexes, ...chunks] = await Promise.all([
			fetch(`/data/cards/${CARD_INDEXES}`).then((r) => {
				if (!r.ok) throw new Error("Failed to load card indexes");
				return r.json() as Promise<
					Pick<CardDataOutput, "version" | "cardCount" | "oracleIdToPrintings">
				>;
			}),
			...CARD_CHUNKS.map((filename) =>
				fetch(`/data/cards/${filename}`).then((r) => {
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
		};

		// Build canonical cards array (one per oracle ID, excluding art cards)
		// First element of each oracleIdToPrintings array is the canonical printing
		this.canonicalCards = Object.values(this.data.oracleIdToPrintings)
			.map((printingIds) => this.data?.cards[printingIds[0]])
			.filter((card): card is Card => card !== undefined)
			.filter((card) => card.layout !== "art_series");

		// Build canonical rank map for O(1) lookup during search dedup
		// Lower rank = more canonical (first in oracleIdToPrintings = rank 0)
		this.canonicalRank.clear();
		for (const printingIds of Object.values(this.data.oracleIdToPrintings)) {
			for (let rank = 0; rank < printingIds.length; rank++) {
				this.canonicalRank.set(printingIds[rank], rank);
			}
		}

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

		// Load volatile data in background (non-blocking)
		this.volatileDataPromise = this.loadVolatileData();
	}

	private async loadVolatileData(): Promise<Map<string, VolatileData>> {
		console.log("[CardsWorker] Loading volatile data...");

		try {
			const response = await fetch(`/data/cards/${CARD_VOLATILE}`);
			if (!response.ok) {
				console.warn("[CardsWorker] Failed to load volatile data");
				return new Map();
			}

			const buffer = await response.arrayBuffer();
			const view = new DataView(buffer);
			const recordCount = buffer.byteLength / VOLATILE_RECORD_SIZE;

			const volatileMap = new Map<string, VolatileData>();

			for (let i = 0; i < recordCount; i++) {
				const offset = i * VOLATILE_RECORD_SIZE;

				// Read UUID (16 bytes)
				const uuidBytes = new Uint8Array(buffer, offset, 16);
				const id = bytesToUuid(uuidBytes);

				// Read values (little-endian uint32)
				const readValue = (fieldOffset: number): number | null => {
					const val = view.getUint32(offset + fieldOffset, true);
					return val === NULL_VALUE ? null : val;
				};

				// Convert cents back to dollars for prices
				const centsToPrice = (cents: number | null): number | null =>
					cents === null ? null : cents / 100;

				volatileMap.set(id, {
					edhrecRank: readValue(16),
					usd: centsToPrice(readValue(20)),
					usdFoil: centsToPrice(readValue(24)),
					usdEtched: centsToPrice(readValue(28)),
					eur: centsToPrice(readValue(32)),
					eurFoil: centsToPrice(readValue(36)),
					tix: centsToPrice(readValue(40)),
				});
			}

			console.log(
				`[CardsWorker] Loaded volatile data for ${volatileMap.size.toLocaleString()} cards`,
			);
			return volatileMap;
		} catch (error) {
			console.warn("[CardsWorker] Error loading volatile data:", error);
			return new Map();
		}
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
		// First element of oracleIdToPrintings is the canonical printing
		return this.data.oracleIdToPrintings[oracleId]?.[0];
	}

	syntaxSearch(
		query: string,
		maxResults = 100,
	):
		| { ok: true; cards: Card[] }
		| { ok: false; error: { message: string; start: number; end: number } } {
		if (!this.data) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		if (!query.trim()) {
			return { ok: true, cards: [] };
		}

		const parseResult = parseSearch(query);

		if (!parseResult.ok) {
			return {
				ok: false,
				error: {
					message: parseResult.error.message,
					start: parseResult.error.span.start,
					end: parseResult.error.span.end,
				},
			};
		}

		const { match } = parseResult.value;

		// Always search all printings, then dedup to canonical
		const allMatches: Card[] = [];
		for (const card of Object.values(this.data.cards)) {
			if (card.layout === "art_series") continue;
			if (match(card)) {
				allMatches.push(card);
			}
		}

		// Collapse to one per oracle_id (most canonical match wins)
		const dedupedCards = this.collapseToCanonical(allMatches);

		// Sort alphabetically by name and limit results
		dedupedCards.sort((a, b) => a.name.localeCompare(b.name));
		const cards = dedupedCards.slice(0, maxResults);

		return { ok: true, cards };
	}

	async getVolatileData(id: ScryfallId): Promise<VolatileData | null> {
		if (!this.volatileDataPromise) {
			return null;
		}
		const volatileData = await this.volatileDataPromise;
		return volatileData.get(id) ?? null;
	}

	unifiedSearch(
		query: string,
		restrictions?: SearchRestrictions,
		maxResults = 50,
	): UnifiedSearchResult {
		if (!this.data || !this.searchIndex) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		const trimmed = query.trim();
		if (!trimmed) {
			return { mode: "fuzzy", cards: [], description: null, error: null };
		}

		// Simple query - use fuzzy search (no parsing needed)
		if (!hasSearchOperators(trimmed)) {
			const cards = this.searchCards(trimmed, restrictions, maxResults);
			return { mode: "fuzzy", cards, description: null, error: null };
		}

		// Complex query - parse and run syntax search
		const parseResult = parseSearch(trimmed);

		if (!parseResult.ok) {
			return {
				mode: "syntax",
				cards: [],
				description: null,
				error: {
					message: parseResult.error.message,
					start: parseResult.error.span.start,
					end: parseResult.error.span.end,
				},
			};
		}

		const { match, ast } = parseResult.value;
		const description = describeQuery(ast);

		// Build restrictions check outside the loop
		const restrictionCheck = this.buildRestrictionCheck(restrictions);

		// Always search all printings, then dedup to canonical
		const allMatches: Card[] = [];
		for (const card of Object.values(this.data.cards)) {
			if (card.layout === "art_series") continue;
			if (!restrictionCheck(card)) continue;
			if (!match(card)) continue;
			allMatches.push(card);
		}

		// Collapse to one per oracle_id (most canonical match wins)
		const dedupedCards = this.collapseToCanonical(allMatches);

		// Sort alphabetically by name and limit results
		dedupedCards.sort((a, b) => a.name.localeCompare(b.name));
		const cards = dedupedCards.slice(0, maxResults);

		return { mode: "syntax", cards, description, error: null };
	}

	/**
	 * Collapse multiple printings to one per oracle_id.
	 * Picks the most canonical (lowest rank) match for each oracle.
	 */
	private collapseToCanonical(cards: Card[]): Card[] {
		const best = new Map<OracleId, { card: Card; rank: number }>();

		for (const card of cards) {
			const rank = this.canonicalRank.get(card.id) ?? Number.MAX_SAFE_INTEGER;
			const existing = best.get(card.oracle_id);
			if (!existing || rank < existing.rank) {
				best.set(card.oracle_id, { card, rank });
			}
		}

		return Array.from(best.values()).map((b) => b.card);
	}

	private buildRestrictionCheck(
		restrictions?: SearchRestrictions,
	): (card: Card) => boolean {
		if (!restrictions) return () => true;

		const { format, colorIdentity } = restrictions;
		const allowedSet = colorIdentity ? new Set(colorIdentity) : null;

		return (card: Card) => {
			if (format) {
				const legality = card.legalities?.[format];
				if (legality !== "legal" && legality !== "restricted") {
					return false;
				}
			}
			if (allowedSet) {
				const cardIdentity = card.color_identity ?? [];
				if (!cardIdentity.every((c) => allowedSet.has(c as ManaColor))) {
					return false;
				}
			}
			return true;
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
export { CardsWorker as __CardsWorkerForTestingOnly };
