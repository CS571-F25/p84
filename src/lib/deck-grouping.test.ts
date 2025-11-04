import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/scryfall-types";
import { asOracleId, asScryfallId } from "@/lib/scryfall-types";
import {
	type CardLookup,
	extractPrimaryType,
	extractSubtypes,
	getColorIdentityLabel,
	getManaValueBucket,
	groupCards,
	sortCards,
	sortGroupNames,
} from "./deck-grouping";
import type { DeckCard } from "./deck-types";

// Mock card data for testing
function mockCard(overrides: Partial<Card> = {}): Card {
	return {
		id: asScryfallId("00000000-0000-0000-0000-000000000000"),
		oracle_id: asOracleId("00000000-0000-0000-0000-000000000000"),
		name: "Test Card",
		...overrides,
	} as Card;
}

function mockDeckCard(
	scryfallId: string,
	overrides: Partial<DeckCard> = {},
): DeckCard {
	return {
		scryfallId: asScryfallId(scryfallId),
		quantity: 1,
		section: "mainboard",
		tags: [],
		...overrides,
	};
}

describe("extractPrimaryType", () => {
	it("extracts creature type", () => {
		expect(extractPrimaryType("Creature — Human")).toBe("Creature");
		expect(extractPrimaryType("Legendary Creature — Human Wizard")).toBe(
			"Creature",
		);
	});

	it("extracts instant/sorcery", () => {
		expect(extractPrimaryType("Instant")).toBe("Instant");
		expect(extractPrimaryType("Sorcery")).toBe("Sorcery");
	});

	it("extracts artifact/enchantment", () => {
		expect(extractPrimaryType("Artifact — Equipment")).toBe("Artifact");
		expect(extractPrimaryType("Enchantment — Aura")).toBe("Enchantment");
		expect(extractPrimaryType("Legendary Enchantment Creature — God")).toBe(
			"Creature",
		);
	});

	it("extracts planeswalker", () => {
		expect(extractPrimaryType("Legendary Planeswalker — Jace")).toBe(
			"Planeswalker",
		);
	});

	it("extracts land", () => {
		expect(extractPrimaryType("Land")).toBe("Land");
		expect(extractPrimaryType("Basic Land — Forest")).toBe("Land");
	});

	it("handles missing type line", () => {
		expect(extractPrimaryType(undefined)).toBe("Other");
		expect(extractPrimaryType("")).toBe("Other");
	});

	it("handles unknown types", () => {
		expect(extractPrimaryType("Conspiracy")).toBe("Other");
	});
});

describe("extractSubtypes", () => {
	it("extracts creature subtypes", () => {
		expect(extractSubtypes("Creature — Human")).toEqual(["Human"]);
		expect(extractSubtypes("Legendary Creature — Human Wizard")).toEqual([
			"Human",
			"Wizard",
		]);
	});

	it("extracts artifact subtypes", () => {
		expect(extractSubtypes("Artifact — Equipment")).toEqual(["Equipment"]);
	});

	it("extracts land subtypes", () => {
		expect(extractSubtypes("Basic Land — Forest")).toEqual(["Forest"]);
	});

	it("handles cards without subtypes", () => {
		expect(extractSubtypes("Instant")).toEqual([]);
		expect(extractSubtypes("Sorcery")).toEqual([]);
		expect(extractSubtypes("Land")).toEqual([]);
	});

	it("handles missing type line", () => {
		expect(extractSubtypes(undefined)).toEqual([]);
		expect(extractSubtypes("")).toEqual([]);
	});
});

describe("getColorIdentityLabel", () => {
	it("handles colorless", () => {
		expect(getColorIdentityLabel([])).toBe("Colorless");
		expect(getColorIdentityLabel(undefined)).toBe("Colorless");
	});

	it("handles mono-color", () => {
		expect(getColorIdentityLabel(["W"])).toBe("White");
		expect(getColorIdentityLabel(["U"])).toBe("Blue");
		expect(getColorIdentityLabel(["B"])).toBe("Black");
		expect(getColorIdentityLabel(["R"])).toBe("Red");
		expect(getColorIdentityLabel(["G"])).toBe("Green");
	});

	it("handles multi-color in WUBRG order", () => {
		expect(getColorIdentityLabel(["W", "U"])).toBe("Azorius (WU)");
		expect(getColorIdentityLabel(["U", "W"])).toBe("Azorius (WU)"); // Sorts to WUBRG order
		expect(getColorIdentityLabel(["B", "G"])).toBe("Golgari (BG)");
		expect(getColorIdentityLabel(["R", "G", "W"])).toBe("Naya (RGW)");
	});

	it("handles all five colors", () => {
		expect(getColorIdentityLabel(["W", "U", "B", "R", "G"])).toBe(
			"Five-Color (WUBRG)",
		);
	});
});

