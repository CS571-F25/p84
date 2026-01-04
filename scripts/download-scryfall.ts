#!/usr/bin/env node --experimental-strip-types

/**
 * Downloads Scryfall bulk data and processes it for client use.
 *
 * Usage:
 *   npm run download:scryfall          # Normal mode: fetch + process
 *   npm run download:scryfall --offline # Offline mode: reprocess cached data only
 *
 * Fetches:
 * - default_cards bulk data (all English cards)
 * - migrations data (UUID changes)
 * - mana symbol SVGs
 *
 * Outputs:
 * - public/data/cards-*.json - chunked card data (for client worker)
 * - public/data/cards-indexes.json - oracle mappings and canonical printings
 * - public/data/cards-byteindex.csv - byte-range index for SSR (cardId,chunk,offset,length)
 * - public/data/metadata.json - version and count info
 * - public/data/migrations.json - ID migration mappings
 * - public/symbols/*.svg - mana symbol images
 * - src/lib/card-manifest.ts - TypeScript manifest of all data files
 */

import { createHash } from "node:crypto";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card, CardDataOutput } from "../src/lib/scryfall-types.ts";
import { asScryfallId, asOracleId } from "../src/lib/scryfall-types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "../public/data");
const CARDS_DIR = join(OUTPUT_DIR, "cards");
const SYMBOLS_DIR = join(__dirname, "../public/symbols");
const TEMP_DIR = join(__dirname, "../.cache");

// Fields to keep from Scryfall data
const KEPT_FIELDS = [
	// Core identity
	"id",
	"oracle_id",
	"name",
	"type_line",
	"mana_cost",
	"cmc",
	"oracle_text",
	"colors",
	"color_identity",
	"keywords",
	"power",
	"toughness",
	"loyalty",
	"defense",
	"produced_mana",

	// Legalities & formats
	"legalities",
	"games",
	"reserved",

	// Search & filtering
	"set",
	"set_name",
	"collector_number",
	"rarity",
	"released_at",
	"artist",

	// Printing selection (image_uris omitted - can reconstruct from ID)
	"card_faces",
	"border_color",
	"frame",
	"frame_effects",
	"finishes",
	"promo",
	"promo_types",
	"full_art",
	"digital",
	"highres_image",
	"image_status",
	"layout",

	// Nice-to-have (flavor_text omitted - visible on card image)
	// edhrec_rank omitted - goes in volatile.bin
	"reprint",
	"variation",
	"lang",
	"content_warning",
] as const;

interface ScryfallCard {
	id: string;
	oracle_id: string;
	name: string;
	// Fields used for canonical printing comparison (before filtering)
	lang?: string;
	set?: string;
	frame?: string;
	border_color?: string;
	frame_effects?: string[];
	full_art?: boolean;
	promo_types?: string[];
	finishes?: string[];
	games?: string[];
	security_stamp?: string;
	highres_image?: boolean;
	released_at?: string;
	variation?: boolean;
	[key: string]: unknown;
}


interface BulkDataItem {
	type: string;
	updated_at: string;
	download_uri: string;
	size: number;
}

interface BulkDataResponse {
	data: BulkDataItem[];
}

interface Migration {
	object: string;
	id: string;
	uri: string;
	performed_at: string;
	migration_strategy: string;
	old_scryfall_id: string;
	new_scryfall_id: string;
	note: string;
	metadata: {
		id: string;
		lang: string;
		name: string;
		set_code: string;
		oracle_id: string;
		collector_number: string;
	};
}

interface MigrationsResponse {
	data: Migration[];
}

interface CardSymbol {
	object: string;
	symbol: string;
	svg_uri: string;
	english: string;
	represents_mana: boolean;
	appears_in_mana_costs: boolean;
}

interface SymbologyResponse {
	data: CardSymbol[];
}

type MigrationMap = Record<string, string>;

