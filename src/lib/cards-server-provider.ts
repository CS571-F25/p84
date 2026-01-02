/**
 * Server-side card data provider
 *
 * Uses byte-range CSV index for O(log n) card lookups
 * Loads only needed card data via byte-range slicing
 *
 * Uses fetch API in both dev and production (TanStack Start handles SSR fetch)
 */

// Static import of cloudflare:workers - the Cloudflare Vite plugin handles this
// In dev: provides stub/mock, In production: actual Workers env
import { env } from "cloudflare:workers";
import type { CardDataProvider } from "./card-data-provider";
import { CARD_CHUNKS, CARD_INDEXES, CARD_VOLATILE } from "./card-manifest";
import { LRUCache } from "./lru-cache";
import type {
	Card,
	OracleId,
	ScryfallId,
	VolatileData,
} from "./scryfall-types";

/**
 * Fetch asset from public/data
 * - Dev: uses absolute URL fetch
 * - Production: uses ASSETS binding
 */
async function fetchAsset(relativePath: string): Promise<Response> {
	// Production: use ASSETS binding with special assets.local URL
	if (!import.meta.env.DEV && env?.ASSETS) {
		return env.ASSETS.fetch(`https://assets.local/data/${relativePath}`);
	}

	// Dev: use absolute URL fetch
	const baseURL =
		process.env.DEPLOY_URL || process.env.URL || "http://localhost:3000";
	return fetch(`${baseURL}/data/${relativePath}`);
}

interface ByteIndexEntry {
	chunkIndex: number;
	offset: number;
	length: number;
}

interface IndexData {
	version: string;
	cardCount: number;
	oracleIdToPrintings: Record<OracleId, ScryfallId[]>;
	canonicalPrintingByOracleId: Record<OracleId, ScryfallId>;
}

// Binary format: fixed-size records (25 bytes each)
// Format: UUID (16 bytes) + chunk (1 byte) + offset (4 bytes) + length (4 bytes)
const RECORD_SIZE = 25;

// LRU cache for chunk data (~5MB per chunk with 4096 cards/chunk)
// 12 chunks = ~60MB, same budget as before (3 * 20MB), covers ~43% of data
const MAX_CHUNK_CACHE_SIZE = 12;

// LRU cache for parsed Card objects — hot cards hit far more often than needing extra chunks
// ~2KB per card (no prices), 10k cards ≈ 20MB
const MAX_CARD_CACHE_SIZE = 10_000;

let binaryIndexCache: ArrayBuffer | null = null;
let indexDataCache: IndexData | null = null;
const chunkCaches = new LRUCache<number, string>(MAX_CHUNK_CACHE_SIZE);
const cardCache = new LRUCache<ScryfallId, Card>(MAX_CARD_CACHE_SIZE);

// Volatile data (prices, EDHREC rank) - binary searched, not loaded into memory
const VOLATILE_RECORD_SIZE = 44; // 16 (UUID) + 4 (rank) + 6*4 (prices)
const NULL_VALUE = 0xffffffff;

let volatileDataPromise: Promise<ArrayBuffer> | null = null;

async function loadVolatileBuffer(): Promise<ArrayBuffer> {
	const response = await fetchAsset(`cards/${CARD_VOLATILE}`);
	if (!response.ok) {
		throw new Error(`Failed to load volatile data: ${response.statusText}`);
	}
	return response.arrayBuffer();
}

function getVolatileBuffer(): Promise<ArrayBuffer> {
	if (!volatileDataPromise) {
		volatileDataPromise = loadVolatileBuffer();
	}
	return volatileDataPromise;
}

function parseVolatileRecord(view: DataView, offset: number): VolatileData {
	const readValue = (fieldOffset: number): number | null => {
		const val = view.getUint32(offset + fieldOffset, true);
		return val === NULL_VALUE ? null : val;
	};

	const centsToPrice = (cents: number | null): number | null =>
		cents === null ? null : cents / 100;

	return {
		edhrecRank: readValue(16),
		usd: centsToPrice(readValue(20)),
		usdFoil: centsToPrice(readValue(24)),
		usdEtched: centsToPrice(readValue(28)),
		eur: centsToPrice(readValue(32)),
		eurFoil: centsToPrice(readValue(36)),
		tix: centsToPrice(readValue(40)),
	};
}

