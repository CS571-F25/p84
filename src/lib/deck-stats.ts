import type {
	Card,
	ManaColor,
	ManaColorWithColorless,
} from "@/lib/scryfall-types";
import {
	getCastableFaces,
	getFaceManaValue,
	getPrimaryFace,
} from "./card-faces";
import {
	type CardLookup,
	extractPrimaryType,
	extractSubtypes,
	getManaValueBucket,
} from "./deck-grouping";
import type { DeckCard } from "./deck-types";

export type SpeedCategory = "instant" | "sorcery";
export type SourceTempo = "immediate" | "conditional" | "delayed" | "bounce";

export type { CardLookup };

/**
 * A card reference with the specific face that matched the stat criteria.
 * faceIdx 0 = front/primary face, 1 = back/secondary face.
 */
export interface FacedCard {
	card: DeckCard;
	faceIdx: number;
}

export interface ManaCurveData {
	bucket: string;
	permanents: number;
	spells: number;
	permanentCards: FacedCard[];
	spellCards: FacedCard[];
}

export interface ManaSymbolsData {
	color: ManaColorWithColorless;
	symbolCount: number;
	symbolPercent: number;
	immediateSourceCount: number;
	conditionalSourceCount: number;
	delayedSourceCount: number;
	bounceSourceCount: number;
	sourceCount: number;
	sourcePercent: number;
	// Land-specific stats (for moxfield-style breakdown)
	landSourceCount: number;
	landSourcePercent: number; // % of lands that produce this color
	landProductionPercent: number; // % of total land production that is this color
	totalLandCount: number; // actual count of mana-producing lands (for display)
	// Land tempo breakdown
	landImmediateCount: number;
	landConditionalCount: number;
	landDelayedCount: number;
	landBounceCount: number;
	symbolCards: FacedCard[];
	immediateSourceCards: FacedCard[];
	conditionalSourceCards: FacedCard[];
	delayedSourceCards: FacedCard[];
	bounceSourceCards: FacedCard[];
	landSourceCards: FacedCard[];
	symbolDistribution: { bucket: string; count: number }[];
}

export interface TypeData {
	type: string;
	count: number;
	cards: FacedCard[];
}

