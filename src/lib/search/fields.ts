/**
 * Field-specific matching logic for Scryfall search
 */

import {
	canBeCommander,
	canBePauperCommander,
	hasPartnerMechanic,
} from "@/lib/deck-validation/card-utils";
import type { Card } from "../scryfall-types";
import { compareColors } from "./colors";
import type {
	ComparisonOp,
	CompileError,
	FieldName,
	FieldValue,
	Result,
	Span,
} from "./types";
import { err, ok } from "./types";

/**
 * Card predicate function type
 */
export type CardPredicate = (card: Card) => boolean;

/**
 * Create a predicate for ordered comparisons (numbers, dates, ranks).
 * Handles all comparison operators with a single pattern.
 *
 * @param getValue - Extract comparable value from card (null = no match for inequalities)
 * @param searchValue - Value to compare against
 * @param operator - Comparison operator
 */
function createOrderedMatcher<T>(
	getValue: (card: Card) => T | null | undefined,
	searchValue: T,
	operator: ComparisonOp,
): CardPredicate {
	switch (operator) {
		case ":":
		case "=":
			return (card) => getValue(card) === searchValue;
		case "!=":
			return (card) => getValue(card) !== searchValue;
		case "<":
			return (card) => {
				const v = getValue(card);
				return v != null && v < searchValue;
			};
		case ">":
			return (card) => {
				const v = getValue(card);
				return v != null && v > searchValue;
			};
		case "<=":
			return (card) => {
				const v = getValue(card);
				return v != null && v <= searchValue;
			};
		case ">=":
			return (card) => {
				const v = getValue(card);
				return v != null && v >= searchValue;
			};
	}
}

/**
 * Compile a field expression into a card predicate
 */
export function compileField(
	field: FieldName,
	operator: ComparisonOp,
	value: FieldValue,
	span: Span,
): Result<CardPredicate, CompileError> {
	switch (field) {
		// Text fields
		case "name":
			return ok(compileTextField((c) => c.name, operator, value));

		case "type":
			return ok(compileTextField((c) => c.type_line, operator, value));

		case "oracle":
			return ok(compileOracleText(operator, value));

		// Color fields
		case "color":
			return ok(compileColorField((c) => c.colors, operator, value));

		case "identity":
			// Numeric comparison: id>1 means "more than 1 color in identity"
			if (value.kind === "number") {
				return ok(
					createOrderedMatcher(
						(card) => card.color_identity?.length ?? 0,
						value.value,
						operator,
					),
				);
			}
			return ok(compileColorField((c) => c.color_identity, operator, value));

		// Mana fields
		case "mana":
			return ok(compileTextField((c) => c.mana_cost, operator, value));

		case "manavalue":
			return ok(compileNumericField((c) => c.cmc, operator, value));

		// Stats
		case "power":
			return ok(compileStatField((c) => c.power, operator, value));

		case "toughness":
			return ok(compileStatField((c) => c.toughness, operator, value));

		case "loyalty":
			return ok(compileStatField((c) => c.loyalty, operator, value));

		case "defense":
			return ok(compileStatField((c) => c.defense, operator, value));

		// Keywords
		case "keyword":
			return ok(compileKeyword(operator, value));

		// Set/printing (discrete fields use exact match for ':')
		case "set":
			return ok(compileTextField((c) => c.set, operator, value, true));

		case "settype":
			return ok(compileTextField((c) => c.set_type, operator, value, true));

		case "layout":
			return ok(compileTextField((c) => c.layout, operator, value, true));

		case "frame":
			return ok(compileTextField((c) => c.frame, operator, value, true));

		case "border":
			return ok(compileTextField((c) => c.border_color, operator, value, true));

		case "number":
			return ok(compileTextField((c) => c.collector_number, operator, value));

		case "rarity":
			return ok(compileRarity(operator, value));

		case "artist":
			return ok(compileTextField((c) => c.artist, operator, value));

		// Legality
		case "format":
			return ok(compileFormat(operator, value));

		case "banned":
			return ok(compileLegality("banned", value));

		case "restricted":
			return ok(compileLegality("restricted", value));

		// Misc
		case "game":
			return ok(compileGame(operator, value));

		case "in":
			return ok(compileIn(operator, value));

		case "produces":
			return ok(compileProduces(operator, value));

		case "year":
			return ok(compileYear(operator, value));

		case "date":
			return ok(compileDate(operator, value));

		case "lang":
			return ok(compileTextField((c) => c.lang, operator, value, true));

		// Boolean predicates
		case "is":
			return compileIs(value, span);

		case "not":
			return compileNot(value, span);

		default:
			return ok(() => false);
	}
}

