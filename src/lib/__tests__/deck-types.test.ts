import { describe, expect, it } from "vitest";
import type { Deck } from "../deck-types";
import { getCommanderColorIdentity } from "../deck-types";
import type { Card } from "../scryfall-types";
import { asOracleId, asScryfallId } from "../scryfall-types";

function mockCard(overrides: Partial<Card> = {}): Card {
	return {
		id: asScryfallId("00000000-0000-0000-0000-000000000000"),
		oracle_id: asOracleId("00000000-0000-0000-0000-000000000000"),
		name: "Test Card",
		...overrides,
	} as Card;
}

function mockDeck(commanderIds: string[]): Deck {
	return {
		$type: "com.deckbelcher.deck.list",
		name: "Test Deck",
		format: "commander",
		cards: commanderIds.map((id) => ({
			scryfallId: asScryfallId(id),
			quantity: 1,
			section: "commander" as const,
			tags: [],
		})),
		createdAt: new Date().toISOString(),
	};
}

describe("getCommanderColorIdentity", () => {
	it("returns empty array for colorless commander", () => {
		const deck = mockDeck(["kozilek-id"]);
		const cardLookup = () => mockCard({ color_identity: [] });

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual([]);
	});

	it("returns single color for mono-color commander", () => {
		const deck = mockDeck(["blue-commander"]);
		const cardLookup = () => mockCard({ color_identity: ["U"] });

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual(["U"]);
	});

	it("returns multiple colors for multi-color commander", () => {
		const deck = mockDeck(["azorius-commander"]);
		const cardLookup = () => mockCard({ color_identity: ["W", "U"] });

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual(["U", "W"]); // Sorted
	});

	it("merges colors from partner commanders", () => {
		const deck = mockDeck(["white-partner", "blue-partner"]);
		const cards: Record<string, Card> = {
			"white-partner": mockCard({ color_identity: ["W"] }),
			"blue-partner": mockCard({ color_identity: ["U"] }),
		};
		const cardLookup = (id: string) => cards[id];

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual(["U", "W"]); // Combined and sorted
	});

	it("deduplicates overlapping colors from partners", () => {
		const deck = mockDeck(["partner1", "partner2"]);
		const cards: Record<string, Card> = {
			partner1: mockCard({ color_identity: ["W", "U", "B"] }),
			partner2: mockCard({ color_identity: ["U", "B", "R"] }),
		};
		const cardLookup = (id: string) => cards[id];

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual(["B", "R", "U", "W"]); // Deduped and sorted
	});

	it("returns empty array when no commanders", () => {
		const deck: Deck = {
			$type: "com.deckbelcher.deck.list",
			name: "Test Deck",
			format: "commander",
			cards: [],
			createdAt: new Date().toISOString(),
		};
		const cardLookup = () => undefined;

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual([]);
	});

	it("handles missing card data gracefully", () => {
		const deck = mockDeck(["missing-commander"]);
		const cardLookup = () => undefined;

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual([]);
	});

	it("handles card with undefined color_identity", () => {
		const deck = mockDeck(["commander"]);
		const cardLookup = () => mockCard({ color_identity: undefined });

		const result = getCommanderColorIdentity(deck, cardLookup);

		expect(result).toEqual([]);
	});

	it("returns empty array when commander data isn't loaded yet", () => {
		// This simulates the case where a deck has a commander but the card
		// data hasn't been fetched from the query cache yet
		const deck = mockDeck(["unloaded-commander"]);
		const cardLookup = () => undefined; // Card not in cache yet

		const result = getCommanderColorIdentity(deck, cardLookup);

		// Empty array means colorless-only, which would incorrectly filter out
		// all colored cards. This is a bug we need to handle in the UI layer.
		expect(result).toEqual([]);
	});
});