async function findVolatileData(
	cardId: ScryfallId,
): Promise<VolatileData | null> {
	const buffer = await getVolatileBuffer();
	const recordCount = buffer.byteLength / VOLATILE_RECORD_SIZE;

	const searchUuid = uuidToBytes(cardId);
	const searchView = new DataView(searchUuid.buffer);
	const searchHigh = searchView.getBigUint64(0, false);
	const searchLow = searchView.getBigUint64(8, false);

	const view = new DataView(buffer);
	let left = 0;
	let right = recordCount - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const offset = mid * VOLATILE_RECORD_SIZE;

		const recordHigh = view.getBigUint64(offset, false);
		const recordLow = view.getBigUint64(offset + 8, false);

		if (
			recordHigh < searchHigh ||
			(recordHigh === searchHigh && recordLow < searchLow)
		) {
			left = mid + 1;
		} else if (recordHigh === searchHigh && recordLow === searchLow) {
			return parseVolatileRecord(view, offset);
		} else {
			right = mid - 1;
		}
	}

	return null;
}

/**
 * Convert UUID string to Uint8Array for binary comparison
 * UUID format: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (36 chars with dashes)
 */
function uuidToBytes(uuid: string): Uint8Array {
	const hex = uuid.replace(/-/g, "");
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}

/**
 * Load binary index file (cached)
 */
async function loadBinaryIndex(): Promise<ArrayBuffer> {
	if (!binaryIndexCache) {
		const response = await fetchAsset("cards-byteindex.bin");
		if (!response.ok) {
			throw new Error(
				`Failed to load cards-byteindex.bin: ${response.statusText}`,
			);
		}
		binaryIndexCache = await response.arrayBuffer();
	}
	return binaryIndexCache;
}

/**
 * Parse full record at given offset (only call when found)
 * Format: UUID (16 bytes) + chunk (1 byte) + offset (4 bytes) + length (4 bytes)
 */
function parseRecord(buffer: ArrayBuffer, recordIndex: number): ByteIndexEntry {
	const view = new DataView(buffer);
	const offset = recordIndex * RECORD_SIZE;

	// Read chunk index (1 byte)
	const chunkIndex = view.getUint8(offset + 16);

	// Read offset (4 bytes, little-endian)
	const cardOffset = view.getUint32(offset + 17, true);

	// Read length (4 bytes, little-endian)
	const length = view.getUint32(offset + 21, true);

	return { chunkIndex, offset: cardOffset, length };
}

/**
 * Load oracle mappings and metadata
 */
async function loadIndexData(): Promise<IndexData> {
	if (indexDataCache) return indexDataCache;

	const response = await fetchAsset(`cards/${CARD_INDEXES}`);
	if (!response.ok) {
		throw new Error(`Failed to load ${CARD_INDEXES}: ${response.statusText}`);
	}
	indexDataCache = (await response.json()) as IndexData;
	return indexDataCache;
}

/**
 * Binary search for card ID in binary index
 * Uses 64-bit integer comparison for performance (2 comparisons vs 16 byte comparisons)
 *
 * UUIDs are 128 bits, stored as big-endian bytes. We read them as two 64-bit integers
 * (high 64 bits + low 64 bits) for faster comparison on modern CPUs.
 */
async function findCardInIndex(
	cardId: ScryfallId,
): Promise<ByteIndexEntry | undefined> {
	const buffer = await loadBinaryIndex();
	const recordCount = buffer.byteLength / RECORD_SIZE;

	const searchUuid = uuidToBytes(cardId);
	const searchView = new DataView(searchUuid.buffer);
	const searchHigh = searchView.getBigUint64(0, false); // big-endian
	const searchLow = searchView.getBigUint64(8, false);

	const view = new DataView(buffer);
	let left = 0;
	let right = recordCount - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const offset = mid * RECORD_SIZE;

		// Read UUID as two 64-bit integers (always read both for branch predictor)
		const recordHigh = view.getBigUint64(offset, false);
		const recordLow = view.getBigUint64(offset + 8, false);

		// Three-way comparison: less than, equal, or greater than
		if (
			recordHigh < searchHigh ||
			(recordHigh === searchHigh && recordLow < searchLow)
		) {
			left = mid + 1;
		} else if (recordHigh === searchHigh && recordLow === searchLow) {
			return parseRecord(buffer, mid);
		} else {
			right = mid - 1;
		}
	}

	return undefined;
}

/**
 * Load chunk file into cache
 */
