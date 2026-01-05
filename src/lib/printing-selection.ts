/**
 * Pure functions for bulk printing selection
 *
 * Allows updating all cards in a deck to their cheapest or canonical printings.
 */

import type { CardDataProvider } from "./card-data-provider";
import type { Deck, DeckCard } from "./deck-types";
import type { OracleId, ScryfallId, VolatileData } from "./scryfall-types";

/**
 * Get the cheapest USD price from volatile data.
 * Considers usd, usdFoil, and usdEtched.
 * Returns null if no prices are available.
 */
export function getCheapestPrice(v: VolatileData): number | null {
	const prices = [v.usd, v.usdFoil, v.usdEtched].filter(
		(p): p is number => p !== null,
	);
	return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * Find the cheapest printing from a list of printing IDs.
 * Returns null if no prices are available for any printing.
 */
export function findCheapestPrinting(
	printingIds: ScryfallId[],
	volatileData: Map<ScryfallId, VolatileData | null>,
): ScryfallId | null {
	let cheapestId: ScryfallId | null = null;
	let cheapestPrice = Infinity;

	for (const id of printingIds) {
		const v = volatileData.get(id);
		if (!v) continue;

		const price = getCheapestPrice(v);
		if (price !== null && price < cheapestPrice) {
			cheapestPrice = price;
			cheapestId = id;
		}
	}

	return cheapestId;
}

/**
 * Apply printing updates to a deck.
 * Returns a new deck with updated scryfallIds.
 */
export function updateDeckPrintings(
	deck: Deck,
	updates: Map<ScryfallId, ScryfallId>,
): Deck {
	if (updates.size === 0) {
		return deck;
	}

	return {
		...deck,
		cards: deck.cards.map((card) => ({
			...card,
			scryfallId: updates.get(card.scryfallId) ?? card.scryfallId,
		})),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Group deck cards by oracle ID.
 * Returns a map of oracle ID to deck cards with that oracle.
 */
async function groupCardsByOracle(
	deck: Deck,
	provider: CardDataProvider,
): Promise<Map<OracleId, DeckCard[]>> {
	const byOracle = new Map<OracleId, DeckCard[]>();

	for (const card of deck.cards) {
		const cardData = await provider.getCardById(card.scryfallId);
		if (!cardData) continue;

		const existing = byOracle.get(cardData.oracle_id) ?? [];
		byOracle.set(cardData.oracle_id, [...existing, card]);
	}

	return byOracle;
}

/**
 * Find cheapest printing for all cards in a deck.
 * Returns a map of current scryfallId -> cheapest scryfallId.
 * Only includes cards that need to change.
 */
export async function findAllCheapestPrintings(
	deck: Deck,
	provider: CardDataProvider,
): Promise<Map<ScryfallId, ScryfallId>> {
	const updates = new Map<ScryfallId, ScryfallId>();
	const byOracle = await groupCardsByOracle(deck, provider);

	for (const [oracleId, cards] of byOracle) {
		const printingIds = await provider.getPrintingsByOracleId(oracleId);

		// Get volatile data for all printings in parallel
		const volatileDataArray = await Promise.all(
			printingIds.map((id) => provider.getVolatileData(id)),
		);

		// Build map for findCheapestPrinting
		const volatileData = new Map<ScryfallId, VolatileData | null>();
		for (let i = 0; i < printingIds.length; i++) {
			volatileData.set(printingIds[i], volatileDataArray[i]);
		}

		const cheapestId = findCheapestPrinting(printingIds, volatileData);
		if (!cheapestId) continue;

		// Map all cards with this oracle to the cheapest
		for (const card of cards) {
			if (card.scryfallId !== cheapestId) {
				updates.set(card.scryfallId, cheapestId);
			}
		}
	}

	return updates;
}

/**
 * Find canonical printing for all cards in a deck.
 * Returns a map of current scryfallId -> canonical scryfallId.
 * Only includes cards that need to change.
 */
export async function findAllCanonicalPrintings(
	deck: Deck,
	provider: CardDataProvider,
): Promise<Map<ScryfallId, ScryfallId>> {
	const updates = new Map<ScryfallId, ScryfallId>();
	const byOracle = await groupCardsByOracle(deck, provider);

	for (const [oracleId, cards] of byOracle) {
		const canonicalId = await provider.getCanonicalPrinting(oracleId);
		if (!canonicalId) continue;

		// Map all cards with this oracle to the canonical
		for (const card of cards) {
			if (card.scryfallId !== canonicalId) {
				updates.set(card.scryfallId, canonicalId);
			}
		}
	}

	return updates;
}
