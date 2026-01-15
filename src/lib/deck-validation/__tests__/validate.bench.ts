/**
 * Benchmarks for deck validation
 *
 * Run with: npx vitest bench src/lib/deck-validation/__tests__/validate.bench.ts
 */

import { beforeAll, bench, describe } from "vitest";
import {
	getDeckCardCount,
	setupTestDecks,
} from "@/lib/__tests__/test-deck-lookup";
import { mockFetchFromPublicDir } from "@/lib/__tests__/test-helpers";
import { ServerCardProvider } from "@/lib/cards-server-provider";
import type { Deck } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { validateDeck } from "../validate";

describe("validateDeck", () => {
	let hamzaDeck: Deck;
	let cardCache: Map<ScryfallId, Card>;
	let oracleCache: Map<OracleId, Card>;
	let printingsCache: Map<OracleId, Card[]>;

	beforeAll(async () => {
		mockFetchFromPublicDir();

		const decks = setupTestDecks();
		hamzaDeck = await decks.get("hamza-pdh");

		const cardProvider = new ServerCardProvider();
		cardCache = new Map();
		oracleCache = new Map();
		printingsCache = new Map();

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
	}, 60_000);

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