export interface SpeedData {
	category: SpeedCategory;
	count: number;
	cards: FacedCard[];
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
 * - conditional: might enter tapped depending on game state (battle lands, check lands, fast lands)
 * - delayed: needs a turn (taplands, summoning sick creatures, ETB-tapped artifacts)
 * - bounce: bouncelands (enters tapped + returns a land)
 */
export function getSourceTempo(card: Card): SourceTempo {
	const typeLine = card.type_line ?? "";
	const oracleText = card.oracle_text ?? "";

	// Detect enters-tapped patterns
	// "This X enters tapped" without "unless" = unconditional (always delayed)
	// "enters tapped unless" = conditional (checklands/fastlands/battlelands - depends on game state)
	// "As X enters, you may pay" + "If you don't, it enters tapped" = immediate (shocklands - you can always pay life)
	const entersTappedUnconditional =
		/this (land|artifact|creature) enters tapped(?! unless)/i.test(oracleText);
	// Shocklands let you pay life (a choice you always have) - these are immediate
	const isPayLifeChoice = /as .* enters.*you may pay.*life/i.test(oracleText);
	// Game-state conditional: battle lands (2+ basics), check lands (land types), fast lands (2 or fewer lands)
	const entersTappedConditional =
		!isPayLifeChoice &&
		/this (land|artifact|creature) enters tapped unless/i.test(oracleText);
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
			if (new RegExp(`sacrifice a ${subtype}: add`, "i").test(oracleText)) {
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
		if (entersTappedUnconditional) return "delayed";
		if (entersTappedConditional) return "conditional";
		return "immediate";
	}

	// Artifacts can enter tapped
	if (typeLine.includes("Artifact")) {
		if (entersTappedUnconditional) return "delayed";
		if (entersTappedConditional) return "conditional";
		return "immediate";
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
 *
 * For multi-faced cards (MDFC, split, adventure), each castable face
 * appears at its own mana value. Land faces are skipped.
 */
export function computeManaCurve(
	cards: DeckCard[],
	lookup: CardLookup,
): ManaCurveData[] {
	const buckets = new Map<
		string,
		{
			permanentCards: FacedCard[];
			spellCards: FacedCard[];
		}
	>();

	let maxCmc = 0;

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		const faces = getCastableFaces(card);
		for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			const face = faces[faceIdx];
			const typeLine = face.type_line ?? "";

			// Skip pure lands (but keep land creatures like Dryad Arbor)
			if (typeLine.includes("Land") && !typeLine.includes("Creature")) continue;

			const mv = getFaceManaValue(face, card, faceIdx);
			const bucket = getManaValueBucket(mv);
			const cmcNum = Number.parseInt(bucket, 10);
			if (cmcNum > maxCmc) maxCmc = cmcNum;

			const data = buckets.get(bucket) ?? {
				permanentCards: [],
				spellCards: [],
			};

			const facedCard: FacedCard = { card: deckCard, faceIdx };

			// Add card quantity times (each copy counts)
			for (let i = 0; i < deckCard.quantity; i++) {
				if (isPermanent(typeLine)) {
					data.permanentCards.push(facedCard);
				} else {
					data.spellCards.push(facedCard);
				}
			}

			buckets.set(bucket, data);
		}
	}

	// Build contiguous array from 0 to maxCmc
	const result: ManaCurveData[] = [];
	for (let i = 0; i <= maxCmc; i++) {
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
	const conditionalCounts = makeColorRecord(() => 0);
	const delayedCounts = makeColorRecord(() => 0);
	const bounceCounts = makeColorRecord(() => 0);
	const landCounts = makeColorRecord(() => 0);
	const landImmediateCounts = makeColorRecord(() => 0);
	const landConditionalCounts = makeColorRecord(() => 0);
	const landDelayedCounts = makeColorRecord(() => 0);
	const landBounceCounts = makeColorRecord(() => 0);
	const symbolCards = makeColorRecord<FacedCard[]>(() => []);
	const immediateCards = makeColorRecord<FacedCard[]>(() => []);
	const conditionalCards = makeColorRecord<FacedCard[]>(() => []);
	const delayedCards = makeColorRecord<FacedCard[]>(() => []);
	const bounceCards = makeColorRecord<FacedCard[]>(() => []);
	const landCards = makeColorRecord<FacedCard[]>(() => []);
	const symbolDistributions = makeColorRecord<Map<string, number>>(
		() => new Map(),
	);
	let totalLandCount = 0;

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Count mana symbols from all castable faces
		const faces = getCastableFaces(card);
		for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			const face = faces[faceIdx];
			const symbols = countManaSymbols(face.mana_cost);
			const mv = getFaceManaValue(face, card, faceIdx);
			const bucket = getManaValueBucket(mv);

			const facedCard: FacedCard = { card: deckCard, faceIdx };

			for (const color of MANA_COLORS_WITH_COLORLESS) {
				if (symbols[color] > 0) {
					symbolCounts[color] += symbols[color] * deckCard.quantity;
					symbolCards[color].push(facedCard);
					// Track distribution by MV
					const dist = symbolDistributions[color];
					dist.set(
						bucket,
						(dist.get(bucket) ?? 0) + symbols[color] * deckCard.quantity,
					);
				}
			}
		}

		// Count mana sources by tempo (card-level property, not face-level)
		// For sources, we use faceIdx 0 since produced_mana is card-level
		const producedColors = (card.produced_mana ?? []) as ColorKey[];
		const primaryFace = getPrimaryFace(card);
		const isLand = (primaryFace.type_line ?? "").includes("Land");
		const sourceFacedCard: FacedCard = { card: deckCard, faceIdx: 0 };

		if (producedColors.length > 0) {
			const tempo = getSourceTempo(card);

			// Track land sources separately (count each land once, not per color)
			if (isLand) {
				totalLandCount += deckCard.quantity;
			}

			for (const color of producedColors) {
				if (!MANA_COLORS_WITH_COLORLESS.includes(color)) continue;
				const qty = deckCard.quantity;

				// Track land sources per color with tempo
				if (isLand) {
					landCounts[color] += qty;
					landCards[color].push(sourceFacedCard);
					switch (tempo) {
						case "immediate":
							landImmediateCounts[color] += qty;
							break;
						case "conditional":
							landConditionalCounts[color] += qty;
							break;
						case "delayed":
							landDelayedCounts[color] += qty;
							break;
						case "bounce":
							landBounceCounts[color] += qty;
							break;
					}
				}

				switch (tempo) {
					case "immediate":
						immediateCounts[color] += qty;
						immediateCards[color].push(sourceFacedCard);
						break;
					case "conditional":
						conditionalCounts[color] += qty;
						conditionalCards[color].push(sourceFacedCard);
						break;
					case "delayed":
						delayedCounts[color] += qty;
						delayedCards[color].push(sourceFacedCard);
						break;
					case "bounce":
						bounceCounts[color] += qty;
						bounceCards[color].push(sourceFacedCard);
						break;
				}
			}
		}
	}

	// Calculate totals for percentages
	const totalSymbols = Object.values(symbolCounts).reduce((a, b) => a + b, 0);
	const totalSources = MANA_COLORS_WITH_COLORLESS.reduce(
		(sum, c) =>
			sum +
			immediateCounts[c] +
			conditionalCounts[c] +
			delayedCounts[c] +
			bounceCounts[c],
		0,
	);
	// Total land production = sum of all land-color pairs (duals count for each color)
	const totalLandProduction = MANA_COLORS_WITH_COLORLESS.reduce(
		(sum, c) => sum + landCounts[c],
		0,
	);

