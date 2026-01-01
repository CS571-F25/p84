/**
 * Field-specific matching logic for Scryfall search
 */

import type { Card } from "../scryfall-types";
import { compareColors } from "./colors";
import type { ComparisonOp, FieldName, FieldValue } from "./types";

/**
 * Card predicate function type
 */
export type CardPredicate = (card: Card) => boolean;

/**
 * Compile a field expression into a card predicate
 */
export function compileField(
	field: FieldName,
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	switch (field) {
		// Text fields
		case "name":
			return compileTextField((c) => c.name, operator, value);

		case "type":
			return compileTextField((c) => c.type_line, operator, value);

		case "oracle":
			return compileOracleText(operator, value);

		// Color fields
		case "color":
			return compileColorField((c) => c.colors, operator, value);

		case "identity":
			return compileColorField((c) => c.color_identity, operator, value);

		// Mana fields
		case "mana":
			return compileTextField((c) => c.mana_cost, operator, value);

		case "manavalue":
			return compileNumericField((c) => c.cmc, operator, value);

		// Stats
		case "power":
			return compileStatField((c) => c.power, operator, value);

		case "toughness":
			return compileStatField((c) => c.toughness, operator, value);

		case "loyalty":
			return compileStatField((c) => c.loyalty, operator, value);

		case "defense":
			return compileStatField((c) => c.defense, operator, value);

		// Keywords
		case "keyword":
			return compileKeyword(operator, value);

		// Set/printing
		case "set":
			return compileTextField((c) => c.set, operator, value);

		case "number":
			return compileTextField((c) => c.collector_number, operator, value);

		case "rarity":
			return compileTextField((c) => c.rarity, operator, value);

		case "artist":
			return compileTextField((c) => c.artist, operator, value);

		// Legality
		case "format":
			return compileFormat(operator, value);

		case "banned":
			return compileLegality("banned", value);

		case "restricted":
			return compileLegality("restricted", value);

		// Misc
		case "game":
			return compileGame(operator, value);

		case "produces":
			return compileProduces(operator, value);

		case "year":
			return compileYear(operator, value);

		case "date":
			return compileDate(operator, value);

		case "lang":
			return compileTextField((c) => c.lang, operator, value);

		// Boolean predicates
		case "is":
			return compileIs(value);

		case "not":
			return compileNot(value);

		default:
			return () => false;
	}
}

/**
 * Compile text field matcher
 */
function compileTextField(
	getter: (card: Card) => string | undefined,
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	if (value.kind === "regex") {
		const pattern = value.pattern;
		return (card) => {
			const cardValue = getter(card);
			return cardValue ? pattern.test(cardValue) : false;
		};
	}

	if (value.kind !== "string") {
		return () => false;
	}

	const searchValue = value.value.toLowerCase();

	switch (operator) {
		case ":":
			return (card) => {
				const cardValue = getter(card);
				return cardValue
					? cardValue.toLowerCase().includes(searchValue)
					: false;
			};
		case "=":
			return (card) => {
				const cardValue = getter(card);
				return cardValue ? cardValue.toLowerCase() === searchValue : false;
			};
		case "!=":
			return (card) => {
				const cardValue = getter(card);
				return cardValue ? cardValue.toLowerCase() !== searchValue : true;
			};
		default:
			return (card) => {
				const cardValue = getter(card);
				return cardValue
					? cardValue.toLowerCase().includes(searchValue)
					: false;
			};
	}
}

/**
 * Compile oracle text matcher (checks card faces too)
 */
function compileOracleText(
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	const textMatcher = compileTextField((c) => c.oracle_text, operator, value);

	return (card) => {
		if (textMatcher(card)) return true;

		if (card.card_faces) {
			for (const face of card.card_faces) {
				const faceCard = { oracle_text: face.oracle_text } as Card;
				if (textMatcher(faceCard)) return true;
			}
		}

		return false;
	};
}

/**
 * Compile color field matcher
 */
function compileColorField(
	getter: (card: Card) => string[] | undefined,
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	let searchColors: Set<string>;

	if (value.kind === "colors") {
		searchColors = value.colors;
	} else if (value.kind === "string") {
		searchColors = new Set<string>();
		for (const char of value.value.toUpperCase()) {
			if ("WUBRGC".includes(char)) searchColors.add(char);
		}
	} else {
		return () => false;
	}

	return (card) => compareColors(getter(card), searchColors, operator);
}

/**
 * Compile numeric field matcher
 */
function compileNumericField(
	getter: (card: Card) => number | undefined,
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	if (value.kind !== "number") {
		return () => false;
	}

	const searchValue = value.value;

	switch (operator) {
		case ":":
		case "=":
			return (card) => getter(card) === searchValue;
		case "!=":
			return (card) => getter(card) !== searchValue;
		case "<":
			return (card) => {
				const v = getter(card);
				return v !== undefined && v < searchValue;
			};
		case ">":
			return (card) => {
				const v = getter(card);
				return v !== undefined && v > searchValue;
			};
		case "<=":
			return (card) => {
				const v = getter(card);
				return v !== undefined && v <= searchValue;
			};
		case ">=":
			return (card) => {
				const v = getter(card);
				return v !== undefined && v >= searchValue;
			};
	}
}

