import { beforeAll, describe, expect, it } from "vitest";
import {
	setupTestCards,
	type TestCardLookup,
} from "../../__tests__/test-card-lookup";
import type { Card } from "../../scryfall-types";
import { search } from "../index";

describe("is: predicate tests", () => {
	let cards: TestCardLookup;

	beforeAll(async () => {
		cards = await setupTestCards();
	}, 30_000);

	describe("fetchland", () => {
		it("matches Scalding Tarn (pay 1 life, search for mountain or island)", async () => {
			const card = await cards.get("Scalding Tarn");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Misty Rainforest", async () => {
			const card = await cards.get("Misty Rainforest");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Polluted Delta", async () => {
			const card = await cards.get("Polluted Delta");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Prismatic Vista (searches for 'basic land', not in the 10-card cycle)", async () => {
			const card = await cards.get("Prismatic Vista");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Prismatic Vista searches for "a basic land card" - different oracle pattern
				expect(result.value.match(card)).toBe(false);
			}
		});

		// These are "fetch-like" but not true fetchlands (no life payment)
		it("does NOT match Fabled Passage (no life payment)", async () => {
			const card = await cards.get("Fabled Passage");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Fabled Passage doesn't pay life, so our strict definition excludes it
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("does NOT match Evolving Wilds (no life payment)", async () => {
			const card = await cards.get("Evolving Wilds");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("does NOT match Farseek (sorcery, not a land)", async () => {
			const card = await cards.get("Farseek");
			const result = search("is:fetchland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("shockland", () => {
		it("matches Breeding Pool", async () => {
			const card = await cards.get("Breeding Pool");
			const result = search("is:shockland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Steam Vents", async () => {
			const card = await cards.get("Steam Vents");
			const result = search("is:shockland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match basic Forest", async () => {
			const card = await cards.get("Forest");
			const result = search("is:shockland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("dual", () => {
		it("matches Tropical Island (two basic types, no text)", async () => {
			const card = await cards.get("Tropical Island");
			const result = search("is:dual");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Underground Sea", async () => {
			const card = await cards.get("Underground Sea");
			const result = search("is:dual");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Breeding Pool (has oracle text)", async () => {
			const card = await cards.get("Breeding Pool");
			const result = search("is:dual");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Shocklands have oracle text about paying life
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("does NOT match basic Forest", async () => {
			const card = await cards.get("Forest");
			const result = search("is:dual");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("triome", () => {
		it("matches Ketria Triome (three basic land types)", async () => {
			const card = await cards.get("Ketria Triome");
			const result = search("is:triome");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Tropical Island (only two types)", async () => {
			const card = await cards.get("Tropical Island");
			const result = search("is:triome");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("checkland", () => {
		it("matches Hinterland Harbor", async () => {
			const card = await cards.get("Hinterland Harbor");
			const result = search("is:checkland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Glacial Fortress", async () => {
			const card = await cards.get("Glacial Fortress");
			const result = search("is:checkland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Breeding Pool", async () => {
			const card = await cards.get("Breeding Pool");
			const result = search("is:checkland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("fastland", () => {
		it("matches Botanical Sanctum", async () => {
			const card = await cards.get("Botanical Sanctum");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Seachrome Coast", async () => {
			const card = await cards.get("Seachrome Coast");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Inspiring Vantage", async () => {
			const card = await cards.get("Inspiring Vantage");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Concealed Courtyard", async () => {
			const card = await cards.get("Concealed Courtyard");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match slowlands", async () => {
			const card = await cards.get("Dreamroot Cascade");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("does NOT match Thran Portal (has extra abilities beyond the cycle)", async () => {
			const card = await cards.get("Thran Portal");
			const result = search("is:fastland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("slowland", () => {
		it("matches Dreamroot Cascade", async () => {
			const card = await cards.get("Dreamroot Cascade");
			const result = search("is:slowland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match fastlands", async () => {
			const card = await cards.get("Botanical Sanctum");
			const result = search("is:slowland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("painland", () => {
		it("matches Yavimaya Coast", async () => {
			const card = await cards.get("Yavimaya Coast");
			const result = search("is:painland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Adarkar Wastes", async () => {
			const card = await cards.get("Adarkar Wastes");
			const result = search("is:painland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match shocklands (2 damage, not 1)", async () => {
			const card = await cards.get("Breeding Pool");
			const result = search("is:painland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("does NOT match Caldera Lake (enters tapped unconditionally)", async () => {
			const card = await cards.get("Caldera Lake");
			const result = search("is:painland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("filterland", () => {
		it("matches Mystic Gate", async () => {
			const card = await cards.get("Mystic Gate");
			const result = search("is:filterland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Graven Cairns", async () => {
			const card = await cards.get("Graven Cairns");
			const result = search("is:filterland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});
	});

	describe("bounceland", () => {
		it("matches Azorius Chancery", async () => {
			const card = await cards.get("Azorius Chancery");
			const result = search("is:bounceland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Simic Growth Chamber", async () => {
			const card = await cards.get("Simic Growth Chamber");
			const result = search("is:bounceland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Blossoming Tortoise (creature that returns lands from graveyard)", async () => {
			const card = await cards.get("Blossoming Tortoise");
			const result = search("is:bounceland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("tangoland / battleland", () => {
		it("matches Canopy Vista", async () => {
			const card = await cards.get("Canopy Vista");
			const result = search("is:tangoland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Prairie Stream", async () => {
			const card = await cards.get("Prairie Stream");
			const result = search("is:battleland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("battleland and tangoland are synonyms", async () => {
			const card = await cards.get("Canopy Vista");
			const tango = search("is:tangoland");
			const battle = search("is:battleland");
			expect(tango.ok && battle.ok).toBe(true);
			if (tango.ok && battle.ok) {
				expect(tango.value.match(card)).toBe(battle.value.match(card));
			}
		});
	});

	describe("scryland", () => {
		it("matches Temple of Mystery", async () => {
			const card = await cards.get("Temple of Mystery");
			const result = search("is:scryland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match gainlands", async () => {
			const card = await cards.get("Tranquil Cove");
			const result = search("is:scryland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("gainland", () => {
		it("matches Tranquil Cove", async () => {
			const card = await cards.get("Tranquil Cove");
			const result = search("is:gainland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match scrylands", async () => {
			const card = await cards.get("Temple of Mystery");
			const result = search("is:gainland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("manland / creatureland", () => {
		it("matches Celestial Colonnade", async () => {
			const card = await cards.get("Celestial Colonnade");
			const result = search("is:manland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("matches Raging Ravine", async () => {
			const card = await cards.get("Raging Ravine");
			const result = search("is:creatureland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("does NOT match Dryad Arbor (always a creature, doesn't 'become')", async () => {
			const card = await cards.get("Dryad Arbor");
			const result = search("is:manland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Dryad Arbor IS a creature land but doesn't have "becomes a" text
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("canopyland (horizon lands)", () => {
		it("matches Horizon Canopy", async () => {
			const card = await cards.get("Horizon Canopy");
			const result = search("is:canopyland");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});
	});

	describe("frame and border fields", () => {
		it("frame:2015 parses correctly", () => {
			const result = search("frame:2015");
			expect(result.ok).toBe(true);
		});

		it("border:black parses correctly", () => {
			const result = search("border:black");
			expect(result.ok).toBe(true);
		});
	});

	describe("archetype predicates", () => {
		it("is:vanilla matches creatures with no oracle text", () => {
			const vanilla = {
				type_line: "Creature — Human",
				oracle_text: "",
			} as Card;
			const result = search("is:vanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(vanilla)).toBe(true);
			}
		});

		it("is:vanilla does NOT match creatures with text", async () => {
			const elves = await cards.get("Llanowar Elves");
			const result = search("is:vanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(elves)).toBe(false);
			}
		});

		// Inline card tests for frenchvanilla
		it.each([
			[
				"keywords on one line",
				"Flying, first strike, lifelink",
				["Flying", "First strike", "Lifelink"],
				true,
			],
			[
				"keywords with reminder text",
				"Flying\nVigilance (Attacking doesn't cause this creature to tap.)",
				["Flying", "Vigilance"],
				true,
			],
			["vanilla creature (no keywords)", "", [], false],
		])("is:frenchvanilla with %s", (_desc, oracle, keywords, expected) => {
			const card = {
				type_line: "Creature — Test",
				oracle_text: oracle,
				keywords,
			} as Card;
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value.match(card)).toBe(expected);
		});

		// Real card lookups - cards that SHOULD match
		it.each([
			["Serra Angel", "basic keywords"],
			["Gallowbraid", "Cumulative upkeep—Pay 1 life"],
			["Aboroth", "Cumulative upkeep—Put counter"],
			["Deepcavern Imp", "Echo with discard cost"],
			["Bird Admirer", "transform with keyword-only faces"],
			["Black Knight", "protection with reminder text"],
			["Blood Knight", "protection without reminder"],
			["Beloved Chaplain", "protection from creatures"],
			["Tel-Jilad Chosen", "protection from artifacts"],
			["Vault Skirge", "Phyrexian mana with keywords"],
			["Arcbound Wanderer", "Modular—Sunburst (keyword as cost)"],
			["Axebane Ferox", "Ward—Collect evidence (keyword as cost)"],
			["Bloodbraid Challenger", "Escape with mana cost first"],
			["Lunar Hatchling", "complex Escape costs"],
			["Toy Boat", "Cumulative upkeep—Say (unusual verb)"],
			["Wall of Shards", "Cumulative upkeep—An opponent"],
		])("is:frenchvanilla matches %s (%s)", async (name) => {
			const card = await cards.get(name);
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value.match(card)).toBe(true);
		});

		// Real card lookups - cards that should NOT match
		it.each([
			["Llanowar Elves", "has mana ability"],
			["Aerathi Berserker", "Rampage N (direct numeric param)"],
			["Akki Lavarunner", "flip card layout"],
			["Akoum Warrior", "MDFC layout"],
			["A-Lantern Bearer", "transform with non-keyword face"],
			["A-Llanowar Greenwidow", "ability word with activated ability"],
			["Barbara Wright", "ability word with static effect"],
			["Karlach, Raging Tiefling", "keyword cost with extra rules text"],
		])("is:frenchvanilla does NOT match %s (%s)", async (name) => {
			const card = await cards.get(name);
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value.match(card)).toBe(false);
		});

		it("is:bear matches 2/2 for 2 creatures", () => {
			const bear = {
				type_line: "Creature — Bear",
				cmc: 2,
				power: "2",
				toughness: "2",
			} as Card;
			const result = search("is:bear");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bear)).toBe(true);
			}
		});

		it("is:bear does NOT match 2/3 for 2", () => {
			const notBear = {
				type_line: "Creature — Elf",
				cmc: 2,
				power: "2",
				toughness: "3",
			} as Card;
			const result = search("is:bear");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(notBear)).toBe(false);
			}
		});

		it("is:modal matches cards with 'choose one'", () => {
			const modal = {
				oracle_text: "Choose one —\n• Effect A\n• Effect B",
			} as Card;
			const result = search("is:modal");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(modal)).toBe(true);
			}
		});

		it("is:modal matches MDFCs", () => {
			const mdfc = { layout: "modal_dfc" } as Card;
			const result = search("is:modal");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(mdfc)).toBe(true);
			}
		});

		it("is:party matches party creature types", () => {
			const cleric = { type_line: "Creature — Human Cleric" } as Card;
			const rogue = { type_line: "Creature — Vampire Rogue" } as Card;
			const warrior = { type_line: "Creature — Orc Warrior" } as Card;
			const wizard = { type_line: "Creature — Elf Wizard" } as Card;
			const notParty = { type_line: "Creature — Elf Druid" } as Card;

			const result = search("is:party");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(cleric)).toBe(true);
				expect(result.value.match(rogue)).toBe(true);
				expect(result.value.match(warrior)).toBe(true);
				expect(result.value.match(wizard)).toBe(true);
				expect(result.value.match(notParty)).toBe(false);
			}
		});

		it("is:outlaw matches outlaw creature types", () => {
			const assassin = { type_line: "Creature — Human Assassin" } as Card;
			const pirate = { type_line: "Creature — Human Pirate" } as Card;
			const warlock = { type_line: "Creature — Human Warlock" } as Card;
			const notOutlaw = { type_line: "Creature — Human Knight" } as Card;

			const result = search("is:outlaw");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(assassin)).toBe(true);
				expect(result.value.match(pirate)).toBe(true);
				expect(result.value.match(warlock)).toBe(true);
				expect(result.value.match(notOutlaw)).toBe(false);
			}
		});
	});

	describe("frame effect predicates", () => {
		it("is:showcase matches cards with showcase frame effect", () => {
			const showcase = { frame_effects: ["showcase"] } as Card;
			const normal = { frame_effects: [] as string[] } as Card;

			const result = search("is:showcase");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(showcase)).toBe(true);
				expect(result.value.match(normal)).toBe(false);
			}
		});

		it("is:extendedart matches extended art cards", () => {
			const extended = { frame_effects: ["extendedart"] } as Card;
			const result = search("is:extendedart");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(extended)).toBe(true);
			}
		});

		it("is:borderless matches borderless cards", () => {
			const borderless = { border_color: "borderless" } as Card;
			const black = { border_color: "black" } as Card;

			const result = search("is:borderless");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(borderless)).toBe(true);
				expect(result.value.match(black)).toBe(false);
			}
		});

		it("is:retro matches old frame cards", () => {
			const retro = { frame: "1997" } as Card;
			const oldOld = { frame: "1993" } as Card;
			const modern = { frame: "2015" } as Card;

			const result = search("is:retro");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(retro)).toBe(true);
				expect(result.value.match(oldOld)).toBe(true);
				expect(result.value.match(modern)).toBe(false);
			}
		});
	});

	describe("promo type predicates", () => {
		it("is:prerelease matches prerelease promos", () => {
			const prerelease = { promo_types: ["prerelease", "datestamped"] } as Card;
			const normal = { promo_types: [] as string[] } as Card;

			const result = search("is:prerelease");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(prerelease)).toBe(true);
				expect(result.value.match(normal)).toBe(false);
			}
		});

		it("is:buyabox matches buy-a-box promos", () => {
			const bab = { promo_types: ["buyabox"] } as Card;
			const result = search("is:buyabox");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bab)).toBe(true);
			}
		});
	});

	describe("partner predicates", () => {
		it("is:partner matches generic Partner keyword", async () => {
			const card = await cards.get("Thrasios, Triton Hero");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner matches Partner With", async () => {
			const card = await cards.get("Khorvath Brightflame");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner matches Friends Forever", async () => {
			const card = await cards.get("Cecily, Haunted Mage");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner matches Choose a Background", async () => {
			const card = await cards.get("Abdel Adrian, Gorion's Ward");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner matches Background enchantments", async () => {
			const card = await cards.get("Raised by Giants");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner matches Doctor's Companion", async () => {
			const card = await cards.get("Clara Oswald");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:partner does NOT match regular legendary creatures", async () => {
			const card = await cards.get("Atraxa, Praetors' Voice");
			const result = search("is:partner");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("universes beyond predicates", () => {
		it("is:ub matches cards with universesbeyond promo_type", () => {
			const ubCard = { promo_types: ["universesbeyond"] } as Card;
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(ubCard)).toBe(true);
			}
		});

		it("is:ub matches cards with triangle security stamp", () => {
			const triangleCard = { security_stamp: "triangle" } as Card;
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(triangleCard)).toBe(true);
			}
		});

		it("is:ub matches cards with both indicators", () => {
			const bothCard = {
				promo_types: ["universesbeyond"],
				security_stamp: "triangle",
			} as Card;
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(bothCard)).toBe(true);
			}
		});

		it("is:ub does NOT match regular cards", () => {
			const normalCard = {
				security_stamp: "oval",
				promo_types: [] as string[],
			} as Card;
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(normalCard)).toBe(false);
			}
		});

		it("is:ub does NOT match acorn stamp cards", () => {
			const acornCard = { security_stamp: "acorn" } as Card;
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(acornCard)).toBe(false);
			}
		});

		it("is:universesbeyond is alias for is:ub", () => {
			const ubCard = { promo_types: ["universesbeyond"] } as Card;
			const shortResult = search("is:ub");
			const longResult = search("is:universesbeyond");
			expect(shortResult.ok && longResult.ok).toBe(true);
			if (shortResult.ok && longResult.ok) {
				expect(shortResult.value.match(ubCard)).toBe(
					longResult.value.match(ubCard),
				);
			}
		});

		it("not:ub excludes Universes Beyond cards", () => {
			const ubCard = { promo_types: ["universesbeyond"] } as Card;
			const normalCard = { security_stamp: "oval" } as Card;
			const result = search("not:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(ubCard)).toBe(false);
				expect(result.value.match(normalCard)).toBe(true);
			}
		});

		it("is:ub matches The Eleventh Doctor (Doctor Who - triangle stamp)", async () => {
			const card = await cards.get("The Eleventh Doctor");
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:ub matches Aang, Airbending Master (Avatar - promo_types, no triangle)", async () => {
			const card = await cards.get("Aang, Airbending Master");
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:ub does NOT match Lightning Bolt (regular Magic card)", async () => {
			const card = await cards.get("Lightning Bolt");
			const result = search("is:ub");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});

	describe("paupercommander predicates", () => {
		it("is:paupercommander matches uncommon creatures with paper printing", async () => {
			const card = await cards.get("Crackling Drake");
			const result = search("is:paupercommander");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:pdhcommander is alias for paupercommander", async () => {
			const card = await cards.get("Crackling Drake");
			const result = search("is:pdhcommander");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:paupercommander does NOT match rare creatures", async () => {
			const card = await cards.get("Atraxa, Praetors' Voice");
			const result = search("is:paupercommander");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});

		it("is:paupercommander does NOT match uncommon non-creatures", async () => {
			const card = await cards.get("Go for the Throat");
			const result = search("is:paupercommander");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(false);
			}
		});
	});
});