/**
 * Compile text field matcher
 * @param discrete - If true, ':' means exact match instead of substring
 */
function compileTextField(
	getter: (card: Card) => string | undefined,
	operator: ComparisonOp,
	value: FieldValue,
	discrete = false,
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
			// Discrete fields use exact match, text fields use substring
			if (discrete) {
				return (card) => {
					const cardValue = getter(card);
					return cardValue ? cardValue.toLowerCase() === searchValue : false;
				};
			}
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
	return createOrderedMatcher(getter, value.value, operator);
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

	const parseStatValue = (cardValue: string | undefined): number | null => {
		if (!cardValue) return null;
		if (cardValue === "*" || cardValue.includes("*")) return 0;
		const num = parseFloat(cardValue);
		return Number.isNaN(num) ? null : num;
	};

	return createOrderedMatcher(
		(card) => parseStatValue(getter(card)),
		value.value,
		operator,
	);
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
 * Rarity shorthand expansion
 */
export const RARITY_ALIASES: Record<string, string> = {
	c: "common",
	common: "common",
	u: "uncommon",
	uncommon: "uncommon",
	r: "rare",
	rare: "rare",
	m: "mythic",
	mythic: "mythic",
	s: "special",
	special: "special",
	b: "bonus",
	bonus: "bonus",
};

/**
 * Rarity ordering for comparisons (lower = less rare)
 */
const RARITY_ORDER: Record<string, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	mythic: 3,
	special: 4,
	bonus: 5,
};

/**
 * Compile rarity matcher with shorthand expansion and comparisons
 */
function compileRarity(
	operator: ComparisonOp,
	value: FieldValue,
): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const expanded = RARITY_ALIASES[value.value.toLowerCase()];
	if (!expanded) {
		return () => false;
	}

	const targetRank = RARITY_ORDER[expanded];

	return createOrderedMatcher(
		(card) => RARITY_ORDER[card.rarity ?? ""],
		targetRank,
		operator,
	);
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

const GAMES = new Set(["paper", "mtgo", "arena"]);
const SET_TYPES = new Set([
	"alchemy",
	"archenemy",
	"arsenal",
	"box",
	"commander",
	"core",
	"draft_innovation",
	"duel_deck",
	"eternal",
	"expansion",
	"from_the_vault",
	"funny",
	"masterpiece",
	"masters",
	"memorabilia",
	"minigame",
	"planechase",
	"premium_deck",
	"promo",
	"spellbook",
	"starter",
	"token",
	"treasure_chest",
	"vanguard",
]);

/**
 * Compile "in:" matcher - unified field for game, set, set type, and language
 * Scryfall's "in:" checks if a card has been printed in a given context
 */
function compileIn(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}

	const searchValue = value.value.toLowerCase();
	const isNegated = operator === "!=";

	// Check game availability (paper, mtgo, arena)
	if (GAMES.has(searchValue)) {
		const game = searchValue as "paper" | "arena" | "mtgo";
		return isNegated
			? (card) => !(card.games?.includes(game) ?? false)
			: (card) => card.games?.includes(game) ?? false;
	}

	// Check set type (core, expansion, commander, etc.)
	if (SET_TYPES.has(searchValue)) {
		return isNegated
			? (card) => card.set_type?.toLowerCase() !== searchValue
			: (card) => card.set_type?.toLowerCase() === searchValue;
	}

	// Fall back to set code or language
	// Set codes are typically 3-4 chars, languages are 2-3 chars
	// Check both - if either matches, include the card
	return isNegated
		? (card) =>
				card.set?.toLowerCase() !== searchValue &&
				card.lang?.toLowerCase() !== searchValue
		: (card) =>
				card.set?.toLowerCase() === searchValue ||
				card.lang?.toLowerCase() === searchValue;
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
		// produced_mana has literal "C" for colorless, unlike colors/color_identity
		return compareColors(card.produced_mana, searchColors, operator, true);
	};
}

/**
 * Compile release year matcher
 */
function compileYear(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "number") {
		return () => false;
	}

	const getYear = (card: Card): number | null => {
		if (!card.released_at) return null;
		const year = parseInt(card.released_at.slice(0, 4), 10);
		return Number.isNaN(year) ? null : year;
	};

	return createOrderedMatcher(getYear, value.value, operator);
}

/**
 * Compile release date matcher
 */
