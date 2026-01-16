import { describe, expect, it } from "vitest";
import {
	getDeckNameWords,
	getSingularForms,
	isNonCreatureLand,
	textMatchesDeckTitle,
} from "./deck-preview-utils";

describe("getSingularForms", () => {
	describe("irregular plurals", () => {
		it.each([
			["geese", ["geese", "goose"]],
			["teeth", ["teeth", "tooth"]],
			["feet", ["feet", "foot"]],
			["men", ["men", "man"]],
			["mice", ["mice", "mouse"]],
			["children", ["children", "child"]],
			["oxen", ["oxen", "ox"]],
			["people", ["people", "person"]],
		])("%s -> %j", (input, expected) => {
			expect(getSingularForms(input)).toEqual(expected);
		});
	});

	describe("typal deck names", () => {
		it.each([
			// -s plurals (most common)
			["goblins", ["goblins", "goblin"]],
			["spirits", ["spirits", "spirit"]],
			["humans", ["humans", "human"]],
			["wizards", ["wizards", "wizard"]],
			["knights", ["knights", "knight"]],
			["angels", ["angels", "angel"]],
			["dragons", ["dragons", "dragon"]],
			["slivers", ["slivers", "sliver"]],
			["rogues", ["rogues", "rogue"]],
			["warriors", ["warriors", "warrior"]],
			["clerics", ["clerics", "cleric"]],
			["shamans", ["shamans", "shaman"]],
			["soldiers", ["soldiers", "soldier"]],
			["bogles", ["bogles", "bogle"]],
			["vampires", ["vampires", "vampire"]],
			["horses", ["horses", "horse"]],
			// -ves -> -f and -fe plurals
			["elves", ["elves", "elf", "elfe"]],
			["wolves", ["wolves", "wolf", "wolfe"]],
			["werewolves", ["werewolves", "werewolf", "werewolfe"]],
			["knives", ["knives", "knif", "knife"]],
			// -ies plurals (both -y and -ie forms)
			["zombies", ["zombies", "zomby", "zombie"]],
			["faeries", ["faeries", "faery", "faerie"]],
			["pixies", ["pixies", "pixy", "pixie"]],
			["allies", ["allies", "ally", "allie"]],
			// -xes/-ches/-shes/-sses/-zzes plurals (strip -es)
			["boxes", ["boxes", "box"]],
			["matches", ["matches", "match"]],
			["dishes", ["dishes", "dish"]],
			["passes", ["passes", "pass"]],
			["buzzes", ["buzzes", "buzz"]],
			// Words that don't need singularization
			["merfolk", ["merfolk"]],
			["equipment", ["equipment"]],
			// Words ending in -ss (not plurals)
			["prowess", ["prowess"]],
			["boss", ["boss"]],
			["moss", ["moss"]],
		])("%s -> %j", (input, expected) => {
			expect(getSingularForms(input)).toEqual(expected);
		});
	});

	describe("edge cases", () => {
		it.each([
			["as", ["as", "a"]],
			["is", ["is", "i"]],
			["s", ["s"]],
			["es", ["es", "e"]],
			["ves", ["ves", "ve"]],
			["ies", ["ies", "ie"]],
		])("%s -> %j", (input, expected) => {
			expect(getSingularForms(input)).toEqual(expected);
		});
	});
});

describe("getDeckNameWords", () => {
	it.each([
		["Selesnya Elves", ["selesnya", "elves", "elf", "elfe"]],
		["Mono-Green Elves", ["mono-green", "elves", "elf", "elfe"]],
		["Bant Spirits", ["bant", "spirits", "spirit"]],
		["Selesnya Bogles", ["selesnya", "bogles", "bogle"]],
		["Simic Merfolk", ["simic", "merfolk"]],
		["Azorius Faeries", ["azorius", "azoriu", "faeries", "faery", "faerie"]],
		["GOBLINS", ["goblins", "goblin"]],
	])("%s -> %j", (input, expected) => {
		expect(getDeckNameWords(input)).toEqual(expected);
	});

	it("filters words shorter than 3 chars", () => {
		const words = getDeckNameWords("UW Spirits");
		expect(words).not.toContain("uw");
		expect(words).toContain("spirits");
	});
});

describe("textMatchesDeckTitle", () => {
	it.each([
		["Slippery Bogle", "Selesnya Bogles", true],
		["Gladecover Scout", "Selesnya Bogles", false],
		["Llanowar Elves", "Mono-Green Elves", true],
		["Heritage Druid", "Mono-Green Elves", false],
		["Whenever another Elf enters...", "Mono-Green Elves", true],
		["GOBLIN GUIDE", "goblins", true],
		["Gilded Goose", "Food Geese", true],
		["Tireless Tracker", "Food Geese", false],
		["Cheeky House-Mouse", "Boros Mice", true],
		["Manifold Mouse", "Boros Mice", true],
	])("'%s' matches deck '%s' -> %s", (text, deckName, expected) => {
		const deckWords = getDeckNameWords(deckName);
		expect(textMatchesDeckTitle(text, deckWords)).toBe(expected);
	});

	it("handles empty/undefined inputs", () => {
		const deckWords = getDeckNameWords("Elves");
		expect(textMatchesDeckTitle(undefined, deckWords)).toBe(false);
		expect(textMatchesDeckTitle("", deckWords)).toBe(false);
		expect(textMatchesDeckTitle("Llanowar Elves", [])).toBe(false);
	});
});

describe("isNonCreatureLand", () => {
	it.each([
		["Basic Land — Forest", true],
		["Basic Land — Island", true],
		["Land", true],
		["Land — Gate", true],
		["Legendary Land", true],
		["Land Creature — Elemental", false],
		["Creature Land", false],
		["Creature — Elf", false],
		["Instant", false],
		["Enchantment", false],
		[undefined, false],
	])("isNonCreatureLand(%j) -> %s", (input, expected) => {
		expect(isNonCreatureLand(input)).toBe(expected);
	});
});