	return MANA_COLORS_WITH_COLORLESS.map((color) => {
		const sourceCount =
			immediateCounts[color] +
			conditionalCounts[color] +
			delayedCounts[color] +
			bounceCounts[color];

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
			conditionalSourceCount: conditionalCounts[color],
			delayedSourceCount: delayedCounts[color],
			bounceSourceCount: bounceCounts[color],
			sourceCount,
			sourcePercent: totalSources > 0 ? (sourceCount / totalSources) * 100 : 0,
			landSourceCount: landCounts[color],
			landSourcePercent:
				totalLandCount > 0 ? (landCounts[color] / totalLandCount) * 100 : 0,
			landProductionPercent:
				totalLandProduction > 0
					? (landCounts[color] / totalLandProduction) * 100
					: 0,
			totalLandCount,
			landImmediateCount: landImmediateCounts[color],
			landConditionalCount: landConditionalCounts[color],
			landDelayedCount: landDelayedCounts[color],
			landBounceCount: landBounceCounts[color],
			symbolCards: symbolCards[color],
			immediateSourceCards: immediateCards[color],
			conditionalSourceCards: conditionalCards[color],
			delayedSourceCards: delayedCards[color],
			bounceSourceCards: bounceCards[color],
			landSourceCards: landCards[color],
			symbolDistribution,
		};
	});
}

/**
 * Compute card type distribution.
 *
 * For multi-faced cards (MDFC, split, adventure), each castable face's
 * type is counted. An MDFC land//creature counts as both Land and Creature.
 */
export function computeTypeDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): TypeData[] {
	const types = new Map<string, { count: number; cards: FacedCard[] }>();

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Track which types we've already counted for this card
		// (avoid double-counting if both faces have same type)
		const countedTypes = new Map<string, number>();

		const faces = getCastableFaces(card);
		for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			const face = faces[faceIdx];
			const type = extractPrimaryType(face.type_line);

			if (!countedTypes.has(type)) {
				countedTypes.set(type, faceIdx);
				const data = types.get(type) ?? { count: 0, cards: [] };
				data.count += deckCard.quantity;
				data.cards.push({ card: deckCard, faceIdx });
				types.set(type, data);
			}
		}
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
 *
 * For multi-faced cards, subtypes from all castable faces are counted.
 */
export function computeSubtypeDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): TypeData[] {
	const subtypes = new Map<string, { count: number; cards: FacedCard[] }>();

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Track which subtypes we've counted for this card
		const countedSubtypes = new Map<string, number>();

		const faces = getCastableFaces(card);
		for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			const face = faces[faceIdx];
			const faceSubtypes = extractSubtypes(face.type_line);

			for (const subtype of faceSubtypes) {
				if (!countedSubtypes.has(subtype)) {
					countedSubtypes.set(subtype, faceIdx);
					const data = subtypes.get(subtype) ?? { count: 0, cards: [] };
					data.count += deckCard.quantity;
					data.cards.push({ card: deckCard, faceIdx });
					subtypes.set(subtype, data);
				}
			}
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
 *
 * For multi-faced cards, each face is checked for its speed.
 * A card with an instant adventure and creature main is counted
 * as having both instant and sorcery options.
 */
export function computeSpeedDistribution(
	cards: DeckCard[],
	lookup: CardLookup,
): SpeedData[] {
	const instant: FacedCard[] = [];
	const sorcery: FacedCard[] = [];
	let instantCount = 0;
	let sorceryCount = 0;

	for (const deckCard of cards) {
		const card = lookup(deckCard);
		if (!card) continue;

		// Track which speeds we've counted for this card
		let hasInstant = false;
		let hasSorcery = false;
		let instantFaceIdx = 0;
		let sorceryFaceIdx = 0;

		const faces = getCastableFaces(card);
		for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
			const face = faces[faceIdx];
			const typeLine = face.type_line ?? "";

			// Check if this face is instant speed
			const isInstant =
				typeLine.includes("Instant") || card.keywords?.includes("Flash");

			if (isInstant && !hasInstant) {
				hasInstant = true;
				instantFaceIdx = faceIdx;
			} else if (!isInstant && !hasSorcery) {
				hasSorcery = true;
				sorceryFaceIdx = faceIdx;
			}
		}

		if (hasInstant) {
			instant.push({ card: deckCard, faceIdx: instantFaceIdx });
			instantCount += deckCard.quantity;
		}
		if (hasSorcery) {
			sorcery.push({ card: deckCard, faceIdx: sorceryFaceIdx });
			sorceryCount += deckCard.quantity;
		}
	}

	return [
		{ category: "instant", count: instantCount, cards: instant },
		{ category: "sorcery", count: sorceryCount, cards: sorcery },
	];
}
