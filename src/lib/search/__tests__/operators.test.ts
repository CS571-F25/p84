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
		["Fire // Ice", "split card name with double slashes"],
		["Wear // Tear", "another split card"],
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
		// Regex patterns
		["/goblin/", "bare regex"],
		["/goblin.*king/i", "regex with flags"],
		["/^Lightning/", "regex with anchor"],
		["o:/deals? \\d+ damage/", "regex in field value"],
	])("`%s` → true (%s)", (query) => {
		expect(hasSearchOperators(query)).toBe(true);
	});
});
