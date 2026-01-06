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

		it("is:frenchvanilla matches creatures with only keywords", async () => {
			const angel = await cards.get("Serra Angel");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(angel)).toBe(true);
			}
		});

		it("is:frenchvanilla matches creatures with keywords on one line", () => {
			const card = {
				type_line: "Creature — Angel",
				oracle_text: "Flying, first strike, lifelink",
				keywords: ["Flying", "First strike", "Lifelink"],
			} as Card;
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:frenchvanilla matches keywords with reminder text", () => {
			const card = {
				type_line: "Creature — Spirit",
				oracle_text:
					"Flying\nVigilance (Attacking doesn't cause this creature to tap.)",
				keywords: ["Flying", "Vigilance"],
			} as Card;
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(card)).toBe(true);
			}
		});

		it("is:frenchvanilla does NOT match vanilla creatures (no keywords)", () => {
			const vanilla = {
				type_line: "Creature — Bear",
				oracle_text: "",
				keywords: [] as string[],
			} as Card;
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.match(vanilla)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match creatures with abilities", async () => {
			const elves = await cards.get("Llanowar Elves");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Llanowar Elves has a mana ability, not just keywords
				expect(result.value.match(elves)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match Rampage (bare numeric parameter)", async () => {
			const berserker = await cards.get("Aerathi Berserker");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Rampage 3 has a bare numeric parameter - not French vanilla
				expect(result.value.match(berserker)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match flip cards", async () => {
			const lavarunner = await cards.get("Akki Lavarunner");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Flip cards have trigger conditions to flip, never french vanilla
				expect(result.value.match(lavarunner)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match MDFCs (creature // land)", async () => {
			const akoum = await cards.get("Akoum Warrior");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// MDFCs have two distinct card faces, not purely a creature
				expect(result.value.match(akoum)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match transform cards", async () => {
			const lantern = await cards.get("A-Lantern Bearer");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Transform cards have two faces, not purely a creature
				expect(result.value.match(lantern)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match ability words with activated abilities", async () => {
			const greenwidow = await cards.get("A-Llanowar Greenwidow");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// Domain — {5}{G}: ... is an activated ability, not french vanilla
				expect(result.value.match(greenwidow)).toBe(false);
			}
		});

		it("is:frenchvanilla does NOT match ability words with static effects", async () => {
			const barbara = await cards.get("Barbara Wright");
			const result = search("is:frenchvanilla");
			expect(result.ok).toBe(true);
			if (result.ok) {
				// "History Teacher — Sagas you control have read ahead" is a static ability
				expect(result.value.match(barbara)).toBe(false);
			}
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
});
