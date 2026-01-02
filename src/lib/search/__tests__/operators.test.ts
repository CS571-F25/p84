import { describe, expect, it } from "vitest";
import { hasSearchOperators } from "../operators";

describe("hasSearchOperators", () => {
	it.each([
		["bolt", "single word"],
		["lightning bolt", "multiple words"],
		["or dragon", "lowercase 'or' in name"],
		["fire and ice", "lowercase 'and' in name"],
		["type specimen", "words that look like fields but no operator"],
		["fire-breathing", "hyphenated names"],
		["The Ur-Dragon", "proper card name with hyphens"],
		["bolt And shock", "mixed case AND"],
	])("`%s` → false (%s)", (query) => {
		expect(hasSearchOperators(query)).toBe(false);
	});

	it.each([
		// Field operators
		["t:creature", "type field"],
		["id:bg", "color identity field"],
		["cmc>=3", "mana value comparison"],
		["o:flying", "oracle text"],
		["s:lea", "set field"],
		["r:rare", "rarity field"],
		["f:commander", "format field"],
		["fire id>=g", "mixed name and field"],
		["t!=land", "not equals operator"],
		["pow<=2", "less than or equal"],
		// Explicit AND/OR
		["bolt AND shock", "uppercase AND"],
		["bolt OR shock", "uppercase OR"],
		// Exact match
		["!Lightning Bolt", "! at start of query"],
		["something !exact", "! after space"],
		["(!Lightning Bolt)", "! after paren"],
		// Negation
		["-blue", "-word at start"],
		["creature -human", "-word after space"],
		["(-blue)", "-word after paren"],
		// Quotes
		['"Lightning Bolt"', "double quotes"],
		['name:"bolt', "partial quotes"],
		// Parentheses
		["(red", "opening paren"],
		["red)", "closing paren"],
		["(red OR blue)", "grouped expression"],
	])("`%s` → true (%s)", (query) => {
		expect(hasSearchOperators(query)).toBe(true);
	});
});
