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
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

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

let binaryIndexCache: ArrayBuffer | null = null;
let indexDataCache: IndexData | null = null;
const chunkCaches: Map<number, string> = new Map();

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
function parseRecord(
	buffer: ArrayBuffer,
	recordIndex: number,
): ByteIndexEntry {
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

	const response = await fetchAsset("cards-indexes.json");
	if (!response.ok) {
		throw new Error(
			`Failed to load cards-indexes.json: ${response.statusText}`,
		);
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
	const cached = chunkCaches.get(chunkIndex);
	if (cached !== undefined) {
		return cached;
	}

	const chunkFilename = `cards-${String(chunkIndex).padStart(3, "0")}.json`;
	const response = await fetchAsset(chunkFilename);
	if (!response.ok) {
		throw new Error(`Failed to load ${chunkFilename}: ${response.statusText}`);
	}
	const content = await response.text();
	chunkCaches.set(chunkIndex, content);
	return content;
}

export class ServerCardProvider implements CardDataProvider {
	async getCardById(id: ScryfallId): Promise<Card | undefined> {
		try {
			const entry = await findCardInIndex(id);

			if (!entry) {
				return undefined;
			}

			// Load chunk and extract card JSON
			const chunkContent = await loadChunk(entry.chunkIndex);
			const cardJSON = chunkContent.slice(
				entry.offset,
				entry.offset + entry.length,
			);

			return JSON.parse(cardJSON) as Card;
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

	// Search not implemented server-side (client-only feature for now)
	searchCards = undefined;
}