function compileDate(operator: ComparisonOp, value: FieldValue): CardPredicate {
	if (value.kind !== "string") {
		return () => false;
	}
	return createOrderedMatcher(
		(card) => card.released_at,
		value.value,
		operator,
	);
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
	token: (card) => card.layout === "token",
	art_series: (card) => card.layout === "art_series",

	// Commander - can this card BE a commander
	commander: canBeCommander,
	// Has any multi-commander mechanic (Partner, Friends Forever, Background, etc.)
	partner: hasPartnerMechanic,
	// Can be a Pauper Commander (PDH) - uncommon creature/vehicle/spacecraft in paper/MTGO
	paupercommander: canBePauperCommander,
	pdhcommander: canBePauperCommander,

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
	snow: (card) => card.type_line?.toLowerCase().includes("snow") ?? false,
	historic: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return (
			types.includes("legendary") ||
			types.includes("artifact") ||
			types.includes("saga")
		);
	},

	// Frame effects (from frame_effects array)
	showcase: (card) => card.frame_effects?.includes("showcase") ?? false,
	extendedart: (card) => card.frame_effects?.includes("extendedart") ?? false,
	borderless: (card) => card.border_color === "borderless",
	fullart: (card) => card.full_art === true,
	inverted: (card) => card.frame_effects?.includes("inverted") ?? false,
	colorshifted: (card) => card.frame_effects?.includes("colorshifted") ?? false,
	retro: (card) => card.frame === "1997" || card.frame === "1993",
	old: (card) => card.frame === "1993" || card.frame === "1997",
	modern: (card) => card.frame === "2003" || card.frame === "2015",
	new: (card) => card.frame === "2015",
	future: (card) => card.frame === "future",

	// Promo types (from promo_types array)
	buyabox: (card) => card.promo_types?.includes("buyabox") ?? false,
	prerelease: (card) => card.promo_types?.includes("prerelease") ?? false,
	datestamped: (card) => card.promo_types?.includes("datestamped") ?? false,
	fnm: (card) => card.promo_types?.includes("fnm") ?? false,
	gameday: (card) => card.promo_types?.includes("gameday") ?? false,
	release: (card) => card.promo_types?.includes("release") ?? false,
	promopacks: (card) => card.promo_types?.includes("promopack") ?? false,
	boosterfun: (card) => card.frame_effects?.includes("boosterfun") ?? false,

	// Land cycle predicates - use exact oracle text patterns to match only the 10-card cycles
	// Each pattern should match exactly 10 cards

	fetchland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "{T}, Pay 1 life, Sacrifice this land: Search your library for a[n] X or Y card..."
		const pattern =
			/^\{T\}, Pay 1 life, Sacrifice this land: Search your library for an? \w+ or \w+ card, put it onto the battlefield, then shuffle\.$/i;
		return pattern.test(oracle);
	},
	shockland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "({T}: Add {X} or {Y}.)\nAs this land enters, you may pay 2 life..."
		const pattern =
			/^\(\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.\)\nAs this land enters, you may pay 2 life\. If you don't, it enters tapped\.$/i;
		return pattern.test(oracle);
	},
	dual: (card) => {
		const typeLine = card.type_line ?? "";
		const oracle = card.oracle_text ?? "";
		// Original duals: type line exactly "Land — X Y" (no supertypes like Snow)
		// and oracle text is exactly the mana reminder
		const typePattern =
			/^Land — (Plains|Island|Swamp|Mountain|Forest) (Plains|Island|Swamp|Mountain|Forest)$/;
		const oraclePattern = /^\(\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.\)$/;
		return typePattern.test(typeLine) && oraclePattern.test(oracle);
	},
	triome: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		const landTypes = ["plains", "island", "swamp", "mountain", "forest"];
		const matchCount = landTypes.filter((t) => types.includes(t)).length;
		return types.includes("land") && matchCount >= 3;
	},
	checkland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped unless you control a X or a Y.\n{T}: Add {X} or {Y}."
		const pattern =
			/^This land enters tapped unless you control an? \w+ or an? \w+\.\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	fastland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped unless you control two or fewer other lands.\n{T}: Add {X} or {Y}."
		const pattern =
			/^This land enters tapped unless you control two or fewer other lands\.\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	slowland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped unless you control two or more other lands.\n{T}: Add {X} or {Y}."
		const pattern =
			/^This land enters tapped unless you control two or more other lands\.\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	painland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "{T}: Add {C}.\n{T}: Add {X} or {Y}. This land deals 1 damage to you."
		const pattern =
			/^\{T\}: Add \{C\}\.\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\. This land deals 1 damage to you\.$/i;
		return pattern.test(oracle);
	},
	filterland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "{T}: Add {C}.\n{W/U}, {T}: Add {W}{W}, {W}{U}, or {U}{U}."
		const pattern =
			/^\{T\}: Add \{C\}\.\n\{[WUBRG]\/[WUBRG]\}, \{T\}: Add \{[WUBRG]\}\{[WUBRG]\}, \{[WUBRG]\}\{[WUBRG]\}, or \{[WUBRG]\}\{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	bounceland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped.\nWhen this land enters, return a land you control to its owner's hand.\n{T}: Add {W}{U}."
		const pattern =
			/^This land enters tapped\.\nWhen this land enters, return a land you control to its owner's hand\.\n\{T\}: Add \{[WUBRG]\}\{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	tangoland: (card) => {
		const oracle = card.oracle_text?.toLowerCase() ?? "";
		const types = card.type_line?.toLowerCase() ?? "";
		const landTypes = ["plains", "island", "swamp", "mountain", "forest"];
		const matchCount = landTypes.filter((t) => types.includes(t)).length;
		return (
			matchCount >= 2 &&
			oracle.includes("enters tapped unless you control two or more basic")
		);
	},
	battleland: (card) => {
		const oracle = card.oracle_text?.toLowerCase() ?? "";
		const types = card.type_line?.toLowerCase() ?? "";
		const landTypes = ["plains", "island", "swamp", "mountain", "forest"];
		const matchCount = landTypes.filter((t) => types.includes(t)).length;
		return (
			matchCount >= 2 &&
			oracle.includes("enters tapped unless you control two or more basic")
		);
	},
	scryland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped.\nWhen this land enters, scry 1. (reminder text)\n{T}: Add {W} or {U}."
		const pattern =
			/^This land enters tapped\.\nWhen this land enters, scry 1\. \([^)]+\)\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	gainland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {W} or {U}."
		const pattern =
			/^This land enters tapped\.\nWhen this land enters, you gain 1 life\.\n\{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/i;
		return pattern.test(oracle);
	},
	manland: (card) => {
		const oracle = card.oracle_text?.toLowerCase() ?? "";
		const types = card.type_line?.toLowerCase() ?? "";
		return types.includes("land") && oracle.includes("becomes a");
	},
	canopyland: (card) => {
		const oracle = card.oracle_text ?? "";
		// Pattern: "{T}, Pay 1 life: Add {G} or {W}.\n{1}, {T}, Sacrifice this land: Draw a card."
		const pattern =
			/^\{T\}, Pay 1 life: Add \{[WUBRG]\} or \{[WUBRG]\}\.\n\{1\}, \{T\}, Sacrifice this land: Draw a card\.$/i;
		return pattern.test(oracle);
	},
	creatureland: (card) => {
		const oracle = card.oracle_text?.toLowerCase() ?? "";
		const types = card.type_line?.toLowerCase() ?? "";
		return types.includes("land") && oracle.includes("becomes a");
	},

	// Card archetypes
	vanilla: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return (
			types.includes("creature") &&
			(!card.oracle_text || card.oracle_text === "")
		);
	},
	frenchvanilla: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		const keywords = card.keywords ?? [];
		if (!types.includes("creature") || keywords.length === 0) return false;

		// Adventure, flip, and MDFC are never french vanilla
		const neverVanillaLayouts = new Set(["adventure", "flip", "modal_dfc"]);
		if (neverVanillaLayouts.has(card.layout ?? "")) return false;

		// Helper to check if oracle text is keyword-only
		const isKeywordOnly = (oracle: string, kws: string[]): boolean => {
			oracle = oracle.replace(/\([^)]*\)/g, "").trim();
			if (!oracle) return true;

			const kwLower = kws.map((k) => k.toLowerCase());
			const lines = oracle.split(/\n/).map((s) => s.trim().toLowerCase());

			// Helper to validate a single keyword segment
			const isValidKeywordSegment = (seg: string): boolean => {
				if (!seg) return true;
				if (seg.includes(":")) return false; // Activated ability

				const kw = kwLower.find((k) => seg.startsWith(k));
				if (!kw) return false;

				const afterKw = seg.slice(kw.length).trim();
				if (!afterKw) return true; // Just the keyword

				// "keyword N" = direct numeric parameter (Rampage 3, Bushido 2) - NOT french vanilla
				if (/^\d+($|—)/.test(afterKw)) return false;

				// "from X" - protection/hexproof targets
				if (afterKw.startsWith("from ")) return true;

				// "with X" (partner with)
				if (afterKw.startsWith("with ")) return true;

				// Mana cost
				if (afterKw.startsWith("{")) return true;

				// Em dash for keyword costs - the whole rest of the line is the cost
				if (afterKw.startsWith("—") || afterKw.startsWith("— ")) {
					const afterDash = afterKw.replace(/^—\s*/, "");
					// Reject if there's an additional sentence (period followed by more text)
					// e.g. "Specialize {6}. You may also activate..." has extra rules
					if (/\.\s+\S/.test(afterDash)) return false;
					// Mana cost first (Escape—{3}{R}{G}, ...)
					if (afterDash.startsWith("{")) return true;
					// Another keyword as cost (Modular—Sunburst, Ward—Collect evidence)
					if (kwLower.some((k) => afterDash.startsWith(k))) return true;
					// Cost verbs or patterns - everything after dash is the cost clause
					const costPatterns =
						/^(put|discard|pay|sacrifice|remove|exile|tap|untap|return|reveal|say|an opponent)/i;
					if (costPatterns.test(afterDash)) return true;
					return false;
				}

				return false;
			};

			return lines.every((line) => {
				if (!line) return true;
				// If line has em dash, treat whole line as one keyword clause
				if (line.includes("—")) {
					return isValidKeywordSegment(line);
				}
				// Otherwise comma-separated keywords (Flying, vigilance)
				const parts = line.split(/,/).map((s) => s.trim());
				return parts.every(isValidKeywordSegment);
			});
		};

		// For transform cards, check if BOTH faces are keyword-only
		if (card.layout === "transform" && card.card_faces?.length === 2) {
			const face0 = card.card_faces[0];
			const face1 = card.card_faces[1];
			// Both faces must be creatures with keywords
			if (
				!face0.type_line?.toLowerCase().includes("creature") ||
				!face1.type_line?.toLowerCase().includes("creature")
			) {
				return false;
			}
			return (
				isKeywordOnly(face0.oracle_text ?? "", keywords) &&
				isKeywordOnly(face1.oracle_text ?? "", keywords)
			);
		}

		// For normal cards
		let oracle = card.oracle_text ?? "";
		if (!oracle && card.card_faces?.[0]?.oracle_text) {
			oracle = card.card_faces[0].oracle_text;
		}
		return isKeywordOnly(oracle, keywords);
	},
	bear: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return (
			types.includes("creature") &&
			card.cmc === 2 &&
			card.power === "2" &&
			card.toughness === "2"
		);
	},
	modal: (card) => {
		const oracle = card.oracle_text?.toLowerCase() ?? "";
		return (
			oracle.includes("choose one") ||
			oracle.includes("choose two") ||
			oracle.includes("choose three") ||
			oracle.includes("choose four") ||
			oracle.includes("choose any number") ||
			card.layout === "modal_dfc" ||
			card.frame_effects?.includes("spree") === true
		);
	},
	spree: (card) => card.frame_effects?.includes("spree") ?? false,
	party: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return (
			types.includes("cleric") ||
			types.includes("rogue") ||
			types.includes("warrior") ||
			types.includes("wizard")
		);
	},
	outlaw: (card) => {
		const types = card.type_line?.toLowerCase() ?? "";
		return (
			types.includes("assassin") ||
			types.includes("mercenary") ||
			types.includes("pirate") ||
			types.includes("rogue") ||
			types.includes("warlock")
		);
	},

	// Hires/quality
	hires: (card) => card.highres_image === true,
};

/**
 * Set of valid is: predicate names (for autocomplete)
 */
export const IS_PREDICATE_NAMES = new Set(Object.keys(IS_PREDICATES));

/**
 * Compile is: predicate
 */
function compileIs(
	value: FieldValue,
	span: Span,
): Result<CardPredicate, CompileError> {
	if (value.kind !== "string") {
		return err({ message: "is: requires a text value", span });
	}

	const predicate = IS_PREDICATES[value.value.toLowerCase()];
	if (!predicate) {
		return err({
			message: `'${value.value}' is not a valid is: predicate`,
			span,
		});
	}
	return ok(predicate);
}

/**
 * Compile not: predicate (negated is:)
 */
function compileNot(
	value: FieldValue,
	span: Span,
): Result<CardPredicate, CompileError> {
	const isResult = compileIs(value, span);
	if (!isResult.ok) {
		return isResult;
	}
	return ok((card) => !isResult.value(card));
}