/**
 * Compile stat field matcher (power/toughness with * handling)
 */
function compileStatField(
	getter: (card: Card) => string | undefined,
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	// Special case: matching * exactly
	if (value.kind === "string" && value.value === "*") {
		switch (operator) {
			case ":":
			case "=":
				return (card) => {
					const v = getter(card);
					return v === "*" || (v?.includes("*") ?? false);
				};
			case "!=":
				return (card) => {
					const v = getter(card);
					return v !== "*" && !(v?.includes("*") ?? false);
				};
			default:
				return () => false;
		}
	}

	if (value.kind !== "number") {
		return () => false;
	}

	const searchValue = value.value;

	// Parse card value as number, treating * as 0
	const parseStatValue = (cardValue: string | undefined): number | null => {
		if (!cardValue) return null;
		if (cardValue === "*" || cardValue.includes("*")) return 0;
		const num = parseFloat(cardValue);
		return Number.isNaN(num) ? null : num;
	};

	switch (operator) {
		case ":":
		case "=":
			return (card) => parseStatValue(getter(card)) === searchValue;
		case "!=":
			return (card) => parseStatValue(getter(card)) !== searchValue;
		case "<":
			return (card) => {
				const v = parseStatValue(getter(card));
				return v !== null && v < searchValue;
			};
		case ">":
			return (card) => {
				const v = parseStatValue(getter(card));
				return v !== null && v > searchValue;
			};
		case "<=":
			return (card) => {
				const v = parseStatValue(getter(card));
				return v !== null && v <= searchValue;
			};
		case ">=":
			return (card) => {
				const v = parseStatValue(getter(card));
				return v !== null && v >= searchValue;
			};
	}
}

/**
 * Compile keyword matcher
 */
function compileKeyword(
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	if (value.kind === "regex") {
		const pattern = value.pattern;
		return (card) => card.keywords?.some((kw) => pattern.test(kw)) ?? false;
	}

	if (value.kind !== "string") {
		return () => false;
	}

	const searchValue = value.value.toLowerCase();

	switch (operator) {
		case ":":
			return (card) =>
				card.keywords?.some((kw) => kw.toLowerCase().includes(searchValue)) ??
				false;
		case "=":
			return (card) =>
				card.keywords?.some((kw) => kw.toLowerCase() === searchValue) ?? false;
		case "!=":
			return (card) =>
				!(
					card.keywords?.some((kw) => kw.toLowerCase() === searchValue) ?? false
				);
		default:
			return (card) =>
				card.keywords?.some((kw) => kw.toLowerCase().includes(searchValue)) ??
				false;
	}
}

/**
 * Compile format legality matcher
 */
function compileFormat(
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const format = value.value.toLowerCase();

	switch (operator) {
		case ":":
		case "=":
			return (card) => {
				const legality = card.legalities?.[format];
				return legality === "legal" || legality === "restricted";
			};
		case "!=":
			return (card) => {
				const legality = card.legalities?.[format];
				return legality !== "legal" && legality !== "restricted";
			};
		default:
			return (card) => {
				const legality = card.legalities?.[format];
				return legality === "legal" || legality === "restricted";
			};
	}
}

/**
 * Compile specific legality status matcher
 */
function compileLegality(
	status: "banned" | "restricted",
	value: FieldValue,
): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const format = value.value.toLowerCase();
	return (card) => card.legalities?.[format] === status;
}

/**
 * Compile game availability matcher
 */
function compileGame(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const game = value.value.toLowerCase() as "paper" | "arena" | "mtgo";

	switch (operator) {
		case ":":
		case "=":
			return (card) => card.games?.includes(game) ?? false;
		case "!=":
			return (card) => !(card.games?.includes(game) ?? false);
		default:
			return (card) => card.games?.includes(game) ?? false;
	}
}

/**
 * Compile mana production matcher
 */
function compileProduces(
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	let searchColors: Set<string>;

	if (value.kind === "colors") {
		searchColors = value.colors;
	} else if (value.kind === "string") {
		searchColors = new Set<string>();
		for (const char of value.value.toUpperCase()) {
			if ("WUBRGC".includes(char)) searchColors.add(char);
		}
	} else {
		return () => false;
	}

	return (card) => {
		if (!card.produced_mana) return false;
		return compareColors(card.produced_mana, searchColors, operator);
	};
}

/**
 * Compile release year matcher
 */
