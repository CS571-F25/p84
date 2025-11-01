/**
 * Type definitions for deck state
 * Based on generated lexicon types from com.deckbelcher.deck.list
 */

import type { ComDeckbelcherDeckList } from "./lexicons/index";
import type { ScryfallId } from "./scryfall-types";

export type Section = "commander" | "mainboard" | "sideboard" | "maybeboard";

export type DeckCard = Omit<ComDeckbelcherDeckList.Card, "scryfallId"> & {
	scryfallId: ScryfallId;
};

export type Deck = Omit<ComDeckbelcherDeckList.Main, "cards"> & {
	cards: DeckCard[];
};

/**
 * View configuration for deck display
 */
export type ViewStyle = "text" | "grid" | "stacks";
export type GroupBy = "tag" | "type" | "manaValue" | "none";
export type SortBy = "name" | "manaValue" | "rarity";

export interface ViewConfig {
	style: ViewStyle;
	groupBy: GroupBy;
	sortBy: SortBy;
	showManaCost: boolean;
	showSetSymbol: boolean;
}

/**
 * Helper to get cards for a specific section
 */
export function getCardsInSection(deck: Deck, section: Section): DeckCard[] {
	return deck.cards.filter((card) => card.section === section);
}

/**
 * Helper to count cards in a section
 */
export function countCardsInSection(deck: Deck, section: Section): number {
	return getCardsInSection(deck, section).reduce(
		(sum, card) => sum + card.quantity,
		0,
	);
}

/**
 * Helper to check if a card exists in a section
 */
export function findCardInSection(
	deck: Deck,
	scryfallId: ScryfallId,
	section: Section,
): DeckCard | undefined {
	return deck.cards.find(
		(card) => card.scryfallId === scryfallId && card.section === section,
	);
}

/**
 * Add a card to the deck (or increment quantity if it exists)
 */
export function addCardToDeck(
	deck: Deck,
	scryfallId: ScryfallId,
	section: Section,
	quantity = 1,
): Deck {
	const existingCard = findCardInSection(deck, scryfallId, section);

	if (existingCard) {
		return {
			...deck,
			cards: deck.cards.map((card) =>
				card === existingCard
					? { ...card, quantity: card.quantity + quantity }
					: card,
			),
			updatedAt: new Date().toISOString(),
		};
	}

	return {
		...deck,
		cards: [...deck.cards, { scryfallId, quantity, section, tags: [] }],
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Remove a card from the deck
 */
export function removeCardFromDeck(
	deck: Deck,
	scryfallId: ScryfallId,
	section: Section,
): Deck {
	return {
		...deck,
		cards: deck.cards.filter(
			(card) => !(card.scryfallId === scryfallId && card.section === section),
		),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Update a card's quantity
 */
export function updateCardQuantity(
	deck: Deck,
	scryfallId: ScryfallId,
	section: Section,
	quantity: number,
): Deck {
	if (quantity <= 0) {
		return removeCardFromDeck(deck, scryfallId, section);
	}

	return {
		...deck,
		cards: deck.cards.map((card) =>
			card.scryfallId === scryfallId && card.section === section
				? { ...card, quantity }
				: card,
		),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Update a card's tags
 */
export function updateCardTags(
	deck: Deck,
	scryfallId: ScryfallId,
	section: Section,
	tags: string[],
): Deck {
	return {
		...deck,
		cards: deck.cards.map((card) =>
			card.scryfallId === scryfallId && card.section === section
				? { ...card, tags }
				: card,
		),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Move a card to a different section
 */
export function moveCardToSection(
	deck: Deck,
	scryfallId: ScryfallId,
	fromSection: Section,
	toSection: Section,
): Deck {
	const card = findCardInSection(deck, scryfallId, fromSection);
	if (!card) {
		return deck;
	}

	const targetCard = findCardInSection(deck, scryfallId, toSection);
	if (targetCard) {
		return {
			...deck,
			cards: deck.cards
				.filter(
					(c) => !(c.scryfallId === scryfallId && c.section === fromSection),
				)
				.map((c) =>
					c.scryfallId === scryfallId && c.section === toSection
						? { ...c, quantity: c.quantity + card.quantity }
						: c,
				),
			updatedAt: new Date().toISOString(),
		};
	}

	return {
		...deck,
		cards: deck.cards.map((c) =>
			c.scryfallId === scryfallId && c.section === fromSection
				? { ...c, section: toSection }
				: c,
		),
		updatedAt: new Date().toISOString(),
	};
}
