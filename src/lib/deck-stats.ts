import type {
	Card,
	ManaColor,
	ManaColorWithColorless,
} from "@/lib/scryfall-types";
import {
	type CardLookup,
	extractPrimaryType,
	extractSubtypes,
	getManaValueBucket,
} from "./deck-grouping";
import type { DeckCard } from "./deck-types";

export type SpeedCategory = "instant" | "sorcery";
export type SourceTempo = "immediate" | "delayed" | "bounce";

export type { CardLookup };

export interface ManaCurveData {
	bucket: string;
	permanents: number;
	spells: number;
	permanentCards: DeckCard[];
	spellCards: DeckCard[];
}

export interface ManaSymbolsData {
	color: ManaColorWithColorless;
	symbolCount: number;
	symbolPercent: number;
	immediateSourceCount: number;
	delayedSourceCount: number;
	bounceSourceCount: number;
	sourceCount: number;
	sourcePercent: number;
	symbolCards: DeckCard[];
	immediateSourceCards: DeckCard[];
	delayedSourceCards: DeckCard[];
	bounceSourceCards: DeckCard[];
	symbolDistribution: { bucket: string; count: number }[];
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
const MANA_COLORS_WITH_COLORLESS: ManaColorWithColorless[] = [
	"W",
	"U",
	"B",
	"R",
	"G",
	"C",
];

/**
 * Count mana symbols in a mana cost string.
 * Handles hybrid mana (counts both colors), phyrexian mana, colorless, and ignores generic/X costs.
 */
export function countManaSymbols(
	manaCost: string | undefined,
): Record<ManaColorWithColorless, number> {
	const counts: Record<ManaColorWithColorless, number> = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0,
		C: 0,
	};

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

		// Colorless mana requirement (C)
		if (symbol === "C") {
			counts.C++;
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

		// Ignore generic mana (numbers), X, S (snow), etc.
	}

	return counts;
}

/**
 * Determine how quickly a mana-producing card can produce mana.
 * - immediate: can tap right away (untapped lands, hasty dorks, normal artifacts)
 * - delayed: needs a turn (taplands, summoning sick creatures, ETB-tapped artifacts)
 * - bounce: bouncelands (enters tapped + returns a land)
 */