function compileYear(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "number") {
		return () => false;
	}

	const searchYear = value.value;

	const getYear = (card: Card): number | null => {
		if (!card.released_at) return null;
		const year = parseInt(card.released_at.slice(0, 4), 10);
		return Number.isNaN(year) ? null : year;
	};

	switch (operator) {
		case ":":
		case "=":
			return (card) => getYear(card) === searchYear;
		case "!=":
			return (card) => getYear(card) !== searchYear;
		case "<":
			return (card) => {
				const y = getYear(card);
				return y !== null && y < searchYear;
			};
		case ">":
			return (card) => {
				const y = getYear(card);
				return y !== null && y > searchYear;
			};
		case "<=":
			return (card) => {
				const y = getYear(card);
				return y !== null && y <= searchYear;
			};
		case ">=":
			return (card) => {
				const y = getYear(card);
				return y !== null && y >= searchYear;
			};
	}
}

/**
 * Compile release date matcher
 */
function compileDate(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const searchDate = value.value;

	switch (operator) {
		case ":":
		case "=":
			return (card) => card.released_at === searchDate;
		case "!=":
			return (card) => card.released_at !== searchDate;
		case "<":
			return (card) =>
				card.released_at ? card.released_at < searchDate : false;
		case ">":
			return (card) =>
				card.released_at ? card.released_at > searchDate : false;
		case "<=":
			return (card) =>
				card.released_at ? card.released_at <= searchDate : false;
		case ">=":
			return (card) =>
				card.released_at ? card.released_at >= searchDate : false;
	}
}

/**
 * Check if a card can be used as a commander
 */
function canBeCommander(card: Card): boolean {
	const typeLine = card.type_line?.toLowerCase() ?? "";

	// Legendary creatures, vehicles, and spacecraft can be commanders
	if (typeLine.includes("legendary")) {
		if (
			typeLine.includes("creature") ||
			typeLine.includes("vehicle") ||
			typeLine.includes("spacecraft")
		) {
			return true;
		}
	}

	// Cards with "can be your commander" text
	const oracleText = card.oracle_text?.toLowerCase() ?? "";
	if (oracleText.includes("can be your commander")) {
		return true;
	}

	// Check card faces for MDFCs
	if (card.card_faces) {
		for (const face of card.card_faces) {
			const faceType = face.type_line?.toLowerCase() ?? "";
			if (faceType.includes("legendary")) {
				if (
					faceType.includes("creature") ||
					faceType.includes("vehicle") ||
					faceType.includes("spacecraft")
				) {
					return true;
				}
			}
			const faceText = face.oracle_text?.toLowerCase() ?? "";
			if (faceText.includes("can be your commander")) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Boolean is: predicates
 */
const IS_PREDICATES: Record<string, CardPredicate> = {
	// Reserved list
	reserved: (card) => card.reserved === true,

	// Printing characteristics
	reprint: (card) => card.reprint === true,
	promo: (card) => card.promo === true,
	full: (card) => card.full_art === true,
	digital: (card) => card.digital === true,

	// Finishes
	foil: (card) => card.finishes?.includes("foil") ?? false,
	nonfoil: (card) => card.finishes?.includes("nonfoil") ?? false,
	etched: (card) => card.finishes?.includes("etched") ?? false,

	// Layout types
	split: (card) => card.layout === "split",
	flip: (card) => card.layout === "flip",
	transform: (card) => card.layout === "transform",
	mdfc: (card) => card.layout === "modal_dfc",
	dfc: (card) => card.layout === "transform" || card.layout === "modal_dfc",
	meld: (card) => card.layout === "meld",
	leveler: (card) => card.layout === "leveler",
	saga: (card) => card.layout === "saga",
	adventure: (card) => card.layout === "adventure",
	battle: (card) => card.layout === "battle",
	prototype: (card) => card.layout === "prototype",

	// Commander - can this card BE a commander
	commander: canBeCommander,

	// Type-based predicates
	permanent: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return [
			"creature",
			"artifact",
			"enchantment",
			"land",
			"planeswalker",
			"battle",
		].some((t) => types.includes(t));
	},
	spell: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return ["instant", "sorcery"].some((t) => types.includes(t));
	},
	creature: (card) =>
		card.type_line?.toLowerCase().includes("creature") ?? false,
	artifact: (card) =>
		card.type_line?.toLowerCase().includes("artifact") ?? false,
	enchantment: (card) =>
		card.type_line?.toLowerCase().includes("enchantment") ?? false,
	land: (card) => card.type_line?.toLowerCase().includes("land") ?? false,
	planeswalker: (card) =>
		card.type_line?.toLowerCase().includes("planeswalker") ?? false,
	instant: (card) => card.type_line?.toLowerCase().includes("instant") ?? false,
	sorcery: (card) => card.type_line?.toLowerCase().includes("sorcery") ?? false,
	legendary: (card) =>
		card.type_line?.toLowerCase().includes("legendary") ?? false,
};

/**
 * Compile is: predicate
 */
function compileIs(value: FieldValue): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const predicate = IS_PREDICATES[value.value.toLowerCase()];
	return predicate ?? (() => false);
}

/**
 * Compile not: predicate (negated is:)
 */
function compileNot(value: FieldValue): CardPredicate {
	const isPredicate = compileIs(value);
	return (card) => !isPredicate(card);
}