describe("getManaValueBucket", () => {
	it("handles low CMCs", () => {
		expect(getManaValueBucket(0)).toBe("0");
		expect(getManaValueBucket(1)).toBe("1");
		expect(getManaValueBucket(2)).toBe("2");
		expect(getManaValueBucket(3)).toBe("3");
	});

	it("handles high CMCs", () => {
		expect(getManaValueBucket(7)).toBe("7+");
		expect(getManaValueBucket(8)).toBe("7+");
		expect(getManaValueBucket(12)).toBe("7+");
	});

	it("handles undefined CMC", () => {
		expect(getManaValueBucket(undefined)).toBe("0");
	});
});

describe("sortCards", () => {
	const cardData: Record<string, Card> = {
		"card-1": mockCard({ name: "Zelda", cmc: 3, rarity: "rare" }),
		"card-2": mockCard({ name: "Alice", cmc: 1, rarity: "common" }),
		"card-3": mockCard({ name: "Bob", cmc: 2, rarity: "uncommon" }),
	};

	const lookup: CardLookup = (card) => cardData[card.scryfallId];

	it("sorts by name", () => {
		const cards = [
			mockDeckCard("card-1"),
			mockDeckCard("card-2"),
			mockDeckCard("card-3"),
		];
		const sorted = sortCards(cards, lookup, "name");
		expect(sorted.map((c) => lookup(c)?.name)).toEqual([
			"Alice",
			"Bob",
			"Zelda",
		]);
	});

	it("sorts by mana value", () => {
		const cards = [
			mockDeckCard("card-1"),
			mockDeckCard("card-2"),
			mockDeckCard("card-3"),
		];
		const sorted = sortCards(cards, lookup, "manaValue");
		expect(sorted.map((c) => lookup(c)?.cmc)).toEqual([1, 2, 3]);
	});

	it("sorts by rarity", () => {
		const cards = [
			mockDeckCard("card-1"),
			mockDeckCard("card-2"),
			mockDeckCard("card-3"),
		];
		const sorted = sortCards(cards, lookup, "rarity");
		expect(sorted.map((c) => lookup(c)?.rarity)).toEqual([
			"common",
			"uncommon",
			"rare",
		]);
	});

	it("does not mutate original array", () => {
		const cards = [mockDeckCard("card-1"), mockDeckCard("card-2")];
		const original = [...cards];
		sortCards(cards, lookup, "name");
		expect(cards).toEqual(original);
	});
});

