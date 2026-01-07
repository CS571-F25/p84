/**
 * Converts a parsed search AST to a human-readable description.
 */

import { RARITY_ALIASES } from "./fields";
import {
	type ComparisonOp,
	DISCRETE_FIELDS,
	type FieldName,
	type FieldNode,
	type FieldValue,
	type SearchNode,
} from "./types";

const FIELD_LABELS: Record<FieldName, string> = {
	name: "name",
	type: "type",
	oracle: "oracle text",
	color: "color",
	identity: "color identity",
	mana: "mana cost",
	manavalue: "mana value",
	power: "power",
	toughness: "toughness",
	loyalty: "loyalty",
	defense: "defense",
	keyword: "keyword",
	set: "set",
	settype: "set type",
	layout: "layout",
	frame: "frame",
	border: "border",
	number: "collector number",
	rarity: "rarity",
	artist: "artist",
	format: "format",
	banned: "banned in",
	restricted: "restricted in",
	game: "game",
	in: "printed in",
	produces: "produces",
	year: "year",
	date: "release date",
	lang: "language",
	is: "is",
	not: "is not",
};

const OPERATOR_LABELS: Record<ComparisonOp, string> = {
	":": "includes",
	"=": "=",
	"!=": "≠",
	"<": "<",
	">": ">",
	"<=": "≤",
	">=": "≥",
};

const COLOR_OPERATOR_LABELS: Record<ComparisonOp, string> = {
	":": "includes",
	"=": "is exactly",
	"!=": "is not",
	"<": "is a strict subset of",
	">": "is a strict superset of",
	"<=": "is within",
	">=": "includes at least",
};

const WUBRG_ORDER = ["W", "U", "B", "R", "G"];

/**
 * Human-readable descriptions for is: predicates
 */
const IS_DESCRIPTIONS: Record<string, string> = {
	// Land cycles
	fetchland: "fetch lands (sacrifice, pay 1 life, search)",
	shockland: "shock lands (pay 2 life or enter tapped)",
	dual: "original dual lands",
	triome: "triomes (three basic land types)",
	checkland: "check lands (enter tapped unless you control...)",
	fastland: "fast lands (enter tapped unless ≤2 other lands)",
	slowland: "slow lands (enter tapped unless ≥2 other lands)",
	painland: "pain lands (deal 1 damage for colored mana)",
	filterland: "filter lands (hybrid mana activation)",
	bounceland: "bounce lands (return a land when entering)",
	tangoland: "battle lands (enter tapped unless ≥2 basics)",
	battleland: "battle lands (enter tapped unless ≥2 basics)",
	scryland: "scry lands (enter tapped, scry 1)",
	gainland: "gain lands (enter tapped, gain 1 life)",
	manland: "creature lands (can become creatures)",
	creatureland: "creature lands (can become creatures)",
	canopyland: "horizon lands (pay 1 life for mana, sacrifice to draw)",

	// Card types
	creature: "creatures",
	artifact: "artifacts",
	enchantment: "enchantments",
	land: "lands",
	planeswalker: "planeswalkers",
	instant: "instants",
	sorcery: "sorceries",
	permanent: "permanents",
	spell: "spells (instants and sorceries)",
	legendary: "legendary cards",
	snow: "snow cards",
	historic: "historic cards (legendary, artifact, or saga)",

	// Archetypes
	vanilla: "vanilla creatures (no abilities)",
	frenchvanilla: "French vanilla creatures (only keyword abilities)",
	bear: "bears (2/2 creatures for 2 mana)",
	modal: "modal spells (choose one or more)",
	spree: "spree cards",
	party: "party creatures (cleric, rogue, warrior, wizard)",
	outlaw: "outlaws (assassin, mercenary, pirate, rogue, warlock)",
	commander: "cards that can be commanders",

	// Layouts
	split: "split cards",
	flip: "flip cards",
	transform: "transforming cards",
	mdfc: "modal double-faced cards",
	dfc: "double-faced cards",
	meld: "meld cards",
	leveler: "level up cards",
	saga: "sagas",
	adventure: "adventure cards",
	battle: "battles",
	prototype: "prototype cards",
	token: "tokens",
	art_series: "art series cards",

	// Printing characteristics
	reprint: "reprints",
	promo: "promos",
	digital: "digital-only cards",
	reserved: "reserved list cards",
	full: "full-art cards",
	fullart: "full-art cards",
	hires: "high-resolution images available",
	foil: "available in foil",
	nonfoil: "available in non-foil",
	etched: "available in etched foil",

	// Frame effects
	showcase: "showcase frame cards",
	extendedart: "extended art cards",
	borderless: "borderless cards",
	inverted: "inverted frame cards",
	colorshifted: "colorshifted cards",
	retro: "retro frame cards (1993/1997)",
	old: "old frame cards (1993/1997)",
	modern: "modern frame cards (2003/2015)",
	new: "new frame cards (2015)",
	future: "future frame cards",
	boosterfun: "booster fun treatments",

	// Promo types
	buyabox: "buy-a-box promos",
	prerelease: "prerelease promos",
	datestamped: "date-stamped promos",
	fnm: "FNM promos",
	gameday: "game day promos",
	release: "release promos",
	promopacks: "promo pack cards",
};

