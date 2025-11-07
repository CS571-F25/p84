#!/usr/bin/env node --experimental-strip-types

/**
 * Downloads Scryfall bulk data and processes it for client use.
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
 * - src/lib/card-chunks.ts - TypeScript chunk manifest
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Card, CardDataOutput } from "../src/lib/scryfall-types.ts";
import { asScryfallId, asOracleId } from "../src/lib/scryfall-types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "../public/data");
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
	"prices",
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
	"edhrec_rank",
	"reprint",
	"variation",
	"lang",
	"content_warning",
] as const;

interface ScryfallCard {
	id: string;
	oracle_id: string;
	name: string;
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

	return filtered as Card;
}

/**
 * Determines if a card printing matches Scryfall's is:default criteria.
 * Default = traditional frames (1993/1997/2003/2015), standard borders, no special treatments
 */
export function isDefaultPrinting(card: Card): boolean {
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
 * Priority: english > is:default > paper > highres > newer > non-variant > non-UB
 */
export function compareCards(a: Card, b: Card): number {
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

	// Highres (image quality matters more than recency)
	if (a.highres_image && !b.highres_image) return -1;
	if (!a.highres_image && b.highres_image) return 1;

	// Newer (tiebreaker among similar quality printings)
	if (a.released_at && b.released_at && a.released_at !== b.released_at) {
		return b.released_at.localeCompare(a.released_at);
	}

	// Non-variant (variants are weird alternate versions)
	if (!a.variation && b.variation) return -1;
	if (a.variation && !b.variation) return 1;

	// Non-Universes Beyond (subjective UX preference)
	const aUB = a.promo_types?.includes("universesbeyond");
	const bUB = b.promo_types?.includes("universesbeyond");
	if (!aUB && bUB) return -1;
	if (aUB && !bUB) return 1;

	return 0;
}

async function processBulkData(): Promise<CardDataOutput> {
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

	// Check if we already have this version
	await mkdir(TEMP_DIR, { recursive: true });
	const tempFile = join(TEMP_DIR, "cards-bulk.json");
	const indexesPath = join(OUTPUT_DIR, "cards-indexes.json");

	try {
		const existingIndexes = JSON.parse(
			await readFile(indexesPath, "utf-8"),
		) as { version: string; cardCount: number };

		if (existingIndexes.version === defaultCards.updated_at) {
			console.log(
				`✓ Already have latest version (${defaultCards.updated_at}), skipping Scryfall download`,
			);
			console.log("Using cached data for local processing...");
		} else {
			console.log(`Local version: ${existingIndexes.version}`);
			console.log("Version changed, downloading update...");
			await downloadFile(defaultCards.download_uri, tempFile);
		}
	} catch {
		console.log("No local version found, downloading...");
		await downloadFile(defaultCards.download_uri, tempFile);
	}

	// Parse and filter
	console.log("Processing cards...");
	const rawData: ScryfallCard[] = JSON.parse(await readFile(tempFile, "utf-8"));

	const cards = rawData.map(filterCard);
	console.log(`Filtered ${cards.length} cards`);

	// Build indexes
	console.log("Building indexes...");
	const cardById = Object.fromEntries(cards.map((card) => [card.id, card]));

	const oracleIdToPrintings = cards.reduce<CardDataOutput['oracleIdToPrintings']>(
		(acc, card) => {
			if (!acc[card.oracle_id]) {
				acc[card.oracle_id] = [];
			}
			acc[card.oracle_id].push(card.id);
			return acc;
		},
		{},
	);

	// Calculate canonical printing for each oracle ID
	// Follows Scryfall's is:default logic: prefer most recent "default" printing
	// Priority: english > is:default > paper > highres > newer > non-variant > non-UB
	console.log("Calculating canonical printings...");

	const canonicalPrintingByOracleId = Object.fromEntries(
		Object.entries(oracleIdToPrintings).map(([oracleId, printingIds]) => {
			const sortedIds = [...printingIds].sort((aId, bId) => {
				return compareCards(cardById[aId], cardById[bId]);
			});
			return [oracleId, sortedIds[0]];
		}),
	);

	const output: CardDataOutput = {
		version: defaultCards.updated_at,
		cardCount: cards.length,
		cards: cardById,
		oracleIdToPrintings,
		canonicalPrintingByOracleId,
	};

	await mkdir(OUTPUT_DIR, { recursive: true });

	// Chunk cards.json for Cloudflare Workers (25MB upload limit)
	console.log("Chunking cards for Workers deployment...");
	const chunkFilenames = await chunkCardsForWorkers(output);

	// Generate byte-range CSV index for SSR
	console.log("Generating byte-range index for SSR...");
	await generateByteRangeCSV(chunkFilenames);

	return output;
}

/**
 * Chunk cards.json into sub-25MB files for Cloudflare Workers deployment
 * Returns list of chunk filenames
 */
async function chunkCardsForWorkers(data: CardDataOutput): Promise<string[]> {
	const CHUNK_SIZE_TARGET = 20 * 1024 * 1024; // 20MB target (leaving headroom under 25MB limit)

	const cardEntries = Object.entries(data.cards);
	const chunkFilenames: string[] = [];

	let currentChunk: [string, Card][] = [];
	let currentSize = 0;
	let chunkIndex = 0;

	// Helper to estimate JSON size
	const estimateSize = (obj: unknown): number => {
		return JSON.stringify(obj).length;
	};

	// Initial chunk wrapper overhead
	const chunkOverhead = estimateSize({ cards: {} });

	for (const [cardId, card] of cardEntries) {
		const entrySize = estimateSize({ [cardId]: card });

		// Check if adding this card would exceed the target
		if (
			currentSize + entrySize + chunkOverhead > CHUNK_SIZE_TARGET &&
			currentChunk.length > 0
		) {
			// Write current chunk
			const chunkFilename = `cards-${String(chunkIndex).padStart(3, "0")}.json`;
			const chunkPath = join(OUTPUT_DIR, chunkFilename);
			const chunkData = {
				cards: Object.fromEntries(currentChunk),
			};
			const chunkContent = JSON.stringify(chunkData);

			await writeFile(chunkPath, chunkContent);
			chunkFilenames.push(chunkFilename);

			console.log(
				`Wrote ${chunkFilename}: ${currentChunk.length} cards, ${(chunkContent.length / 1024 / 1024).toFixed(2)}MB`,
			);

			// Reset for next chunk
			currentChunk = [];
			currentSize = 0;
			chunkIndex++;
		}

		currentChunk.push([cardId, card]);
		currentSize += entrySize;
	}

	// Write final chunk if there's anything left
	if (currentChunk.length > 0) {
		const chunkFilename = `cards-${String(chunkIndex).padStart(3, "0")}.json`;
		const chunkPath = join(OUTPUT_DIR, chunkFilename);
		const chunkData = {
			cards: Object.fromEntries(currentChunk),
		};
		const chunkContent = JSON.stringify(chunkData);

		await writeFile(chunkPath, chunkContent);
		chunkFilenames.push(chunkFilename);

		console.log(
			`Wrote ${chunkFilename}: ${currentChunk.length} cards, ${(chunkContent.length / 1024 / 1024).toFixed(2)}MB`,
		);
	}

	// Write indexes file (oracle mappings for client)
	const indexesData = {
		version: data.version,
		cardCount: data.cardCount,
		oracleIdToPrintings: data.oracleIdToPrintings,
		canonicalPrintingByOracleId: data.canonicalPrintingByOracleId,
	};

	const indexesPath = join(OUTPUT_DIR, "cards-indexes.json");
	await writeFile(indexesPath, JSON.stringify(indexesData));
	console.log(`Wrote indexes: ${indexesPath}`);

	// Write TS file with chunk list (just filenames, not indexes - those are too big)
	const tsContent = `/**
 * Auto-generated by scripts/download-scryfall.ts
 * Contains card data chunk filenames for client loading
 */

export const CARD_CHUNKS = ${JSON.stringify(chunkFilenames, null, 2)} as const;
`;

	const tsPath = join(__dirname, "../src/lib/card-chunks.ts");
	await writeFile(tsPath, tsContent);

	console.log(`\nWrote TS chunk list: ${tsPath}`);
	console.log(`Total chunks: ${chunkFilenames.length}`);

	return chunkFilenames;
}

/**
 * Generate byte-range CSV index for SSR card lookups
 * Format: Fixed-width records sorted by cardId for O(log n) binary search
 *
 * Record format (64 bytes per line including newline):
 *   cardId (36 chars, UUID) | chunkIndex (2 chars) | offset (10 chars) | length (6 chars)
 *   Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890,07,0012345678,012345\n"
 *
 * Single-pass O(n) parser - reads each chunk file once to find card byte ranges
 */
async function generateByteRangeCSV(chunkFilenames: string[]): Promise<void> {
	interface CardIndex {
		cardId: string;
		chunkIndex: number;
		offset: number;
		length: number;
	}

	const indexes: CardIndex[] = [];

	for (let chunkIndex = 0; chunkIndex < chunkFilenames.length; chunkIndex++) {
		const chunkFilename = chunkFilenames[chunkIndex];
		const chunkPath = join(OUTPUT_DIR, chunkFilename);
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
			const colon = chunkContent.indexOf(':', quoteEnd);
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

				if (char === '\\') {
					escaped = true;
					continue;
				}

				if (char === '"') {
					inString = !inString;
					continue;
				}

				if (!inString) {
					if (char === '{') {
						depth++;
					} else if (char === '}') {
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
			if (chunkContent[pos] === ',') pos++;
		}

		console.log(`Indexed ${cardCount} cards from ${chunkFilename}`);
	}

	// Sort by cardId for binary search
	indexes.sort((a, b) => a.cardId.localeCompare(b.cardId));

	// Write fixed-width records
	const records: string[] = [];
	for (const { cardId, chunkIndex, offset, length } of indexes) {
		// Format: "cardId,CC,OOOOOOOOOO,LLLLLL\n" (36+1+2+1+10+1+6+1 = 58 bytes + padding)
		const record = `${cardId},${String(chunkIndex).padStart(2, "0")},${String(offset).padStart(10, "0")},${String(length).padStart(6, "0")}`;
		records.push(record);
	}

	const csvPath = join(OUTPUT_DIR, "cards-byteindex.csv");
	await writeFile(csvPath, records.join("\n"));

	const fileSize = records.join("\n").length;
	console.log(
		`✓ Wrote byte-range index: ${csvPath} (${indexes.length} cards, ${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
	);
	console.log(
		`  Sorted by cardId for O(log n) binary search (${Math.ceil(Math.log2(indexes.length))} max seeks)`,
	);
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

async function downloadSymbols(): Promise<number> {
	console.log("Fetching symbology...");
	const symbology = await fetchJSON<SymbologyResponse>(
		"https://api.scryfall.com/symbology",
	);

	console.log(`Found ${symbology.data.length} symbols`);

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
			return currentSymbols.length;
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
	return symbology.data.length;
}

async function main(): Promise<void> {
	try {
		console.log("=== Scryfall Data Download ===\n");

		const [cardsData, migrations, symbolCount] = await Promise.all([
			processBulkData(),
			processMigrations(),
			downloadSymbols(),
		]);

		console.log("\n=== Summary ===");
		console.log(`Cards: ${cardsData.cardCount.toLocaleString()}`);
		console.log(`Migrations: ${Object.keys(migrations).length.toLocaleString()}`);
		console.log(`Symbols: ${symbolCount.toLocaleString()}`);
		console.log(`Version: ${cardsData.version}`);
		console.log("\n✓ Done!");
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
