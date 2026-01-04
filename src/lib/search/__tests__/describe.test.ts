import { describe, expect, it } from "vitest";
import { describeQuery } from "../describe";
import { parse } from "../parser";

function desc(query: string): string {
	const result = parse(query);
	if (!result.ok) throw new Error(result.error.message);
	return describeQuery(result.value);
}

describe("describeQuery", () => {
	it.each([
		["bolt", 'name includes "bolt"'],
		["Bolt", 'name includes "bolt"'],
		['"lightning bolt"', 'name includes "lightning bolt"'],
		["!Lightning", 'name is exactly "lightning"'],
		['!"Lightning Bolt"', 'name is exactly "lightning bolt"'],
		// !foo bar is exact "foo" AND includes "bar"
		["!Lightning Bolt", 'name is exactly "lightning" AND name includes "bolt"'],
	])("name search: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["t:creature", 'type includes "creature"'],
		["o:flying", 'oracle text includes "flying"'],
		["kw:trample", 'keyword includes "trample"'],
		["a:Guay", 'artist includes "guay"'],
	])("text field: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["s:lea", 'set is "lea"'],
		["st:core", 'set type is "core"'],
		["layout:token", 'layout is "token"'],
		["lang:en", 'language is "en"'],
		["game:paper", 'game is "paper"'],
		["f:commander", 'format is "commander"'],
	])("discrete field uses 'is': `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["layout:/dfc/", "layout includes /dfc/"],
		["s:/^m2/", "set includes /^m2/"],
	])(
		"discrete field with regex still shows regex: `%s` → %s",
		(query, expected) => {
			expect(desc(query)).toBe(expected);
		},
	);

	it.each([
		["r:c", "rarity is common"],
		["r:common", "rarity is common"],
		["r:u", "rarity is uncommon"],
		["r:r", "rarity is rare"],
		["r:m", "rarity is mythic"],
		["r>=u", "rarity ≥ uncommon"],
		["r<=r", "rarity ≤ rare"],
		["r>c", "rarity > common"],
	])("rarity field: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["cmc=3", "mana value = 3"],
		["cmc>2", "mana value > 2"],
		["cmc<5", "mana value < 5"],
		["cmc>=3", "mana value ≥ 3"],
		["cmc<=4", "mana value ≤ 4"],
		["pow>=4", "power ≥ 4"],
		["tou<=2", "toughness ≤ 2"],
		["loy=3", "loyalty = 3"],
	])("numeric comparison: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["c:r", "color includes {R}"],
		["id:bg", "color identity includes {B}{G}"],
		["id<=bg", "color identity is within {B}{G}"],
		["id>=bg", "color identity includes at least {B}{G}"],
		["id=wubrg", "color identity is exactly {W}{U}{B}{R}{G}"],
		["id=c", "color identity is exactly {C}"],
		// Use -c:u for "not blue" since != isn't supported for colors
		["-c:u", "NOT color includes {U}"],
	])("color field: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		[
			"fire id>=g",
			'name includes "fire" AND color identity includes at least {G}',
		],
		["t:creature cmc<=3", 'type includes "creature" AND mana value ≤ 3'],
	])("AND: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["bolt OR shock", '(name includes "bolt" OR name includes "shock")'],
		[
			"t:creature OR t:artifact",
			'(type includes "creature" OR type includes "artifact")',
		],
	])("OR: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["-blue", 'NOT name includes "blue"'],
		["-t:land", 'NOT type includes "land"'],
		[
			"creature -human",
			'name includes "creature" AND NOT name includes "human"',
		],
	])("NOT: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});

	it.each([
		["o:/draw/", "oracle text includes /draw/"],
		["o:/draw/i", "oracle text includes /draw/"],
		["o:/^Whenever/", "oracle text includes /^Whenever/"],
		["o:/target.*creature/g", "oracle text includes /target.*creature/g"],
	])("regex with flags: `%s` → %s", (query, expected) => {
		expect(desc(query)).toBe(expected);
	});
});
