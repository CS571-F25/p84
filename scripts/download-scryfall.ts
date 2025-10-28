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
 * - public/data/cards.json - filtered card data with indexes
 * - public/data/migrations.json - ID migration mappings
 * - public/symbols/*.svg - mana symbol images
 */

import { writeFile, mkdir, readFile, stat } from "node:fs/promises";
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

type KeptField = (typeof KEPT_FIELDS)[number];

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
	const filtered: Card = {
		id: asScryfallId(card.id),
		oracle_id: asOracleId(card.oracle_id),
		name: card.name,
	};

	for (const field of KEPT_FIELDS) {
		if (card[field] !== undefined) {
			filtered[field] = card[field];
		}
	}

	return filtered;
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

	console.log(`Bulk data updated at: ${defaultCards.updated_at}`);
	console.log(
		`Download size: ${(defaultCards.size / 1024 / 1024).toFixed(2)} MB`,
	);

	// Download bulk data
	await mkdir(TEMP_DIR, { recursive: true });
	const tempFile = join(TEMP_DIR, "cards-bulk.json");
	await downloadFile(defaultCards.download_uri, tempFile);

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

	// Write output
	await mkdir(OUTPUT_DIR, { recursive: true });
	const outputPath = join(OUTPUT_DIR, "cards.json");
	await writeFile(outputPath, JSON.stringify(output));
	console.log(`Wrote cards to: ${outputPath}`);

	const stats = await stat(outputPath);
	console.log(`Output size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

	return output;
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

	await mkdir(SYMBOLS_DIR, { recursive: true });

	await Promise.all(
		symbology.data.map((symbol) => {
			const filename = symbol.symbol.replace(/[{}\/]/g, "").toLowerCase();
			const outputPath = join(SYMBOLS_DIR, `${filename}.svg`);
			return downloadFile(symbol.svg_uri, outputPath);
		}),
	);

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
