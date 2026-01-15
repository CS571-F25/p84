/**
 * Test utility for loading deck fixtures.
 *
 * Deck fixtures are fetched from ATProto and cached locally.
 * This utility converts them from lexicon format to app format.
 *
 * Usage:
 *   const decks = setupTestDecks();
 *   const hamza = decks.get("hamza-pdh");
 *
 * To add a new deck fixture:
 *   ./src/lib/__tests__/add-test-deck.sh "deck-name" "at://did/collection/rkey"
 */

import type { Deck, DeckCard } from "@/lib/deck-types";
import type { ComDeckbelcherDeckList } from "@/lib/lexicons/index";
import { asOracleId, asScryfallId } from "@/lib/scryfall-types";
import testDecksIndex from "./test-decks.json";

type LexiconDeck = ComDeckbelcherDeckList.Main;

const deckIndex: Record<string, string> = testDecksIndex;

/**
 * Parse a URI like "oracle:uuid" or "scry:uuid" to extract just the UUID
 */
function parseUri(uri: string): string {
	const colonIndex = uri.indexOf(":");
	if (colonIndex === -1) {
		return uri;
	}
	return uri.slice(colonIndex + 1);
}

/**
 * Convert a lexicon deck record to app format
 */
function convertLexiconDeck(lexiconDeck: LexiconDeck): Deck {
	const cards: DeckCard[] = lexiconDeck.cards.map((card) => ({
		scryfallId: asScryfallId(parseUri(card.ref.scryfallUri)),
		oracleId: asOracleId(parseUri(card.ref.oracleUri)),
		section: card.section as DeckCard["section"],
		quantity: card.quantity,
		tags: card.tags ?? [],
	}));

	return {
		$type: lexiconDeck.$type,
		name: lexiconDeck.name,
		format: lexiconDeck.format,
		cards,
		createdAt: lexiconDeck.createdAt,
		updatedAt: lexiconDeck.updatedAt,
		primer: lexiconDeck.primer,
	};
}

/**
 * Load a cached deck fixture by name
 */
async function loadDeckFixture(name: string): Promise<Deck> {
	const atUri = deckIndex[name];
	if (!atUri) {
		const available = Object.keys(deckIndex)
			.filter((k) => k !== "$comment")
			.join(", ");
		throw new Error(
			`Deck "${name}" not in test fixtures. Available: ${available}\n` +
				`To add: ./src/lib/__tests__/add-test-deck.sh "${name}" "at://..."`,
		);
	}

	// Dynamic import the JSON file
	const deckModule = await import(`./test-decks/${name}.json`);
	const lexiconDeck = deckModule.default as LexiconDeck;

	return convertLexiconDeck(lexiconDeck);
}

export class TestDeckLookup {
	private cache = new Map<string, Deck>();

	async get(name: string): Promise<Deck> {
		const cached = this.cache.get(name);
		if (cached) {
			return cached;
		}

		const deck = await loadDeckFixture(name);
		this.cache.set(name, deck);
		return deck;
	}

	/**
	 * Get the AT URI for a deck fixture
	 */
	getUri(name: string): string {
		const uri = deckIndex[name];
		if (!uri) {
			throw new Error(`Deck "${name}" not in test fixtures`);
		}
		return uri;
	}

	/**
	 * List all available deck fixture names
	 */
	listAvailable(): string[] {
		return Object.keys(deckIndex).filter((k) => k !== "$comment");
	}
}

/**
 * Set up test deck lookup.
 * Call this at module level or in beforeAll.
 */
export function setupTestDecks(): TestDeckLookup {
	return new TestDeckLookup();
}

/**
 * Get total card count in a deck (summing quantities)
 */
export function getDeckCardCount(deck: Deck): number {
	return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
}
