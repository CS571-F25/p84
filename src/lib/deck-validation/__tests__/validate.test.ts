/**
 * Integration tests for deck validation
 *
 * Tests full validation of real deck fixtures to ensure legal decks pass.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
	getDeckCardCount,
	setupTestDecks,
	type TestDeckLookup,
} from "@/lib/__tests__/test-deck-lookup";
import { mockFetchFromPublicDir } from "@/lib/__tests__/test-helpers";
import { ServerCardProvider } from "@/lib/cards-server-provider";
import type { Deck } from "@/lib/deck-types";
import type { Card, OracleId, ScryfallId } from "@/lib/scryfall-types";
import { validateDeck } from "../validate";

describe("validateDeck integration", () => {
	let decks: TestDeckLookup;
	let cardProvider: ServerCardProvider;

	beforeAll(() => {
		mockFetchFromPublicDir();
		decks = setupTestDecks();
		cardProvider = new ServerCardProvider();
	}, 30_000);

	async function buildLookups(deck: Deck) {
		const cardCache = new Map<ScryfallId, Card>();
		const oracleCache = new Map<OracleId, Card>();
		const printingsCache = new Map<OracleId, Card[]>();

		// First pass: load all cards in deck
		for (const deckCard of deck.cards) {
			const card = await cardProvider.getCardById(deckCard.scryfallId);
			if (card) {
				cardCache.set(deckCard.scryfallId, card);
				oracleCache.set(deckCard.oracleId, card);
			}
		}

		// Second pass: load all printings for commanders (needed for rarity checks)
		const commanders = deck.cards.filter((c) => c.section === "commander");
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

		return {
			cardLookup: (id: ScryfallId) => cardCache.get(id),
			oracleLookup: (id: OracleId) => oracleCache.get(id),
			getPrintings: (oracleId: OracleId) => printingsCache.get(oracleId) ?? [],
		};
	}

	describe("hamza-pdh", () => {
		let hamzaDeck: Deck;

		beforeAll(async () => {
			hamzaDeck = await decks.get("hamza-pdh");
		}, 30_000);

		it("has correct card count", () => {
			const count = getDeckCardCount(hamzaDeck);
			expect(count).toBe(100);
		});

		it("is paupercommander format", () => {
			expect(hamzaDeck.format).toBe("paupercommander");
		});

		it("has a commander", () => {
			const commanders = hamzaDeck.cards.filter(
				(c) => c.section === "commander",
			);
			expect(commanders.length).toBe(1);
		});

		it("validates without errors", async () => {
			const lookups = await buildLookups(hamzaDeck);

			const result = validateDeck({
				deck: hamzaDeck,
				...lookups,
			});

			// Filter to just errors (not warnings)
			const errors = result.violations.filter((v) => v.severity === "error");

			if (errors.length > 0) {
				const errorMessages = errors
					.map((e) => `${e.rule}: ${e.message}`)
					.join("\n");
				throw new Error(
					`Deck should validate without errors:\n${errorMessages}`,
				);
			}

			expect(result.valid).toBe(true);
		}, 60_000);

		it("reports no color identity violations", async () => {
			const lookups = await buildLookups(hamzaDeck);

			const result = validateDeck({
				deck: hamzaDeck,
				...lookups,
			});

			const colorViolations = result.violations.filter(
				(v) => v.rule === "903.4",
			);
			expect(colorViolations).toHaveLength(0);
		}, 60_000);
	});
});
