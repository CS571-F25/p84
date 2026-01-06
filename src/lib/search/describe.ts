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
