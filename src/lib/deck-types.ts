/**
 * Type definitions for deck state
 * Based on generated lexicon types from com.deckbelcher.deck.list
 */

import type { ComDeckbelcherDeckList } from "./lexicons/index";
import type { Card, ManaColor, OracleId, ScryfallId } from "./scryfall-types";

export const SECTIONS = [
	"commander",
	"mainboard",
	"sideboard",
	"maybeboard",
] as const;

export type Section = (typeof SECTIONS)[number];

export function isKnownSection(s: string): s is Section {
	return (SECTIONS as readonly string[]).includes(s);
}

/**
 * App-side card entry with flat typed IDs.
 * The lexicon stores ref.scryfallUri and ref.oracleUri as URIs,
 * but app code works with typed IDs after boundary parsing.
 */
export type DeckCard = Omit<ComDeckbelcherDeckList.Card, "ref"> & {
	scryfallId: ScryfallId;
	oracleId: OracleId;
};

export type Deck = Omit<ComDeckbelcherDeckList.Main, "cards"> & {
	cards: DeckCard[];
};

/** Primer can be embedded document, external URI, or reference to another record */
export type Primer = Deck["primer"];

import type { Document } from "./lexicons/types/com/deckbelcher/richtext";

const EMBEDDED_PRIMER_TYPE = "com.deckbelcher.richtext#document" as const;

/** Extract embedded document from primer union, if present */
export function getEmbeddedPrimer(primer: Primer): Document | undefined {
	if (!primer) return undefined;
	if (primer.$type === EMBEDDED_PRIMER_TYPE) return primer;
	return undefined;
}

/** Wrap a document as an embedded primer for saving */
export function toEmbeddedPrimer(doc: Document): Primer {
	return { ...doc, $type: EMBEDDED_PRIMER_TYPE };
}

/**
 * View configuration for deck display
 */
export type ViewStyle = "text" | "grid" | "stacks";
export type GroupBy =
	| "type"
	| "typeAndTags"
	| "typeAndTagCount"
	| "subtype"
	| "manaValue"
	| "colorIdentity"
	| "none";
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
	oracleId: OracleId,
	section: Section,
	quantity = 1,
	tags: string[] = [],
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
		cards: [...deck.cards, { scryfallId, oracleId, quantity, section, tags }],
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
 * If the card exists in the target section, merge quantities and combine tags
 */
export function moveCardToSection(
	deck: Deck,
	scryfallId: ScryfallId,
	fromSection: Section,
	toSection: Section,
): Deck {
	const sourceCard = findCardInSection(deck, scryfallId, fromSection);
	if (!sourceCard) {
		return deck;
	}

	const targetCard = findCardInSection(deck, scryfallId, toSection);

	// If card exists in target section, merge quantities and combine tags
	if (targetCard) {
		const combinedTags = Array.from(
			new Set([...(targetCard.tags ?? []), ...(sourceCard.tags ?? [])]),
		);
		return {
			...deck,
			cards: deck.cards
				.filter(
					(c) => !(c.scryfallId === scryfallId && c.section === fromSection),
				)
				.map((c) =>
					c.scryfallId === scryfallId && c.section === toSection
						? {
								...c,
								quantity: c.quantity + sourceCard.quantity,
								tags: combinedTags,
							}
						: c,
				),
			updatedAt: new Date().toISOString(),
		};
	}

	// Otherwise just move the card
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

/**
 * Calculate the combined color identity from all commanders in the deck
 * Uses Scryfall's color_identity field which matches Commander format rules
 *
 * Returns undefined if there are no commanders (fail open - no color restriction)
 * Returns empty array if commanders exist but are colorless
 */
export function getCommanderColorIdentity(
	deck: Deck,
	cardLookup: (id: ScryfallId) => Card | undefined,
): ManaColor[] | undefined {
	const commanders = getCardsInSection(deck, "commander");

	// No commanders = no color restriction (fail open)
	if (commanders.length === 0) {
		return undefined;
	}

	const colors = new Set<ManaColor>();

	for (const commander of commanders) {
		const card = cardLookup(commander.scryfallId);
		const identity = card?.color_identity ?? [];
		for (const color of identity) {
			colors.add(color as ManaColor);
		}
	}

	return Array.from(colors).sort();
}
