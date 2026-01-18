/**
 * Web Worker for managing card data
 *
 * Loads card data in background thread to keep main thread responsive.
 * Exposes RPC API via Comlink for querying cards.
 */

import * as Comlink from "comlink";
import MiniSearch from "minisearch";
import { CARD_CHUNKS, CARD_INDEXES, CARD_VOLATILE } from "../lib/card-manifest";
import { LRUCache } from "../lib/lru-cache";
import type {
	CardDataOutput,
	ManaColor,
	OracleId,
	ScryfallId,
	VolatileData,
} from "../lib/scryfall-types";
import {
	type CardPredicate,
	describeQuery,
	hasSearchOperators,
	search as parseSearch,
	type SearchNode,
	someNode,
} from "../lib/search";
import type {
	CachedSearchResult,
	Card,
	PaginatedSearchResult,
	SearchRestrictions,
	SortDirection,
	SortField,
	SortOption,
	UnifiedSearchResult,
} from "../lib/search-types";

export type { SortField, SortDirection, SortOption };

// Rarity ordering (higher = more rare, matches fields.ts RARITY_ORDER)
const RARITY_ORDER: Record<string, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	mythic: 3,
	special: 4,
	bonus: 5,
};

/**
 * Check if a card is a "non-game" card (token, art series, memorabilia).
 * These are excluded from search results unless explicitly queried.
 * For cards with both game and non-game printings (e.g., Ancestral Recall),
 * the canonical printing is sorted to prefer game printings in download-scryfall.ts.
 */
function isNonGameCard(card: Card): boolean {
	return (
		card.layout === "art_series" ||
		card.layout === "token" ||
		card.layout === "double_faced_token" ||
		card.set_type === "token" ||
		card.set_type === "memorabilia"
	);
}

// WUBRG ordering
const WUBRG_ORDER = ["W", "U", "B", "R", "G"];

function resolveDirection(
	field: SortField,
	dir: SortDirection,
): "asc" | "desc" {
	if (dir !== "auto") return dir;
	switch (field) {
		case "name":
			return "asc";
		case "mv":
			return "asc";
		case "released":
			return "desc";
		case "rarity":
			return "desc";
		case "color":
			return "asc";
	}
}

function colorIdentityRank(colors: string[] | undefined): number {
	if (!colors || colors.length === 0) return 100; // colorless last
	// Primary sort by number of colors, secondary by first color in WUBRG
	return (
		colors.length * 10 +
		Math.min(...colors.map((c) => WUBRG_ORDER.indexOf(c)).filter((i) => i >= 0))
	);
}

function getSortableName(name: string): string {
	return name.startsWith("A-") ? name.slice(2) : name;
}

type CardComparator = (a: Card, b: Card) => number;

function buildComparator(sort: SortOption): CardComparator {
	const dir = resolveDirection(sort.field, sort.direction);
	const mult = dir === "desc" ? -1 : 1;

	switch (sort.field) {
		case "name":
			return (a, b) =>
				mult * getSortableName(a.name).localeCompare(getSortableName(b.name));
		case "mv":
			return (a, b) => mult * ((a.cmc ?? 0) - (b.cmc ?? 0));
		case "released":
			return (a, b) =>
				mult * (a.released_at ?? "").localeCompare(b.released_at ?? "");
		case "rarity":
			return (a, b) =>
				mult *
				((RARITY_ORDER[a.rarity ?? ""] ?? 99) -
					(RARITY_ORDER[b.rarity ?? ""] ?? 99));
		case "color":
			return (a, b) =>
				mult *
				(colorIdentityRank(a.color_identity) -
					colorIdentityRank(b.color_identity));
	}
}

function buildChainedComparator(sorts: SortOption[]): CardComparator {
	const comparators = sorts.map(buildComparator);
	const nameTiebreaker: CardComparator = (a, b) =>
		getSortableName(a.name).localeCompare(getSortableName(b.name));

	return (a, b) => {
		for (const cmp of comparators) {
			const result = cmp(a, b);
			if (result !== 0) return result;
		}
		return nameTiebreaker(a, b);
	};
}

function sortCards(cards: Card[], sorts: SortOption[]): void {
	if (sorts.length === 0) return;
	cards.sort(buildChainedComparator(sorts));
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
		sort?: SortOption[],
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
		sort?: SortOption[],
	): UnifiedSearchResult;

	/**
	 * Paginated unified search with caching for virtual scroll
	 * Caches full result set in LRU cache, returns requested slice
	 */
	paginatedUnifiedSearch(
		query: string,
		restrictions: SearchRestrictions | undefined,
		sort: SortOption[],
		offset: number,
		limit: number,
	): Promise<PaginatedSearchResult>;
}

class CardsWorker implements CardsWorkerAPI {
	private data: CardDataOutput | null = null;
	private canonicalCards: Card[] = [];
	private canonicalRank: Map<ScryfallId, number> = new Map();
	private searchIndex: MiniSearch<Card> | null = null;
	private volatileDataPromise: Promise<Map<string, VolatileData>> | null = null;
	private searchCache = new LRUCache<string, CachedSearchResult>(5);

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
				fuzzy: 0.3, // ~2 char tolerance
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