describe("groupCards", () => {
	const cardData: Record<string, Card> = {
		"creature-1": mockCard({
			name: "Human Warrior",
			type_line: "Creature — Human Warrior",
			cmc: 2,
			color_identity: ["W"],
		}),
		"instant-1": mockCard({
			name: "Lightning Bolt",
			type_line: "Instant",
			cmc: 1,
			color_identity: ["R"],
		}),
		"land-1": mockCard({
			name: "Forest",
			type_line: "Basic Land — Forest",
			cmc: 0,
			color_identity: ["G"],
		}),
		"artifact-1": mockCard({
			name: "Sword",
			type_line: "Artifact — Equipment",
			cmc: 3,
			color_identity: [],
		}),
	};

	const lookup: CardLookup = (card) => cardData[card.scryfallId];

	it("groups by none", () => {
		const cards = [mockDeckCard("creature-1"), mockDeckCard("instant-1")];
		const groups = groupCards(cards, lookup, "none");
		expect(groups.size).toBe(1);
		expect(groups.get("all")).toHaveLength(2);
	});

	it("groups by tag", () => {
		const cards = [
			mockDeckCard("creature-1", { tags: ["aggro", "tribal"] }),
			mockDeckCard("instant-1", { tags: ["removal"] }),
			mockDeckCard("land-1", { tags: [] }),
		];
		const groups = groupCards(cards, lookup, "tag");

		expect(groups.size).toBe(4);
		expect(groups.get("aggro")).toHaveLength(1);
		expect(groups.get("tribal")).toHaveLength(1);
		expect(groups.get("removal")).toHaveLength(1);
		expect(groups.get("(No Tags)")).toHaveLength(1);
	});

	it("groups by tag with multi-tag cards appearing in each group", () => {
		const cards = [mockDeckCard("creature-1", { tags: ["aggro", "tribal"] })];
		const groups = groupCards(cards, lookup, "tag");

		expect(groups.size).toBe(2);
		expect(groups.get("aggro")).toHaveLength(1);
		expect(groups.get("tribal")).toHaveLength(1);
		// Same card appears in both groups
		expect(groups.get("aggro")?.[0]).toBe(cards[0]);
		expect(groups.get("tribal")?.[0]).toBe(cards[0]);
	});

	it("groups by type", () => {
		const cards = [
			mockDeckCard("creature-1"),
			mockDeckCard("instant-1"),
			mockDeckCard("land-1"),
			mockDeckCard("artifact-1"),
		];
		const groups = groupCards(cards, lookup, "type");

		expect(groups.size).toBe(4);
		expect(groups.get("Creature")).toHaveLength(1);
		expect(groups.get("Instant")).toHaveLength(1);
		expect(groups.get("Land")).toHaveLength(1);
		expect(groups.get("Artifact")).toHaveLength(1);
	});

	it("groups by typeAndTags", () => {
		const cards = [
			mockDeckCard("creature-1", { tags: ["aggro"] }),
			mockDeckCard("instant-1", { tags: [] }),
			mockDeckCard("land-1", { tags: [] }),
		];
		const groups = groupCards(cards, lookup, "typeAndTags");

		expect(groups.size).toBe(3);
		expect(groups.get("aggro")).toHaveLength(1); // Tagged creature
		expect(groups.get("Instant")).toHaveLength(1); // Untagged instant
		expect(groups.get("Land")).toHaveLength(1); // Untagged land
	});

	it("groups by subtype", () => {
		const cards = [
			mockDeckCard("creature-1"),
			mockDeckCard("instant-1"),
			mockDeckCard("land-1"),
			mockDeckCard("artifact-1"),
		];
		const groups = groupCards(cards, lookup, "subtype");

		expect(groups.size).toBe(5);
		expect(groups.get("Human")).toHaveLength(1);
		expect(groups.get("Warrior")).toHaveLength(1);
		expect(groups.get("Forest")).toHaveLength(1);
		expect(groups.get("Equipment")).toHaveLength(1);
		expect(groups.get("(No Subtype)")).toHaveLength(1); // instant has no subtypes
	});

	it("groups by subtype with multi-subtype cards appearing in each group", () => {
		const cards = [mockDeckCard("creature-1")];
		const groups = groupCards(cards, lookup, "subtype");

		expect(groups.get("Human")).toHaveLength(1);
		expect(groups.get("Warrior")).toHaveLength(1);
		// Same card appears in both groups
		expect(groups.get("Human")?.[0]).toBe(cards[0]);
		expect(groups.get("Warrior")?.[0]).toBe(cards[0]);
	});

	it("groups by manaValue", () => {
		const cards = [
			mockDeckCard("creature-1"),
			mockDeckCard("instant-1"),
			mockDeckCard("land-1"),
			mockDeckCard("artifact-1"),
		];
		const groups = groupCards(cards, lookup, "manaValue");

		expect(groups.size).toBe(4);
		expect(groups.get("0")).toHaveLength(1);
		expect(groups.get("1")).toHaveLength(1);
		expect(groups.get("2")).toHaveLength(1);
		expect(groups.get("3")).toHaveLength(1);
	});

	it("groups by colorIdentity", () => {
		const cards = [
			mockDeckCard("creature-1"),
			mockDeckCard("instant-1"),
			mockDeckCard("land-1"),
			mockDeckCard("artifact-1"),
		];
		const groups = groupCards(cards, lookup, "colorIdentity");

		expect(groups.size).toBe(4);
		expect(groups.get("White")).toHaveLength(1);
		expect(groups.get("Red")).toHaveLength(1);
		expect(groups.get("Green")).toHaveLength(1);
		expect(groups.get("Colorless")).toHaveLength(1);
	});
});

describe("sortGroupNames", () => {
	it("sorts manaValue groups numerically", () => {
		const names = ["7+", "3", "0", "1", "5"];
		const sorted = sortGroupNames(names, "manaValue");
		expect(sorted).toEqual(["0", "1", "3", "5", "7+"]);
	});

	it("sorts colorIdentity groups by WUBRG order", () => {
		const names = ["G", "Colorless", "WU", "R", "B"];
		const sorted = sortGroupNames(names, "colorIdentity");
		expect(sorted).toEqual(["Colorless", "B", "R", "G", "WU"]);
	});

	it("sorts colorIdentity multi-color by length then color", () => {
		const names = ["WUB", "WU", "UB", "W"];
		const sorted = sortGroupNames(names, "colorIdentity");
		expect(sorted).toEqual(["W", "WU", "UB", "WUB"]);
	});

	it("sorts special groups to end", () => {
		const names = ["Zombie", "(No Tags)", "Human", "(No Subtype)"];
		const sorted = sortGroupNames(names, "tag");
		// Special groups (starting with parentheses) come last, sorted alphabetically among themselves
		expect(sorted).toEqual(["Human", "Zombie", "(No Subtype)", "(No Tags)"]);
	});

	it("sorts alphabetically for type/tag/subtype", () => {
		const names = ["Zombie", "Human", "Wizard"];
		const sorted = sortGroupNames(names, "type");
		expect(sorted).toEqual(["Human", "Wizard", "Zombie"]);
	});
});
