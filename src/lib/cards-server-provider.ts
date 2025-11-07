/**
 * Server-side card data provider
 *
 * Uses byte-range CSV index for O(log n) card lookups
 * Loads only needed card data via byte-range slicing
 *
 * Uses fetch API in both dev and production (TanStack Start handles SSR fetch)
 */

import type { CardDataProvider } from "./card-data-provider";
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

/**
 * Get ASSETS binding from Cloudflare environment
 * Returns undefined in dev or if not available
 */
async function getAssetsBinding(): Promise<
	{ fetch: typeof fetch } | undefined
> {
	try {
		const { getEvent } = await import("@tanstack/start/server");
		const event = getEvent();
		return event?.context?.cloudflare?.env?.ASSETS;
	} catch {
		return undefined;
	}
}

/**
 * Load file from public/data
 *
 * Workers: uses ASSETS binding
 * Dev: uses absolute URL fetch
 */
async function loadDataFile(relativePath: string): Promise<string> {
	const assets = await getAssetsBinding();
	if (assets) {
		// Workers: use ASSETS binding
		const response = await assets.fetch(`/data/${relativePath}`);
		if (!response.ok) {
			throw new Error(`Failed to load ${relativePath}: ${response.statusText}`);
		}
		return await response.text();
	}

	// Dev: use absolute URL fetch
	const baseURL =
		process.env.DEPLOY_URL || process.env.URL || "http://localhost:3000";
	const url = `${baseURL}/data/${relativePath}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load ${relativePath}: ${response.statusText}`);
	}
	return await response.text();
}

/**
 * Load and parse JSON file from public/data
 *
 * Workers: uses ASSETS binding
 * Dev: uses absolute URL fetch
 */
async function loadDataJSON<T>(relativePath: string): Promise<T> {
	const assets = await getAssetsBinding();
	if (assets) {
		// Workers: use ASSETS binding
		const response = await assets.fetch(`/data/${relativePath}`);
		if (!response.ok) {
			throw new Error(`Failed to load ${relativePath}: ${response.statusText}`);
		}
		return (await response.json()) as T;
	}

	// Dev: use absolute URL fetch
	const baseURL =
		process.env.DEPLOY_URL || process.env.URL || "http://localhost:3000";
	const url = `${baseURL}/data/${relativePath}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load ${relativePath}: ${response.statusText}`);
	}
	return (await response.json()) as T;
}

interface ByteIndexEntry {
	cardId: ScryfallId;
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

// CSV format: fixed-width records (58 bytes each including newline)
// Format: "cardId,CC,OOOOOOOOOO,LLLLLL\n" (36+1+2+1+10+1+6+1 = 58)
const RECORD_SIZE = 58;

let csvIndexCache: string | null = null;
let indexDataCache: IndexData | null = null;
const chunkCaches: Map<number, string> = new Map();

/**
 * Load CSV index file (cached)
 */
async function loadCSVIndex(): Promise<string> {
	if (!csvIndexCache) {
		csvIndexCache = await loadDataFile("cards-byteindex.csv");
	}
	return csvIndexCache;
}

/**
 * Parse full record only when found (skips parseInt during search)
 */
function parseRecord(record: string): ByteIndexEntry {
	// Format: "cardId,CC,OOOOOOOOOO,LLLLLL\n"
	const cardId = record.slice(0, 36) as ScryfallId;
	const chunkIndex = Number.parseInt(record.slice(37, 39), 10);
	const offset = Number.parseInt(record.slice(40, 50), 10);
	const length = Number.parseInt(record.slice(51, 57), 10);

	return { cardId, chunkIndex, offset, length };
}

/**
 * Load oracle mappings and metadata
 */
async function loadIndexData(): Promise<IndexData> {
	if (indexDataCache) return indexDataCache;

	indexDataCache = await loadDataJSON<IndexData>("cards-indexes.json");
	return indexDataCache;
}

/**
 * Binary search for card ID in fixed-width CSV
 * Only extracts cardId during search, parses full record on match
 */
async function findCardInIndex(
	cardId: ScryfallId,
): Promise<ByteIndexEntry | undefined> {
	const csv = await loadCSVIndex();
	const recordCount = Math.floor(csv.length / RECORD_SIZE);

	let left = 0;
	let right = recordCount - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const recordStart = mid * RECORD_SIZE;

		// Only extract cardId for comparison (first 36 chars)
		const recordCardId = csv.substring(recordStart, recordStart + 36);
		const cmp = recordCardId.localeCompare(cardId);

		if (cmp === 0) {
			// Found it - now parse the full record
			const record = csv.substring(recordStart, recordStart + RECORD_SIZE);
			return parseRecord(record);
		}
		if (cmp < 0) {
			left = mid + 1;
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
	const content = await loadDataFile(chunkFilename);
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
