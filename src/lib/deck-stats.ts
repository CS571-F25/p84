import type { Card, ManaColor } from "@/lib/scryfall-types";
import {
	type CardLookup,
	extractPrimaryType,
	extractSubtypes,
	getManaValueBucket,
} from "./deck-grouping";
import type { DeckCard } from "./deck-types";

export type SpeedCategory = "instant" | "sorcery";

export type { CardLookup };

export interface ManaCurveData {
	bucket: string;
	permanents: number;
	spells: number;
	permanentCards: DeckCard[];
	spellCards: DeckCard[];
}

export interface ManaSymbolsData {
	color: ManaColor;
	symbolCount: number;
	symbolPercent: number;
	sourceCount: number;
	sourcePercent: number;
	symbolCards: DeckCard[];
	sourceCards: DeckCard[];
}

export interface TypeData {
	type: string;
	count: number;
	cards: DeckCard[];
}

export interface SpeedData {
	category: SpeedCategory;
	count: number;
	cards: DeckCard[];
}

const MANA_COLORS: ManaColor[] = ["W", "U", "B", "R", "G"];

/**
 * Count mana symbols in a mana cost string.
 * Handles hybrid mana (counts both colors), phyrexian mana, and ignores generic/X costs.
 */
export function countManaSymbols(
	manaCost: string | undefined,
): Record<ManaColor, number> {
	const counts: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };

	if (!manaCost) return counts;

	// Match all symbols in braces
	const matches = manaCost.matchAll(/\{([^}]+)\}/g);

	for (const match of matches) {
		const symbol = match[1];

		// Single color symbol (W, U, B, R, G)
		if (MANA_COLORS.includes(symbol as ManaColor)) {
			counts[symbol as ManaColor]++;
			continue;
		}

		// Hybrid mana (W/U, U/B, etc.) - count both colors
		const hybridMatch = symbol.match(/^([WUBRG])\/([WUBRG])$/);
		if (hybridMatch) {
			counts[hybridMatch[1] as ManaColor]++;
			counts[hybridMatch[2] as ManaColor]++;
			continue;
		}

		// Phyrexian mana (W/P, U/P, etc.) - count the color
		const phyrexianMatch = symbol.match(/^([WUBRG])\/P$/);
		if (phyrexianMatch) {
			counts[phyrexianMatch[1] as ManaColor]++;
			continue;
		}

		// Hybrid phyrexian (2/W, 2/U, etc.) - count the color
		const hybridPhyrexianMatch = symbol.match(/^2\/([WUBRG])$/);
		if (hybridPhyrexianMatch) {
			counts[hybridPhyrexianMatch[1] as ManaColor]++;
		}

		// Ignore generic mana (numbers), X, C (colorless), S (snow), etc.
	}

	return counts;
}

/**
 * Extract mana colors a card can produce from its oracle text.
 * Looks for "Add {X}" patterns and handles "any color" text.
 */
export function extractManaProduction(card: Card): ManaColor[] {
	const oracleText = card.oracle_text;
	if (!oracleText) return [];

	const colors = new Set<ManaColor>();

	// Check for "any color" patterns
	if (
		/add\s+(?:one\s+)?mana\s+of\s+any\s+(?:one\s+)?color/i.test(oracleText) ||
		/add\s+\w+\s+mana\s+(?:of\s+)?(?:any\s+)?(?:one\s+)?(?:color|type)/i.test(
			oracleText,
		)
	) {
		return [...MANA_COLORS];
	}

	// Look for "Add" followed by mana symbols anywhere on the same line
	// This handles various formats like:
	// - "{T}: Add {G}."
	// - "Add {W} or {U}."
	// - "({T}: Add {G}, {W}, or {U}.)"
	const lines = oracleText.split("\n");
	for (const line of lines) {
		if (/\badd\b/i.test(line)) {
			// Extract all colored mana symbols from this line
			for (const symbolMatch of line.matchAll(/\{([WUBRG])\}/g)) {
				colors.add(symbolMatch[1] as ManaColor);
			}
		}
	}

	return [...colors];
}

/**
 * Determine if a card can be cast at instant speed.
 */
export function getSpeedCategory(card: Card): SpeedCategory {
	// Instants are instant speed
	if (card.type_line?.includes("Instant")) {
		return "instant";
	}

	// Cards with Flash keyword are instant speed
	if (card.keywords?.includes("Flash")) {
		return "instant";
	}

	// Everything else is sorcery speed
	return "sorcery";
}

/**
 * Check if a card type line represents a permanent.
 */
export function isPermanent(typeLine: string | undefined): boolean {
	if (!typeLine) return false;

	const permanentTypes = [
		"Creature",
		"Artifact",
		"Enchantment",
		"Planeswalker",
		"Battle",
		"Land",
	];

	return permanentTypes.some((type) => typeLine.includes(type));
}

/**
 * Compute mana curve data for a set of cards.
 * Groups cards by CMC bucket and separates permanents from spells.
 */