function sortColors(colors: Set<string>): string[] {
	return WUBRG_ORDER.filter((c) => colors.has(c));
}

function formatColors(colors: Set<string>): string {
	const sorted = sortColors(colors);
	if (sorted.length === 0) return "{C}";
	return sorted.map((c) => `{${c}}`).join("");
}

function describeValue(value: FieldValue, quoted = true): string {
	switch (value.kind) {
		case "string":
			return quoted
				? `"${value.value.toLowerCase()}"`
				: value.value.toLowerCase();
		case "number":
			return String(value.value);
		case "regex": {
			// Filter out 'i' since case-insensitive is the default
			const flags = value.pattern.flags.replace("i", "");
			return `/${value.source}/${flags}`;
		}
		case "colors":
			return formatColors(value.colors);
	}
}

function describeField(node: FieldNode): string {
	const fieldLabel = FIELD_LABELS[node.field];
	const isColorField = node.field === "color" || node.field === "identity";

	// Special handling for identity count queries (id>1, id=2, etc.)
	if (node.field === "identity" && node.value.kind === "number") {
		const n = node.value.value;
		// Grammatically: "1 color" but "0/2/3 colors", "fewer than 3 colors", "2 or more colors"
		const colorWordExact = n === 1 ? "color" : "colors";
		switch (node.operator) {
			case ":":
			case "=":
				return `cards with exactly ${n} identity ${colorWordExact}`;
			case "!=":
				return `cards without exactly ${n} identity ${colorWordExact}`;
			case "<":
				return `cards with fewer than ${n} identity colors`;
			case ">":
				return `cards with more than ${n} identity ${colorWordExact}`;
			case "<=":
				return `cards with ${n} or fewer identity colors`;
			case ">=":
				return `cards with ${n} or more identity colors`;
		}
	}

	// Special handling for is:/not: predicates
	if (
		(node.field === "is" || node.field === "not") &&
		node.value.kind === "string"
	) {
		const predicate = node.value.value.toLowerCase();
		const description = IS_DESCRIPTIONS[predicate];
		if (description) {
			return node.field === "not" ? `not ${description}` : description;
		}
		// Fallback for unknown predicates
		return node.field === "not" ? `not "${predicate}"` : `"${predicate}" cards`;
	}

	// Pick operator label: discrete fields use "is" instead of "includes" for ":"
	// But regex always uses "includes" since it's a pattern match, not exact
	// "in" field is special - the label already implies the relationship
	let opLabel: string;
	if (isColorField) {
		opLabel = COLOR_OPERATOR_LABELS[node.operator];
	} else if (node.field === "in" && node.operator === ":") {
		opLabel = "";
	} else if (
		node.operator === ":" &&
		DISCRETE_FIELDS.has(node.field) &&
		node.value.kind !== "regex"
	) {
		opLabel = "is";
	} else {
		opLabel = OPERATOR_LABELS[node.operator];
	}

	// Expand rarity shorthand
	if (node.field === "rarity" && node.value.kind === "string") {
		const expanded = RARITY_ALIASES[node.value.value.toLowerCase()];
		if (expanded) {
			return `${fieldLabel} ${opLabel} ${expanded}`;
		}
	}

	const valueStr = describeValue(node.value);
	return opLabel
		? `${fieldLabel} ${opLabel} ${valueStr}`
		: `${fieldLabel} ${valueStr}`;
}

export function describeQuery(node: SearchNode): string {
	switch (node.type) {
		case "NAME":
			return `name includes "${node.value.toLowerCase()}"`;

		case "EXACT_NAME":
			return `name is exactly "${node.value.toLowerCase()}"`;

		case "FIELD":
			return describeField(node);

		case "AND":
			return node.children.map(describeQuery).join(" AND ");

		case "OR":
			if (node.children.length === 1) {
				return describeQuery(node.children[0]);
			}
			return `(${node.children.map(describeQuery).join(" OR ")})`;

		case "NOT":
			return `NOT ${describeQuery(node.child)}`;
	}
}
