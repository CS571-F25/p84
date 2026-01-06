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

	describe("is: predicate descriptions", () => {
		it.each([
			// Land cycles
			["is:fetchland", "fetch lands (sacrifice, pay 1 life, search)"],
			["is:shockland", "shock lands (pay 2 life or enter tapped)"],
			["is:dual", "original dual lands"],
			["is:checkland", "check lands (enter tapped unless you control...)"],
			["is:fastland", "fast lands (enter tapped unless ≤2 other lands)"],
			["is:slowland", "slow lands (enter tapped unless ≥2 other lands)"],
			["is:painland", "pain lands (deal 1 damage for colored mana)"],
			["is:filterland", "filter lands (hybrid mana activation)"],
			["is:bounceland", "bounce lands (return a land when entering)"],
			["is:tangoland", "battle lands (enter tapped unless ≥2 basics)"],
			["is:scryland", "scry lands (enter tapped, scry 1)"],
			["is:gainland", "gain lands (enter tapped, gain 1 life)"],
			[
				"is:canopyland",
				"horizon lands (pay 1 life for mana, sacrifice to draw)",
			],
			["is:triome", "triomes (three basic land types)"],

			// Archetypes
			["is:vanilla", "vanilla creatures (no abilities)"],
			["is:frenchvanilla", "French vanilla creatures (only keyword abilities)"],
			["is:bear", "bears (2/2 creatures for 2 mana)"],
			["is:modal", "modal spells (choose one or more)"],
			["is:commander", "cards that can be commanders"],

			// Card types
			["is:creature", "creatures"],
			["is:instant", "instants"],
			["is:legendary", "legendary cards"],
			["is:permanent", "permanents"],
			["is:spell", "spells (instants and sorceries)"],

			// Layouts
			["is:mdfc", "modal double-faced cards"],
			["is:saga", "sagas"],
			["is:adventure", "adventure cards"],

			// Printing characteristics
			["is:reserved", "reserved list cards"],
			["is:promo", "promos"],
			["is:foil", "available in foil"],

			// Frame effects
			["is:borderless", "borderless cards"],
			["is:showcase", "showcase frame cards"],
			["is:retro", "retro frame cards (1993/1997)"],
		])("is: predicate `%s` → %s", (query, expected) => {
			expect(desc(query)).toBe(expected);
		});

		it.each([
			["not:creature", "not creatures"],
			["not:legendary", "not legendary cards"],
			["not:promo", "not promos"],
			["not:fetchland", "not fetch lands (sacrifice, pay 1 life, search)"],
		])("not: predicate `%s` → %s", (query, expected) => {
			expect(desc(query)).toBe(expected);
		});

		it("unknown predicate uses fallback", () => {
			expect(desc("is:unknownpredicate")).toBe('"unknownpredicate" cards');
			expect(desc("not:unknownpredicate")).toBe('not "unknownpredicate"');
		});

		it("combined with other fields", () => {
			expect(desc("is:fetchland c:ug")).toBe(
				"fetch lands (sacrifice, pay 1 life, search) AND color includes {U}{G}",
			);
			expect(desc("t:creature is:legendary")).toBe(
				'type includes "creature" AND legendary cards',
			);
		});
	});
});
