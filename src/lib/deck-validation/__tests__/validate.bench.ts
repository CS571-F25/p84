/**
 * Benchmarks for deck validation
 *
 * Run with: npm run bench
 *
 * Note: These benchmarks use pre-cached card data, which reflects realistic
 * interactive usage (after initial page load). Cold start performance is
 * dominated by network latency loading card data chunks, not CPU time.
 */

import { bench, describe } from "vitest";
import {
	getDeckCardCount,
	setupTestDecks,
} from "@/lib/__tests__/test-deck-lookup";
import { mockFetchFromPublicDir } from "@/lib/__tests__/test-helpers";
import { ServerCardProvider } from "@/lib/cards-server-provider";
import type { Deck } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { validateDeck } from "../validate";

// Module-level async setup (runs before benchmarks)
mockFetchFromPublicDir();

const decks = setupTestDecks();
const hamzaDeck: Deck = await decks.get("hamza-pdh");

const cardProvider = new ServerCardProvider();
const cardCache = new Map<ScryfallId, Card>();
const oracleCache = new Map<OracleId, Card>();
const printingsCache = new Map<OracleId, Card[]>();

// Pre-warm caches with all cards in deck
for (const deckCard of hamzaDeck.cards) {
	const card = await cardProvider.getCardById(deckCard.scryfallId);
	if (card) {
		cardCache.set(deckCard.scryfallId, card);
		oracleCache.set(deckCard.oracleId, card);
	}
}

// Pre-load all printings for commanders (needed for rarity checks)
const commanders = hamzaDeck.cards.filter((c) => c.section === "commander");
for (const commander of commanders) {
	const printingIds = await cardProvider.getPrintingsByOracleId(
		commander.oracleId,
	);
	const printings: Card[] = [];
	for (const id of printingIds) {
		const card = await cardProvider.getCardById(id);
		if (card) {
			printings.push(card);
		}
	}
	printingsCache.set(commander.oracleId, printings);
}

const cardCount = getDeckCardCount(hamzaDeck);
console.log(
	`Loaded ${hamzaDeck.name} (${cardCount} cards, ${cardCache.size} unique)`,
);

describe("validateDeck", () => {
	bench(
		"hamza PDH deck (100 cards, full validation)",
		() => {
			validateDeck({
				deck: hamzaDeck,
				cardLookup: (id) => cardCache.get(id),
				oracleLookup: (id) => oracleCache.get(id),
				getPrintings: (oracleId) => printingsCache.get(oracleId) ?? [],
			});
		},
		{ iterations: 1000 },
	);
});
