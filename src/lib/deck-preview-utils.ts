import type { DeckCard } from "./deck-types";
import type { Card } from "./scryfall-types";

/**
 * Irregular plurals relevant to MTG typal deck names.
 * These can't be derived algorithmically.
 */
const IRREGULAR_PLURALS: Record<string, string[]> = {
	geese: ["goose"],
	teeth: ["tooth"],
	feet: ["foot"],
	men: ["man"],
	mice: ["mouse"],
	children: ["child"],
	oxen: ["ox"],
	people: ["person"],
};

/**
 * Get possible singular forms of a word for matching deck names to card names.
 * Handles common English plural patterns used in MTG typal deck names.
 */
export function getSingularForms(word: string): string[] {
	const forms = [word];

	// Check irregular plurals first
	const irregular = IRREGULAR_PLURALS[word];
	if (irregular) {
		forms.push(...irregular);
		return forms;
	}

	if (word.endsWith("ies") && word.length > 3) {
		forms.push(`${word.slice(0, -3)}y`); // pixies -> pixy
		forms.push(word.slice(0, -1)); // faeries -> faerie
	} else if (word.endsWith("ves") && word.length > 3) {
		forms.push(`${word.slice(0, -3)}f`); // elves -> elf
		forms.push(`${word.slice(0, -3)}fe`); // knives -> knife
	} else if (
		word.length > 2 &&
		(word.endsWith("xes") ||
			word.endsWith("sses") ||
			word.endsWith("ches") ||
			word.endsWith("shes") ||
			word.endsWith("zzes"))
	) {
		forms.push(word.slice(0, -2)); // boxes -> box, passes -> pass
	} else if (word.endsWith("s") && !word.endsWith("ss") && word.length > 1) {
		// Skip words ending in -ss (prowess, boss, moss) - not plurals
		forms.push(word.slice(0, -1)); // bogles -> bogle, goblins -> goblin
	}
	return forms;
}

/**
 * Extract meaningful words from a deck name for matching against card names/text.
 * Returns lowercase words (3+ chars) plus their possible singular forms.
 */
export function getDeckNameWords(name: string): string[] {
	return name
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 3)
		.flatMap(getSingularForms);
}

/**
 * Check if text contains any of the deck title words.
 */
export function textMatchesDeckTitle(
	text: string | undefined,
	deckWords: string[],
): boolean {
	if (!text || deckWords.length === 0) return false;
	const lower = text.toLowerCase();
	return deckWords.some((word) => lower.includes(word));
}

/**
 * Check if a type line represents a non-creature land.
 */
export function isNonCreatureLand(typeLine: string | undefined): boolean {
	if (!typeLine) return false;
	const lower = typeLine.toLowerCase();
	return lower.includes("land") && !lower.includes("creature");
}

type CardPreviewData = Partial<
	Pick<Card, "name" | "type_line" | "oracle_text">
>;

/**
 * Select the best cards to show in a deck preview.
 *
 * For commander decks: returns commanders (up to 3).
 * For other decks: returns mainboard cards sorted by quantity, with tiebreakers
 * preferring cards whose name/type/text match the deck title. Filters out lands.
 *
 * @param deckName - The deck's name (used for title matching)
 * @param deckCards - Array of deck cards with scryfallId, quantity, section
 * @param getCard - Function to look up card data by ID (returns undefined if not found)
 * @param count - Number of cards to return (default 3)
 */
export function getPreviewCardIds(
	deckName: string,
	deckCards: DeckCard[],
	getCard: (id: string) => CardPreviewData | undefined,
	count = 3,
): string[] {
	const commanders = deckCards.filter((c) => c.section === "commander");
	if (commanders.length > 0) {
		return commanders.slice(0, count).map((c) => c.scryfallId);
	}

	const mainboardCards = deckCards.filter((c) => c.section === "mainboard");
	const deckWords = getDeckNameWords(deckName);

	const withData = mainboardCards
		.map((deckCard) => ({
			deckCard,
			card: getCard(deckCard.scryfallId),
		}))
		.filter(({ card }) => card && !isNonCreatureLand(card.type_line));

	return withData
		.sort((a, b) => {
			const qtyDiff = b.deckCard.quantity - a.deckCard.quantity;
			if (qtyDiff !== 0) return qtyDiff;
			// Tiebreak 1: prefer cards whose name matches deck title
			const aNameMatch = textMatchesDeckTitle(a.card?.name, deckWords);
			const bNameMatch = textMatchesDeckTitle(b.card?.name, deckWords);
			if (aNameMatch && !bNameMatch) return -1;
			if (bNameMatch && !aNameMatch) return 1;
			// Tiebreak 2: prefer cards whose type line matches deck title
			const aTypeMatch = textMatchesDeckTitle(a.card?.type_line, deckWords);
			const bTypeMatch = textMatchesDeckTitle(b.card?.type_line, deckWords);
			if (aTypeMatch && !bTypeMatch) return -1;
			if (bTypeMatch && !aTypeMatch) return 1;
			// Tiebreak 3: prefer cards whose oracle text matches deck title
			const aTextMatch = textMatchesDeckTitle(a.card?.oracle_text, deckWords);
			const bTextMatch = textMatchesDeckTitle(b.card?.oracle_text, deckWords);
			if (aTextMatch && !bTextMatch) return -1;
			if (bTextMatch && !aTextMatch) return 1;
			return 0;
		})
		.slice(0, count)
		.map(({ deckCard }) => deckCard.scryfallId);
}