export function getSourceTempo(card: Card): SourceTempo {
	const typeLine = card.type_line ?? "";
	const oracleText = card.oracle_text ?? "";

	// "This X enters tapped" without "unless" = unconditional
	// "enters tapped unless" = conditional (checklands/fastlands), treat as untapped
	// "it enters tapped" after "If you don't" = conditional (shocklands), treat as untapped
	const entersTappedUnconditional =
		/this (land|artifact|creature) enters tapped(?! unless)/i.test(oracleText);
	const returnsLand = /return a land/i.test(oracleText);

	// Bouncelands: enters tapped AND returns a land
	if (entersTappedUnconditional && returnsLand) {
		return "bounce";
	}

	// Creatures first (before Land check) - handles Land Creatures like Dryad Arbor
	if (typeLine.includes("Creature")) {
		if (card.keywords?.includes("Haste")) {
			return "immediate";
		}
		// Exile from hand doesn't require being on battlefield
		if (/exile this (card|creature) from your hand/i.test(oracleText)) {
			return "immediate";
		}
		// ETB triggers fire immediately
		if (/when (this creature|it) enters.*add/i.test(oracleText)) {
			return "immediate";
		}
		// Sacrifice without tap bypasses summoning sickness
		if (/sacrifice this creature: add/i.test(oracleText)) {
			return "immediate";
		}
		// Sacrifice by creature type (e.g., "Sacrifice a Goblin: Add")
		// Check if any of the creature's types appear in a sacrifice pattern
		const subtypes = typeLine.split("—")[1]?.trim().split(" ") ?? [];
		for (const subtype of subtypes) {
			if (
				new RegExp(`sacrifice a ${subtype}: add`, "i").test(oracleText)
			) {
				return "immediate";
			}
		}
		// Creates tokens with sacrifice-for-mana abilities (e.g., Eldrazi Spawn/Scion, Treasure)
		if (
			/create.*token.*sacrifice this (creature|token): add/is.test(oracleText)
		) {
			return "immediate";
		}
		// Pay life for mana (no tap required, bypasses summoning sickness)
		if (/pay \d+ life: add/i.test(oracleText)) {
			return "immediate";
		}
		return "delayed";
	}

	// Lands (non-creature)
	if (typeLine.includes("Land")) {
		return entersTappedUnconditional ? "delayed" : "immediate";
	}

	// Artifacts can enter tapped
	if (typeLine.includes("Artifact")) {
		return entersTappedUnconditional ? "delayed" : "immediate";
	}

	// Everything else (enchantments, instants, sorceries)
	return "immediate";
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
 * Compute mana symbols vs mana sources breakdown with tempo analysis.
 */
export function computeManaSymbolsVsSources(
	cards: DeckCard[],
	lookup: CardLookup,
): ManaSymbolsData[] {
	type ColorKey = ManaColorWithColorless;
	const makeColorRecord = <T>(init: () => T): Record<ColorKey, T> => ({
		W: init(),
		U: init(),
		B: init(),
		R: init(),
		G: init(),
		C: init(),
	});

	const symbolCounts = makeColorRecord(() => 0);
	const immediateCounts = makeColorRecord(() => 0);
	const delayedCounts = makeColorRecord(() => 0);
	const bounceCounts = makeColorRecord(() => 0);
	const symbolCards = makeColorRecord<DeckCard[]>(() => []);
	const immediateCards = makeColorRecord<DeckCard[]>(() => []);
	const delayedCards = makeColorRecord<DeckCard[]>(() => []);
	const bounceCards = makeColorRecord<DeckCard[]>(() => []);
	const symbolDistributions = makeColorRecord<Map<string, number>>(
		() => new Map(),
	);

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Count mana symbols in cost
		const symbols = countManaSymbols(card.mana_cost);
		const bucket = getManaValueBucket(card.cmc);
		for (const color of MANA_COLORS_WITH_COLORLESS) {
			if (symbols[color] > 0) {
				symbolCounts[color] += symbols[color] * deckCard.quantity;
				symbolCards[color].push(deckCard);
				// Track distribution by CMC
				const dist = symbolDistributions[color];
				dist.set(
					bucket,
					(dist.get(bucket) ?? 0) + symbols[color] * deckCard.quantity,
				);
			}
		}

		// Count mana sources by tempo
		const producedColors = (card.produced_mana ?? []) as ColorKey[];
		if (producedColors.length > 0) {
			const tempo = getSourceTempo(card);
			for (const color of producedColors) {
				if (!MANA_COLORS_WITH_COLORLESS.includes(color)) continue;
				const qty = deckCard.quantity;
				switch (tempo) {
					case "immediate":
						immediateCounts[color] += qty;
						immediateCards[color].push(deckCard);
						break;
					case "delayed":
						delayedCounts[color] += qty;
						delayedCards[color].push(deckCard);
						break;
					case "bounce":
						bounceCounts[color] += qty;
						bounceCards[color].push(deckCard);
						break;
				}
			}
		}
	}

	// Calculate totals for percentages
	const totalSymbols = Object.values(symbolCounts).reduce((a, b) => a + b, 0);
	const totalSources = MANA_COLORS_WITH_COLORLESS.reduce(
		(sum, c) => sum + immediateCounts[c] + delayedCounts[c] + bounceCounts[c],
		0,
	);

	return MANA_COLORS_WITH_COLORLESS.map((color) => {
		const sourceCount =
			immediateCounts[color] + delayedCounts[color] + bounceCounts[color];

		// Convert distribution map to array
		const dist = symbolDistributions[color];
		const symbolDistribution = ["0", "1", "2", "3", "4", "5", "6", "7+"].map(
			(bucket) => ({ bucket, count: dist.get(bucket) ?? 0 }),
		);

		return {
			color,
			symbolCount: symbolCounts[color],
			symbolPercent:
				totalSymbols > 0 ? (symbolCounts[color] / totalSymbols) * 100 : 0,
			immediateSourceCount: immediateCounts[color],
			delayedSourceCount: delayedCounts[color],
			bounceSourceCount: bounceCounts[color],
			sourceCount,
			sourcePercent: totalSources > 0 ? (sourceCount / totalSources) * 100 : 0,
			symbolCards: symbolCards[color],
			immediateSourceCards: immediateCards[color],
			delayedSourceCards: delayedCards[color],
			bounceSourceCards: bounceCards[color],
			symbolDistribution,
		};
	});
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