		if (!query.trim()) {
			return [];
		}

		const searchResults = this.searchIndex.search(query);
		const restrictionCheck = this.buildRestrictionCheck(restrictions);
		const results: Card[] = [];

		for (const result of searchResults) {
			const card = this.data.cards[result.id as ScryfallId];
			if (!card) continue;
			if (isNonGameCard(card)) continue;
			if (!restrictionCheck(card)) continue;

			results.push(card);
			if (results.length >= maxResults) break;
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
		sort: SortOption[] = [{ field: "name", direction: "auto" }],
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

		const { match, ast } = parseResult.value;
		const cards = this.runParsedQuery(ast, match, maxResults, sort);
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
		sort: SortOption[] = [{ field: "name", direction: "auto" }],
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
		const cards = this.runParsedQuery(
			ast,
			match,
			maxResults,
			sort,
			restrictions,
		);
		return { mode: "syntax", cards, description, error: null };
	}

	async paginatedUnifiedSearch(
		query: string,
		restrictions: SearchRestrictions | undefined,
		sort: SortOption[],
		offset: number,
		limit: number,
	): Promise<PaginatedSearchResult> {
		if (!this.data || !this.searchIndex) {
			throw new Error("Worker not initialized - call initialize() first");
		}

		if (!query.trim()) {
			return {
				mode: "fuzzy",
				cards: [],
				totalCount: 0,
				description: null,
				error: null,
			};
		}

		const cacheKey = JSON.stringify({ query, restrictions, sort });
		const cached = await this.searchCache.getOrSet(cacheKey, async () =>
			this.executeFullUnifiedSearch(query, restrictions, sort),
		);

		return {
			mode: cached.mode,
			cards: cached.cards.slice(offset, offset + limit),
			totalCount: cached.cards.length,
			description: cached.description,
			error: cached.error,
		};
	}

	/**
	 * Execute full unified search without pagination (for caching)
	 */
	private executeFullUnifiedSearch(
		query: string,
		restrictions: SearchRestrictions | undefined,
		sort: SortOption[],
	): CachedSearchResult {
		if (!this.data || !this.searchIndex) {
			return { mode: "fuzzy", cards: [], description: null, error: null };
		}

		// Simple query - use fuzzy search
		if (!hasSearchOperators(query)) {
			const restrictionCheck = this.buildRestrictionCheck(restrictions);
			const searchResults = this.searchIndex.search(query);
			const cards: Card[] = [];

			for (const result of searchResults) {
				const card = this.data.cards[result.id as ScryfallId];
				if (!card) continue;
				if (isNonGameCard(card)) continue;
				if (!restrictionCheck(card)) continue;
				cards.push(card);
			}

			return { mode: "fuzzy", cards, description: null, error: null };
		}

		// Complex query - parse and run syntax search
		const parseResult = parseSearch(query);

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
		const cards = this.runFullParsedQuery(ast, match, sort, restrictions);
		return { mode: "syntax", cards, description, error: null };
	}

	/**
	 * Run a parsed query without result limit (for caching)
	 */
	private runFullParsedQuery(
		ast: SearchNode,
		match: CardPredicate,
		sort: SortOption[],
		restrictions?: SearchRestrictions,
	): Card[] {
		if (!this.data) return [];

		const includesNonGameCards = someNode(
			ast,
			(n) =>
				n.type === "FIELD" && (n.field === "settype" || n.field === "layout"),
		);

		const restrictionCheck = this.buildRestrictionCheck(restrictions);

		const allMatches: Card[] = [];
		for (const card of Object.values(this.data.cards)) {
			if (!includesNonGameCards && isNonGameCard(card)) continue;
			if (!restrictionCheck(card)) continue;
			if (!match(card)) continue;
			allMatches.push(card);
		}

		const dedupedCards = this.collapseToCanonical(allMatches);
		sortCards(dedupedCards, sort);
		return dedupedCards;
	}

	/**
	 * Run a parsed query: filter cards, collapse to canonical, sort.
	 */
	private runParsedQuery(
		ast: SearchNode,
		match: CardPredicate,
		maxResults: number,
		sort: SortOption[],
		restrictions?: SearchRestrictions,
	): Card[] {
		if (!this.data) return [];

		// Check if query explicitly references layout/set-type (don't filter non-game cards)
		const includesNonGameCards = someNode(
			ast,
			(n) =>
				n.type === "FIELD" && (n.field === "settype" || n.field === "layout"),
		);

		const restrictionCheck = this.buildRestrictionCheck(restrictions);

		// Filter cards, skipping non-game cards unless explicitly queried
		const allMatches: Card[] = [];
		for (const card of Object.values(this.data.cards)) {
			if (!includesNonGameCards && isNonGameCard(card)) continue;
			if (!restrictionCheck(card)) continue;
			if (!match(card)) continue;
			allMatches.push(card);
		}

		// Collapse to one per oracle_id, sort, and limit
		const dedupedCards = this.collapseToCanonical(allMatches);
		sortCards(dedupedCards, sort);
		return dedupedCards.slice(0, maxResults);
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