async function fetchJSON<T>(url: string): Promise<T> {
	console.log(`Fetching: ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	return response.json() as Promise<T>;
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
	console.log(`Downloading: ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	await mkdir(dirname(outputPath), { recursive: true });
	const arrayBuffer = await response.arrayBuffer();
	await writeFile(outputPath, Buffer.from(arrayBuffer));
	console.log(`Saved to: ${outputPath}`);
}

function filterCard(card: ScryfallCard): Card {
	const filtered: Record<string, unknown> = {
		id: asScryfallId(card.id),
		oracle_id: asOracleId(card.oracle_id),
		name: card.name,
	};

	for (const field of KEPT_FIELDS) {
		const value = card[field];
		if (value !== undefined && value !== null) {
			filtered[field] = value;
		}
	}

	return filtered as unknown as Card;
}

/**
 * Determines if a card printing matches Scryfall's is:default criteria.
 * Default = traditional frames (1993/1997/2003/2015), standard borders, no special treatments
 */
export function isDefaultPrinting(card: ScryfallCard): boolean {
	// Frame must be traditional (1993, 1997, 2003, or 2015)
	const validFrames = ["1993", "1997", "2003", "2015"];
	if (!card.frame || !validFrames.includes(card.frame)) {
		return false;
	}

	// Border must be black, white, or silver
	const validBorders = ["black", "white", "silver"];
	if (!card.border_color || !validBorders.includes(card.border_color)) {
		return false;
	}

	// Must not have special frame effects (extended art, showcase, borderless, etc)
	const invalidEffects = ["extendedart", "showcase", "inverted"];
	if (card.frame_effects?.some((fx) => invalidEffects.includes(fx))) {
		return false;
	}

	// Must not be full art or textless
	if (card.full_art) {
		return false;
	}

	// Exclude special promo types (serialized, doublerainbow, etc)
	// Note: some promos like prerelease, buyabox are considered "neutral" by Scryfall
	const invalidPromoTypes = [
		"serialized",
		"doublerainbow",
		"gilded",
		"confettifoil",
		"galaxyfoil",
		"textured",
	];
	if (card.promo_types?.some((pt) => invalidPromoTypes.includes(pt))) {
		return false;
	}

	// Finishes: prefer nonfoil or foil (exclude etched, special finishes)
	// Note: finishes is optional, so we're lenient here
	if (card.finishes) {
		const validFinishes = ["nonfoil", "foil"];
		const hasValidFinish = card.finishes.some((f) =>
			validFinishes.includes(f),
		);
		if (!hasValidFinish) {
			return false;
		}
	}

	return true;
}

/**
 * Comparator for selecting canonical card printings.
 * Priority: english > is:default > paper > highres > non-UB > black border > modern frame > newer > non-variant
 *
 * Accepts ScryfallCard (raw) to access fields like security_stamp before filtering.
 */
export function compareCards(a: ScryfallCard, b: ScryfallCard): number {
	// English first (essential for our use case)
	if (a.lang === "en" && b.lang !== "en") return -1;
	if (a.lang !== "en" && b.lang === "en") return 1;

	// Prefer is:default printings
	const aDefault = isDefaultPrinting(a);
	const bDefault = isDefaultPrinting(b);
	if (aDefault && !bDefault) return -1;
	if (!aDefault && bDefault) return 1;

	// Paper over digital-only (paper cards are more canonical)
	const aPaper = a.games?.includes("paper");
	const bPaper = b.games?.includes("paper");
	if (aPaper && !bPaper) return -1;
	if (!aPaper && bPaper) return 1;

	// Highres (image quality - digital-only may have better scans)
	if (a.highres_image && !b.highres_image) return -1;
	if (!a.highres_image && b.highres_image) return 1;

	// Non-Universes Beyond / non-planeswalker stamp (triangle = UB/crossover products)
	const aUB =
		a.promo_types?.includes("universesbeyond") ||
		a.security_stamp === "triangle";
	const bUB =
		b.promo_types?.includes("universesbeyond") ||
		b.security_stamp === "triangle";
	if (!aUB && bUB) return -1;
	if (aUB && !bUB) return 1;

	// Prefer black border over white/silver (aesthetic preference)
	const aBlack = a.border_color === "black";
	const bBlack = b.border_color === "black";
	if (aBlack && !bBlack) return -1;
	if (!aBlack && bBlack) return 1;

	// Prefer modern frames (2015 > 2003 > 1997 > 1993, "future" deprioritized)
	const getFrameRank = (frame: string | undefined): number => {
		if (!frame) return 100;
		if (frame === "future") return 99; // quirky futuresight aesthetic
		const year = parseInt(frame, 10);
		if (!isNaN(year)) return -year; // newer years = lower rank = preferred
		return -10000; // unknown non-numeric frame, assume it's new and prefer it
	};
	const aFrameRank = getFrameRank(a.frame);
	const bFrameRank = getFrameRank(b.frame);
	if (aFrameRank !== bFrameRank) return aFrameRank - bFrameRank;

	// Deprioritize The List (plst) and Secret Lair (sld) - specialty products
	const deprioritizedSets = ["plst", "sld"];
	const aDeprio = deprioritizedSets.includes(a.set ?? "");
	const bDeprio = deprioritizedSets.includes(b.set ?? "");
	if (!aDeprio && bDeprio) return -1;
	if (aDeprio && !bDeprio) return 1;

	// Newer (tiebreaker among similar quality printings)
	if (a.released_at && b.released_at && a.released_at !== b.released_at) {
		return b.released_at.localeCompare(a.released_at);
	}

	// Non-variant (variants are weird alternate versions)
	if (!a.variation && b.variation) return -1;
	if (a.variation && !b.variation) return 1;

	return 0;
}

interface ProcessedCards {
	data: CardDataOutput;
	indexesFilename: string;
	volatileFilename: string;
	chunkFilenames: string[];
}

async function writeManifest(
	indexesFilename: string,
	volatileFilename: string,
	chunkFilenames: string[],
	symbolNames: string[],
): Promise<void> {
	const tsContent = `/**
 * Auto-generated by scripts/download-scryfall.ts
 * Content-hashed filenames enable immutable caching.
 */

export const CARD_INDEXES = "${indexesFilename}";

export const CARD_VOLATILE = "${volatileFilename}";

export const CARD_CHUNKS = [\n${chunkFilenames.map((n) => `\t"${n}",\n`).join("")}] as const;

export const VALID_SYMBOLS: ReadonlySet<string> = new Set([\n${symbolNames.map((n) => `\t"${n}",\n`).join("")}]);
`;

	const tsPath = join(__dirname, "../src/lib/card-manifest.ts");
	await writeFile(tsPath, tsContent);
	console.log(`Wrote manifest: ${tsPath}`);
}

async function getCachedSymbolNames(): Promise<string[]> {
	const symbolsCachePath = join(TEMP_DIR, "symbols-cache.json");
	try {
		const cached = JSON.parse(await readFile(symbolsCachePath, "utf-8")) as string[];
		// Cache stores full symbols like "{W}", extract names
		return cached.map((s) => s.replace(/[{}]/g, "")).sort();
	} catch {
		console.warn("Warning: No cached symbols found, VALID_SYMBOLS will be empty");
		return [];
	}
}

async function processBulkData(offline: boolean): Promise<ProcessedCards> {
	await mkdir(TEMP_DIR, { recursive: true });
	const tempFile = join(TEMP_DIR, "cards-bulk.json");
	const versionPath = join(OUTPUT_DIR, "version.json");

	let version: string;

	if (offline) {
		console.log("Offline mode: using cached data");
		try {
			const existingVersion = JSON.parse(
				await readFile(versionPath, "utf-8"),
			) as { version: string; cardCount: number };
			version = existingVersion.version;
		} catch {
			// No version file, use placeholder
			version = "offline";
		}
	} else {
		// Get bulk data list
		const bulkData = await fetchJSON<BulkDataResponse>(
			"https://api.scryfall.com/bulk-data",
		);
		const defaultCards = bulkData.data.find((d) => d.type === "default_cards");

		if (!defaultCards) {
			throw new Error("Could not find default_cards bulk data");
		}

		console.log(`Remote version: ${defaultCards.updated_at}`);
		console.log(
			`Download size: ${(defaultCards.size / 1024 / 1024).toFixed(2)} MB`,
		);

		version = defaultCards.updated_at;

		try {
			const existingVersion = JSON.parse(
				await readFile(versionPath, "utf-8"),
			) as { version: string; cardCount: number };

			if (existingVersion.version === defaultCards.updated_at) {
				console.log(
					`✓ Already have latest version (${defaultCards.updated_at}), skipping Scryfall download`,
				);
				console.log("Using cached data for local processing...");
			} else {
				console.log(`Local version: ${existingVersion.version}`);
				console.log("Version changed, downloading update...");
				await downloadFile(defaultCards.download_uri, tempFile);
			}
		} catch {
			console.log("No local version found, downloading...");
			await downloadFile(defaultCards.download_uri, tempFile);
		}
	}

	// Parse and filter
	console.log("Processing cards...");
	const rawData: ScryfallCard[] = JSON.parse(await readFile(tempFile, "utf-8"));

	// Build raw card map for sorting (before filtering strips fields like security_stamp)
	const rawCardById = Object.fromEntries(rawData.map((card) => [card.id, card]));

	const cards = rawData.map(filterCard);
	console.log(`Filtered ${cards.length} cards`);

	// Build indexes
	console.log("Building indexes...");
	const cardById = Object.fromEntries(cards.map((card) => [card.id, card]));

	const oracleIdToPrintings = cards.reduce<CardDataOutput["oracleIdToPrintings"]>(
		(acc, card) => {
			if (!acc[card.oracle_id]) {
				acc[card.oracle_id] = [];
			}
			acc[card.oracle_id].push(card.id);
			return acc;
		},
		{},
	);

	// Sort printings by canonical order (most canonical first)
	// Uses raw cards for comparison (has fields like security_stamp that get stripped)
	// First element of each array is the canonical printing for that oracle ID
	// UI layers that need release date order (e.g., card detail page) can re-sort before rendering
	console.log("Sorting printings by canonical order...");
	for (const printingIds of Object.values(oracleIdToPrintings)) {
		printingIds.sort((aId, bId) =>
			compareCards(rawCardById[aId], rawCardById[bId]),
		);
	}

	const output: CardDataOutput = {
		version,
		cardCount: cards.length,
		cards: cardById,
		oracleIdToPrintings,
	};

	await mkdir(OUTPUT_DIR, { recursive: true });
	await mkdir(CARDS_DIR, { recursive: true });

	// Generate volatile data from raw data (before filtering strips prices/rank)
	const volatileFilename = await generateVolatileData(rawData);

	// Chunk cards for deployment
	console.log("Chunking cards for deployment...");
	const { chunkFilenames, indexesFilename } =
		await chunkCardsForWorkers(output);

	// Generate binary byte-range index for SSR
	console.log("Generating binary byte-range index for SSR...");
	await generateByteRangeIndex(chunkFilenames);

	return { data: output, indexesFilename, volatileFilename, chunkFilenames };
}

/**
 * Chunk cards into fixed-count chunks for stable cache boundaries
 *
 * All files are written to public/data/cards/ with content hashes in filenames
 * for immutable caching. This subfolder is configured for aggressive edge caching
 * via Cloudflare rules (TanStack Start doesn't support custom cache headers).
 *
 * Uses fixed card count per chunk (not byte size) so that card content changes
 * only affect the single chunk containing that card, not subsequent chunks.
 *
 * Cards are sorted by release date (oldest first) so new cards append to later chunks.
 *
 * Returns list of chunk filenames (without path prefix)
 */
async function chunkCardsForWorkers(
	data: CardDataOutput,
): Promise<{ chunkFilenames: string[]; indexesFilename: string }> {
	const CARDS_PER_CHUNK = 4096; // Fixed count for stable chunk boundaries
	const MAX_CHUNKS = 256; // Chunk index stored as u8 in byteindex

	// Sort cards by release date (oldest first) so new cards go to later chunks
	// Cards without dates go to the beginning (ancient weirdness, not future prereleases)
	const cardEntries = Object.entries(data.cards).sort(([idA, a], [idB, b]) => {
		const dateA = a.released_at ?? "0000-00-00";
		const dateB = b.released_at ?? "0000-00-00";
		const dateCompare = dateA.localeCompare(dateB);
		if (dateCompare !== 0) return dateCompare;
		// Stable tiebreaker: card ID (UUID) ensures consistent ordering
		return idA.localeCompare(idB);
	});

	const chunkCount = Math.ceil(cardEntries.length / CARDS_PER_CHUNK);
	if (chunkCount > MAX_CHUNKS) {
		throw new Error(
			`Too many chunks: ${chunkCount} exceeds max ${MAX_CHUNKS} (chunk index stored as u8)`,
		);
	}

	const chunkFilenames = await Promise.all(Array.from({length: chunkCount}, async (_, chunkIndex) => {
		const start = chunkIndex * CARDS_PER_CHUNK;
		const end = Math.min(start + CARDS_PER_CHUNK, cardEntries.length);
		const chunkEntries = cardEntries.slice(start, end);

		const chunkData = { cards: Object.fromEntries(chunkEntries) };
		const chunkContent = JSON.stringify(chunkData);
		const contentHash = createHash("sha256")
			.update(chunkContent)
			.digest("hex")
			.slice(0, 16);
		const chunkFilename = `cards-${String(chunkIndex).padStart(3, "0")}-${contentHash}.json`;
		
		await writeFile(join(CARDS_DIR, chunkFilename), chunkContent)
		console.log(
			`Wrote ${chunkFilename}: ${chunkEntries.length} cards, ${(chunkContent.length / 1024 / 1024).toFixed(2)}MB`,
		);

		return chunkFilename
	}))

	// Write indexes file with content hash (oracle mappings for client)
	// oracleIdToPrintings is sorted by canonical order - first element is the canonical printing
	const indexesData = {
		version: data.version,
		cardCount: data.cardCount,
		oracleIdToPrintings: data.oracleIdToPrintings,
	};
	const indexesContent = JSON.stringify(indexesData);
	const indexesHash = createHash("sha256")
		.update(indexesContent)
		.digest("hex")
		.slice(0, 16);
	const indexesFilename = `indexes-${indexesHash}.json`;
	const indexesPath = join(CARDS_DIR, indexesFilename);
	await writeFile(indexesPath, indexesContent);
	console.log(`Wrote indexes: ${indexesFilename}`);

	// Write version.json at top level for quick version checks
	const versionData = { version: data.version, cardCount: data.cardCount };
	await writeFile(join(OUTPUT_DIR, "version.json"), JSON.stringify(versionData));
	console.log(`Wrote version.json`);

	console.log(`\nTotal chunks: ${chunkFilenames.length}`);

	return { chunkFilenames, indexesFilename };
}

/**
 * Convert UUID string to 16-byte buffer
 * UUID format: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (36 chars with dashes)
 */
function uuidToBytes(uuid: string): Buffer {
	const hex = uuid.replace(/-/g, "");
	return Buffer.from(hex, "hex");
}

/**
 * Create a packer for writing sequential values to a buffer
 */
function createBufferPacker(buffer: Buffer) {
	let offset = 0;
	return {
		writeUUID(uuid: string) {
			uuidToBytes(uuid).copy(buffer, offset);
			offset += 16;
		},
		writeUint32(value: number) {
			buffer.writeUInt32LE(value, offset);
			offset += 4;
		},
		writeUint8(value: number) {
			buffer.writeUInt8(value, offset);
			offset += 1;
		},
	};
}

/**
 * Generate binary byte-range index for SSR card lookups
 * Format: Fixed-size binary records sorted by UUID for O(log n) binary search
 *
 * Record format (25 bytes per record):
 *   - UUID: 16 bytes (binary)
 *   - Chunk index: 1 byte (uint8, max 256 chunks)
 *   - Offset: 4 bytes (uint32 little-endian)
 *   - Length: 4 bytes (uint32 little-endian)
 *
 * Single-pass O(n) parser - reads each chunk file once to find card byte ranges
 */
async function generateByteRangeIndex(chunkFilenames: string[]): Promise<void> {
	interface CardIndex {
		cardId: string;
		chunkIndex: number;
		offset: number;
		length: number;
	}

	const indexes: CardIndex[] = [];

	for (let chunkIndex = 0; chunkIndex < chunkFilenames.length; chunkIndex++) {
		const chunkFilename = chunkFilenames[chunkIndex];
		const chunkPath = join(CARDS_DIR, chunkFilename);
		const chunkContent = await readFile(chunkPath, "utf-8");

		// Single-pass parse: find all "cardId":{...} patterns
		// Format: {"cards":{"card-id-1":{...},"card-id-2":{...}}}
		let cardCount = 0;
		let pos = 0;

		// Skip to start of cards object
		const cardsStart = chunkContent.indexOf('"cards":{');
		if (cardsStart === -1) {
			console.warn(`Warning: No cards object found in ${chunkFilename}`);
			continue;
		}

		pos = cardsStart + '"cards":{'.length;

		// Parse each card entry
		while (pos < chunkContent.length) {
			// Find next card ID (quoted string before colon)
			const quoteStart = chunkContent.indexOf('"', pos);
			if (quoteStart === -1) break;

			const quoteEnd = chunkContent.indexOf('"', quoteStart + 1);
			if (quoteEnd === -1) break;

			const cardId = chunkContent.slice(quoteStart + 1, quoteEnd);

			// Find colon after card ID
			const colon = chunkContent.indexOf(":", quoteEnd);
			if (colon === -1) break;

			// Value starts after colon
			const valueStart = colon + 1;

			// Find matching closing brace for card object
			// Need to track brace depth since card JSON contains nested objects
			let depth = 0;
			let valueEnd = valueStart;
			let inString = false;
			let escaped = false;

			for (let i = valueStart; i < chunkContent.length; i++) {
				const char = chunkContent[i];

				if (escaped) {
					escaped = false;
					continue;
				}

				if (char === "\\") {
					escaped = true;
					continue;
				}

				if (char === '"') {
					inString = !inString;
					continue;
				}

				if (!inString) {
					if (char === "{") {
						depth++;
					} else if (char === "}") {
						if (depth === 1) {
							// Found matching closing brace
							valueEnd = i;
							break;
						}
						depth--;
					}
				}
			}

			if (depth === 1 && valueEnd > valueStart) {
				const length = valueEnd - valueStart + 1;
				indexes.push({ cardId, chunkIndex, offset: valueStart, length });
				cardCount++;
			}

			// Move past this card entry (skip comma if present)
			pos = valueEnd + 1;
			if (chunkContent[pos] === ",") pos++;
		}

		console.log(`Indexed ${cardCount} cards from ${chunkFilename}`);
	}

	// Sort by UUID bytes (not string!) for binary search
	indexes.sort((a, b) => {
		const aBytes = uuidToBytes(a.cardId);
		const bBytes = uuidToBytes(b.cardId);
		for (let i = 0; i < 16; i++) {
			if (aBytes[i] !== bBytes[i]) {
				return aBytes[i] - bBytes[i];
			}
		}
		return 0;
	});

	// Write binary format
	const RECORD_SIZE = 25; // 16 (UUID) + 1 (chunk) + 4 (offset) + 4 (length)
	const buffer = Buffer.alloc(RECORD_SIZE * indexes.length);
	const packer = createBufferPacker(buffer);

	for (const { cardId, chunkIndex, offset, length } of indexes) {
		packer.writeUUID(cardId);
		packer.writeUint8(chunkIndex);
		packer.writeUint32(offset);
		packer.writeUint32(length);
	}

	const binPath = join(OUTPUT_DIR, "cards-byteindex.bin");
	await writeFile(binPath, buffer);

	const fileSize = buffer.length;
	console.log(
		`✓ Wrote binary byte-range index: ${binPath} (${indexes.length} cards, ${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
	);
	console.log(
		`  Binary format: 25 bytes/record (16 UUID + 1 chunk + 4 offset + 4 length)`,
	);
	console.log(
		`  Sorted by UUID for O(log n) binary search (${Math.ceil(Math.log2(indexes.length))} max seeks)`,
	);
}

/**
 * Generate volatile.bin containing frequently-changing card data
 *
 * This data (prices, EDHREC rank) changes often and would cause cache busting
 * if included in the main card chunks. Stored separately so card data stays stable.
 *
 * Format: Fixed-size binary records sorted by UUID for O(log n) binary search
 * Uses same UUID byte comparison as generateByteRangeIndex for consistency.
 *
 * Record format (44 bytes per record):
 *   - UUID: 16 bytes (binary)
 *   - edhrec_rank: 4 bytes (uint32 LE, 0xFFFFFFFF = null)
 *   - usd: 4 bytes (cents as uint32 LE, 0xFFFFFFFF = null)
 *   - usd_foil: 4 bytes
 *   - usd_etched: 4 bytes
 *   - eur: 4 bytes
 *   - eur_foil: 4 bytes
 *   - tix: 4 bytes (hundredths, e.g. 0.02 -> 2)
 */
async function generateVolatileData(rawCards: ScryfallCard[]): Promise<string> {
	console.log("Generating volatile data...");

	const RECORD_SIZE = 44; // 16 (UUID) + 4 (rank) + 6*4 (prices)
	const NULL_VALUE = 0xffffffff;

	// Parse price string to cents (hundredths), returns NULL_VALUE if null/invalid
	const parsePriceToCents = (price: string | null | undefined): number => {
		if (price == null) return NULL_VALUE;
		const parsed = parseFloat(price);
		if (isNaN(parsed)) return NULL_VALUE;
		return Math.round(parsed * 100);
	};

	// Extract volatile data from each card
	interface VolatileRecord {
		id: string;
		edhrec_rank: number;
		usd: number;
		usd_foil: number;
		usd_etched: number;
		eur: number;
		eur_foil: number;
		tix: number;
	}

	const records: VolatileRecord[] = rawCards.map((card) => {
		const prices = (card.prices ?? {}) as Record<string, string | null>;
		return {
			id: card.id,
			edhrec_rank:
				typeof card.edhrec_rank === "number" ? card.edhrec_rank : NULL_VALUE,
			usd: parsePriceToCents(prices.usd),
			usd_foil: parsePriceToCents(prices.usd_foil),
			usd_etched: parsePriceToCents(prices.usd_etched),
			eur: parsePriceToCents(prices.eur),
			eur_foil: parsePriceToCents(prices.eur_foil),
			tix: parsePriceToCents(prices.tix),
		};
	});

	// Sort by UUID bytes (not string!) for binary search - same as generateByteRangeIndex
	records.sort((a, b) => {
		const aBytes = uuidToBytes(a.id);
		const bBytes = uuidToBytes(b.id);
		for (let i = 0; i < 16; i++) {
			if (aBytes[i] !== bBytes[i]) {
				return aBytes[i] - bBytes[i];
			}
		}
		return 0;
	});

	// Write binary format
	const buffer = Buffer.alloc(RECORD_SIZE * records.length);
	const packer = createBufferPacker(buffer);

	for (const record of records) {
		packer.writeUUID(record.id);
		packer.writeUint32(record.edhrec_rank);
		packer.writeUint32(record.usd);
		packer.writeUint32(record.usd_foil);
		packer.writeUint32(record.usd_etched);
		packer.writeUint32(record.eur);
		packer.writeUint32(record.eur_foil);
		packer.writeUint32(record.tix);
	}

	// Hash the buffer for immutable filename
	const contentHash = createHash("sha256")
		.update(buffer)
		.digest("hex")
		.slice(0, 16);
	const volatileFilename = `volatile-${contentHash}.bin`;
	const binPath = join(CARDS_DIR, volatileFilename);
	await writeFile(binPath, buffer);

	console.log(
		`✓ Wrote ${volatileFilename}: ${records.length} cards, ${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
	);
	console.log(
		`  Binary format: 44 bytes/record (16 UUID + 4 rank + 24 prices)`,
	);

	return volatileFilename;
}

async function processMigrations(): Promise<MigrationMap> {
	console.log("Fetching migrations...");
	const migrations = await fetchJSON<MigrationsResponse>(
		"https://api.scryfall.com/migrations",
	);

	// Build old_scryfall_id -> new_scryfall_id mapping
	const migrationMap = Object.fromEntries(
		migrations.data.map((m) => [m.old_scryfall_id, m.new_scryfall_id]),
	);

	console.log(`Found ${Object.keys(migrationMap).length} migrations`);

	await mkdir(OUTPUT_DIR, { recursive: true });
	const outputPath = join(OUTPUT_DIR, "migrations.json");
	await writeFile(outputPath, JSON.stringify(migrationMap));
	console.log(`Wrote migrations to: ${outputPath}`);

	return migrationMap;
}

interface SymbolsResult {
	count: number;
	names: string[];
}

async function downloadSymbols(): Promise<SymbolsResult> {
	console.log("Fetching symbology...");
	const symbology = await fetchJSON<SymbologyResponse>(
		"https://api.scryfall.com/symbology",
	);

	console.log(`Found ${symbology.data.length} symbols`);

	// Extract symbol names (without braces) for the manifest whitelist
	// e.g., "{W}" -> "W", "{10}" -> "10", "{W/U}" -> "W/U"
	const symbolNames = symbology.data
		.map((s) => s.symbol.replace(/[{}]/g, ""))
		.sort();

	// Check if we already have these symbols
	const symbolsCachePath = join(TEMP_DIR, "symbols-cache.json");
	const currentSymbols = symbology.data.map((s) => s.symbol).sort();

	try {
		const cachedSymbols = JSON.parse(
			await readFile(symbolsCachePath, "utf-8"),
		) as string[];

		if (
			cachedSymbols.length === currentSymbols.length &&
			cachedSymbols.every((s, i) => s === currentSymbols[i])
		) {
			console.log(
				`✓ Already have latest symbols (${currentSymbols.length}), skipping download`,
			);
			return { count: currentSymbols.length, names: symbolNames };
		}

		console.log("Symbol list changed, downloading update...");
	} catch {
		console.log("No cached symbols found, downloading...");
	}

	await mkdir(SYMBOLS_DIR, { recursive: true });

	await Promise.all(
		symbology.data.map((symbol) => {
			const filename = symbol.symbol.replace(/[{}\/]/g, "").toLowerCase();
			const outputPath = join(SYMBOLS_DIR, `${filename}.svg`);
			return downloadFile(symbol.svg_uri, outputPath);
		}),
	);

	// Cache the symbol list
	await writeFile(symbolsCachePath, JSON.stringify(currentSymbols));

	console.log(`Downloaded ${symbology.data.length} symbol SVGs to: ${SYMBOLS_DIR}`);
	return { count: symbology.data.length, names: symbolNames };
}

async function main(): Promise<void> {
	try {
		const offline = process.argv.includes("--offline");

		console.log("=== Scryfall Data Download ===\n");

		if (offline) {
			console.log("Running in offline mode (reprocessing only)\n");
			const [cards, cachedSymbols] = await Promise.all([
				processBulkData(true),
				getCachedSymbolNames(),
			]);

			await writeManifest(
				cards.indexesFilename,
				cards.volatileFilename,
				cards.chunkFilenames,
				cachedSymbols,
			);

			console.log("\n=== Summary ===");
			console.log(`Cards: ${cards.data.cardCount.toLocaleString()}`);
			console.log(`Version: ${cards.data.version}`);
			console.log("\n✓ Done!");
		} else {
			const [cards, migrations, symbols] = await Promise.all([
				processBulkData(false),
				processMigrations(),
				downloadSymbols(),
			]);

			await writeManifest(
				cards.indexesFilename,
				cards.volatileFilename,
				cards.chunkFilenames,
				symbols.names,
			);

			console.log("\n=== Summary ===");
			console.log(`Cards: ${cards.data.cardCount.toLocaleString()}`);
			console.log(`Migrations: ${Object.keys(migrations).length.toLocaleString()}`);
			console.log(`Symbols: ${symbols.count.toLocaleString()}`);
			console.log(`Version: ${cards.data.version}`);
			console.log("\n✓ Done!");
		}
	} catch (error) {
		console.error(
			"\n✗ Error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

// Only run main() when executed directly (not when imported for tests)
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