async function loadChunk(chunkIndex: number): Promise<string> {
	return chunkCaches.getOrSet(chunkIndex, async () => {
		const chunkFilename = CARD_CHUNKS[chunkIndex];
		if (!chunkFilename) {
			throw new Error(`Invalid chunk index: ${chunkIndex}`);
		}
		const response = await fetchAsset(`cards/${chunkFilename}`);
		if (!response.ok) {
			throw new Error(
				`Failed to load ${chunkFilename}: ${response.statusText}`,
			);
		}
		return response.text();
	});
}

export class ServerCardProvider implements CardDataProvider {
	async getCardById(id: ScryfallId): Promise<Card | undefined> {
		const cached = cardCache.get(id);
		if (cached) {
			return cached;
		}

		try {
			// Binary search is cheap — only cache hits that require chunk loads
			const entry = await findCardInIndex(id);
			if (!entry) {
				return undefined;
			}

			const chunkContent = await loadChunk(entry.chunkIndex);
			const cardJSON = chunkContent.slice(
				entry.offset,
				entry.offset + entry.length,
			);

			const card = JSON.parse(cardJSON) as Card;
			cardCache.set(id, card);
			return card;
		} catch (error) {
			console.error(`[ServerCardProvider] Error loading card ${id}:`, error);
			return undefined;
		}
	}

	async getPrintingsByOracleId(oracleId: OracleId): Promise<ScryfallId[]> {
		try {
			const indexData = await loadIndexData();
			return indexData.oracleIdToPrintings[oracleId] || [];
		} catch {
			return [];
		}
	}

	async getMetadata(): Promise<{ version: string; cardCount: number }> {
		try {
			const indexData = await loadIndexData();
			return {
				version: indexData.version,
				cardCount: indexData.cardCount,
			};
		} catch {
			return { version: "unknown", cardCount: 0 };
		}
	}

	async getCanonicalPrinting(
		oracleId: OracleId,
	): Promise<ScryfallId | undefined> {
		try {
			const indexData = await loadIndexData();
			return indexData.canonicalPrintingByOracleId[oracleId];
		} catch {
			return undefined;
		}
	}

	/**
	 * Batch fetch multiple cards, grouped by chunk to avoid cache thrashing.
	 *
	 * Instead of fetching cards one-by-one (which bounces between chunks),
	 * this groups all IDs by their chunk index and processes chunk-by-chunk.
	 */
	async getCardsByIds(ids: ScryfallId[]): Promise<Map<ScryfallId, Card>> {
		const result = new Map<ScryfallId, Card>();
		const uncached: Array<{ id: ScryfallId; entry: ByteIndexEntry }> = [];

		// Phase 1: Check cache and collect index entries for misses
		for (const id of ids) {
			const cached = cardCache.get(id);
			if (cached) {
				result.set(id, cached);
			} else {
				const entry = await findCardInIndex(id);
				if (entry) {
					uncached.push({ id, entry });
				}
			}
		}

		// Phase 2: Group by chunk index
		const byChunk = new Map<
			number,
			Array<{ id: ScryfallId; entry: ByteIndexEntry }>
		>();
		for (const item of uncached) {
			const group = byChunk.get(item.entry.chunkIndex);
			if (group) {
				group.push(item);
			} else {
				byChunk.set(item.entry.chunkIndex, [item]);
			}
		}

		// Phase 3: Process each chunk (load once, extract all cards)
		// Sort to process cached chunks first, avoiding unnecessary evictions
		const sortedChunks = [...byChunk.entries()].sort(([a], [b]) => {
			const aInCache = chunkCaches.has(a);
			const bInCache = chunkCaches.has(b);
			if (aInCache && !bInCache) return -1;
			if (!aInCache && bInCache) return 1;
			return 0;
		});

		for (const [chunkIndex, items] of sortedChunks) {
			try {
				const chunkContent = await loadChunk(chunkIndex);
				for (const { id, entry } of items) {
					try {
						const cardJSON = chunkContent.slice(
							entry.offset,
							entry.offset + entry.length,
						);
						const card = JSON.parse(cardJSON) as Card;
						cardCache.set(id, card);
						result.set(id, card);
					} catch (error) {
						console.error(
							`[ServerCardProvider] Error parsing card ${id}:`,
							error,
						);
					}
				}
			} catch (error) {
				console.error(
					`[ServerCardProvider] Error loading chunk ${chunkIndex}:`,
					error,
				);
			}
		}

		return result;
	}

	async getVolatileData(id: ScryfallId): Promise<VolatileData | null> {
		return findVolatileData(id);
	}

	// Search not implemented server-side (client-only feature for now)
	searchCards = undefined;
}