export function computeManaCurve(
	cards: DeckCard[],
	lookup: CardLookup,
): ManaCurveData[] {
	const buckets = new Map<
		string,
		{
			permanentCards: DeckCard[];
			spellCards: DeckCard[];
		}
	>();

	// Initialize buckets 0-7+
	for (let i = 0; i <= 6; i++) {
		buckets.set(i.toString(), { permanentCards: [], spellCards: [] });
	}
	buckets.set("7+", { permanentCards: [], spellCards: [] });

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		const bucket = getManaValueBucket(card.cmc);
		const data = buckets.get(bucket) ?? { permanentCards: [], spellCards: [] };

		// Add card quantity times (each copy counts)
		for (let i = 0; i < deckCard.quantity; i++) {
			if (isPermanent(card.type_line)) {
				data.permanentCards.push(deckCard);
			} else {
				data.spellCards.push(deckCard);
			}
		}

		buckets.set(bucket, data);
	}

	// Convert to array, preserving order
	const result: ManaCurveData[] = [];
	for (let i = 0; i <= 6; i++) {
		const bucket = i.toString();
		const data = buckets.get(bucket) ?? { permanentCards: [], spellCards: [] };
		result.push({
			bucket,
			permanents: data.permanentCards.length,
			spells: data.spellCards.length,
			permanentCards: data.permanentCards,
			spellCards: data.spellCards,
		});
	}

	const sevenPlus = buckets.get("7+") ?? { permanentCards: [], spellCards: [] };
	result.push({
		bucket: "7+",
		permanents: sevenPlus.permanentCards.length,
		spells: sevenPlus.spellCards.length,
		permanentCards: sevenPlus.permanentCards,
		spellCards: sevenPlus.spellCards,
	});

	return result;
}

/**
 * Compute mana symbols vs mana sources breakdown.
 */
export function computeManaSymbolsVsSources(
	cards: DeckCard[],
	lookup: CardLookup,
): ManaSymbolsData[] {
	const symbolCounts: Record<ManaColor, number> = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0,
	};
	const sourceCounts: Record<ManaColor, number> = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0,
	};
	const symbolCards: Record<ManaColor, DeckCard[]> = {
		W: [],
		U: [],
		B: [],
		R: [],
		G: [],
	};
	const sourceCards: Record<ManaColor, DeckCard[]> = {
		W: [],
		U: [],
		B: [],
		R: [],
		G: [],
	};

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Count mana symbols in cost
		const symbols = countManaSymbols(card.mana_cost);
		for (const color of MANA_COLORS) {
			if (symbols[color] > 0) {
				symbolCounts[color] += symbols[color] * deckCard.quantity;
				symbolCards[color].push(deckCard);
			}
		}

		// Count mana sources
		const producedColors = extractManaProduction(card);
		for (const color of producedColors) {
			sourceCounts[color] += deckCard.quantity;
			sourceCards[color].push(deckCard);
		}
	}

	// Calculate totals for percentages
	const totalSymbols = Object.values(symbolCounts).reduce((a, b) => a + b, 0);
	const totalSources = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

	return MANA_COLORS.map((color) => ({
		color,
		symbolCount: symbolCounts[color],
		symbolPercent:
			totalSymbols > 0 ? (symbolCounts[color] / totalSymbols) * 100 : 0,
		sourceCount: sourceCounts[color],
		sourcePercent:
			totalSources > 0 ? (sourceCounts[color] / totalSources) * 100 : 0,
		symbolCards: symbolCards[color],
		sourceCards: sourceCards[color],
	}));
}

/**
 * Compute card type distribution.
 */
export function computeTypeDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): TypeData[] {
	const types = new Map<string, { count: number; cards: DeckCard[] }>();

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		const type = extractPrimaryType(card.type_line);

		const data = types.get(type) ?? { count: 0, cards: [] };
		data.count += deckCard.quantity;
		data.cards.push(deckCard);
		types.set(type, data);
	}

	// Sort by count descending
	return [...types.entries()]
		.map(([type, data]) => ({
			type,
			count: data.count,
			cards: data.cards,
		}))
		.sort((a, b) => b.count - a.count);
}

/**
 * Compute subtype distribution.
 * Limits to top 10 subtypes with "Other" bucket.
 */
export function computeSubtypeDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): TypeData[] {
	const subtypes = new Map<string, { count: number; cards: DeckCard[] }>();

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		const cardSubtypes = extractSubtypes(card.type_line);

		for (const subtype of cardSubtypes) {
			const data = subtypes.get(subtype) ?? { count: 0, cards: [] };
			data.count += deckCard.quantity;
			data.cards.push(deckCard);
			subtypes.set(subtype, data);
		}
	}

	// Sort by count descending
	const sorted = [...subtypes.entries()]
		.map(([type, data]) => ({
			type,
			count: data.count,
			cards: data.cards,
		}))
		.sort((a, b) => b.count - a.count);

	// Limit to top 10, rest goes to "Other"
	if (sorted.length <= 10) {
		return sorted;
	}

	const top10 = sorted.slice(0, 10);
	const rest = sorted.slice(10);

	const otherCount = rest.reduce((sum, item) => sum + item.count, 0);
	const otherCards = rest.flatMap((item) => item.cards);

	if (otherCount > 0) {
		top10.push({
			type: "Other",
			count: otherCount,
			cards: otherCards,
		});
	}

	return top10;
}

/**
 * Compute speed distribution (instant vs sorcery speed).
 */
export function computeSpeedDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): SpeedData[] {
	const instant: DeckCard[] = [];
	const sorcery: DeckCard[] = [];
	let instantCount = 0;
	let sorceryCount = 0;

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		const speed = getSpeedCategory(card);

		if (speed === "instant") {
			instant.push(deckCard);
			instantCount += deckCard.quantity;
		} else {
			sorcery.push(deckCard);
			sorceryCount += deckCard.quantity;
		}
	}

	return [
		{ category: "instant", count: instantCount, cards: instant },
		{ category: "sorcery", count: sorceryCount, cards: sorcery },
	];
}
