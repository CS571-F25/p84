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
		const response = await fetchAsset("cards-byteindex.csv");
		if (!response.ok) {
			throw new Error(
				`Failed to load cards-byteindex.csv: ${response.statusText}`,
			);
		}
		csvIndexCache = await response.text();
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
