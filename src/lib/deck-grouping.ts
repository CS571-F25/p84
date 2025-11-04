import type { Card } from "@/lib/scryfall-types";
import type { DeckCard, GroupBy, SortBy } from "./deck-types";

/**
 * Card lookup function type (returns Card data for a given Scryfall ID)
 */
export type CardLookup = (card: DeckCard) => Card | undefined;

/**
 * Extract the primary type from a card's type line
 * Example: "Legendary Creature — Human Wizard" → "Creature"
 */
export function extractPrimaryType(typeLine: string | undefined): string {
	if (!typeLine) return "Other";

	// Split on "—" or "-" to remove subtypes
	const mainPart = typeLine.split(/—|-/)[0].trim();

	// Common type order: "Legendary Enchantment Creature"
	// We want the rightmost non-supertype word
	const types = [
		"Creature",
		"Instant",
		"Sorcery",
		"Enchantment",
		"Artifact",
		"Planeswalker",
		"Land",
		"Battle",
		"Kindred",
		"Tribal",
	];

	for (const type of types) {
		if (mainPart.includes(type)) {
			return type;
		}
	}

	return "Other";
}

/**
 * Extract subtypes from a card's type line
 * Example: "Legendary Creature — Human Wizard" → ["Human", "Wizard"]
 */
export function extractSubtypes(typeLine: string | undefined): string[] {
	if (!typeLine) return [];

	// Split on "—" or "-" to get subtypes
	const parts = typeLine.split(/—|-/);
	if (parts.length < 2) return [];

	const subtypesPart = parts[1].trim();
	return subtypesPart.split(/\s+/).filter((s) => s.length > 0);
}

/**
 * Get a label for a color identity
 * Example: ["W", "U"] → "WU"
 * Example: [] → "Colorless"
 */
export function getColorIdentityLabel(
	colorIdentity: string[] | undefined,
): string {
	if (!colorIdentity || colorIdentity.length === 0) return "Colorless";

	// Sort in WUBRG order
	const order = ["W", "U", "B", "R", "G"];
	const sorted = [...colorIdentity].sort(
		(a, b) => order.indexOf(a) - order.indexOf(b),
	);

	return sorted.join("");
}

/**
 * Get mana value bucket for grouping
 * Example: 0 → "0", 3 → "3", 8 → "7+"
 */
export function getManaValueBucket(cmc: number | undefined): string {
	if (cmc === undefined || cmc === 0) return "0";
	if (cmc >= 7) return "7+";
	return cmc.toString();
}

/**
 * Sort cards by the specified method
 */
export function sortCards(
	cards: DeckCard[],
	cardLookup: CardLookup,
	sortBy: SortBy,
): DeckCard[] {
	const sorted = [...cards];

	switch (sortBy) {
		case "name": {
			sorted.sort((a, b) => {
				const cardA = cardLookup(a);
				const cardB = cardLookup(b);
				const nameA = cardA?.name ?? "";
				const nameB = cardB?.name ?? "";
				return nameA.localeCompare(nameB);
			});
			break;
		}

		case "manaValue": {
			sorted.sort((a, b) => {
				const cardA = cardLookup(a);
				const cardB = cardLookup(b);
				const cmcA = cardA?.cmc ?? 0;
				const cmcB = cardB?.cmc ?? 0;
				if (cmcA !== cmcB) return cmcA - cmcB;
				// Tiebreak by name
				return (cardA?.name ?? "").localeCompare(cardB?.name ?? "");
			});
			break;
		}

		case "rarity": {
			const rarityOrder: Record<string, number> = {
				common: 0,
				uncommon: 1,
				rare: 2,
				mythic: 3,
				special: 4,
				bonus: 5,
			};

			sorted.sort((a, b) => {
				const cardA = cardLookup(a);
				const cardB = cardLookup(b);
				const rarityA = rarityOrder[cardA?.rarity ?? ""] ?? 999;
				const rarityB = rarityOrder[cardB?.rarity ?? ""] ?? 999;
				if (rarityA !== rarityB) return rarityA - rarityB;
				// Tiebreak by name
				return (cardA?.name ?? "").localeCompare(cardB?.name ?? "");
			});
			break;
		}
	}

	return sorted;
}

/**
 * Group cards by the specified method
 * Returns a Map of group name → cards in that group
 *
 * Note: Cards with multiple tags will appear in multiple groups
 */
export function groupCards(
	cards: DeckCard[],
	cardLookup: CardLookup,
	groupBy: GroupBy,
): Map<string, DeckCard[]> {
	const groups = new Map<string, DeckCard[]>();

	switch (groupBy) {
		case "none": {
			groups.set("all", cards);
			break;
		}

		case "tag": {
			for (const card of cards) {
				if (!card.tags || card.tags.length === 0) {
					const group = groups.get("(No Tags)") ?? [];
					group.push(card);
					groups.set("(No Tags)", group);
				} else {
					// Add card to each tag group it belongs to
					for (const tag of card.tags) {
						const group = groups.get(tag) ?? [];
						group.push(card);
						groups.set(tag, group);
					}
				}
			}
			break;
		}

		case "type": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const type = extractPrimaryType(cardData?.type_line);
				const group = groups.get(type) ?? [];
				group.push(card);
				groups.set(type, group);
			}
			break;
		}

		case "typeAndTags": {
			for (const card of cards) {
				if (!card.tags || card.tags.length === 0) {
					// No tags → group by type
					const cardData = cardLookup(card);
					const type = extractPrimaryType(cardData?.type_line);
					const group = groups.get(type) ?? [];
					group.push(card);
					groups.set(type, group);
				} else {
					// Has tags → add to each tag group
					for (const tag of card.tags) {
						const group = groups.get(tag) ?? [];
						group.push(card);
						groups.set(tag, group);
					}
				}
			}
			break;
		}

		case "subtype": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const subtypes = extractSubtypes(cardData?.type_line);

				if (subtypes.length === 0) {
					const group = groups.get("(No Subtype)") ?? [];
					group.push(card);
					groups.set("(No Subtype)", group);
				} else {
					// Add card to each subtype group it belongs to
					for (const subtype of subtypes) {
						const group = groups.get(subtype) ?? [];
						group.push(card);
						groups.set(subtype, group);
					}
				}
			}
			break;
		}

		case "manaValue": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const bucket = getManaValueBucket(cardData?.cmc);
				const group = groups.get(bucket) ?? [];
				group.push(card);
				groups.set(bucket, group);
			}
			break;
		}

		case "colorIdentity": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const label = getColorIdentityLabel(cardData?.color_identity);
				const group = groups.get(label) ?? [];
				group.push(card);
				groups.set(label, group);
			}
			break;
		}
	}

	return groups;
}

/**
 * Sort group names for consistent display order
 */
export function sortGroupNames(
	groupNames: string[],
	groupBy: GroupBy,
): string[] {
	switch (groupBy) {
		case "manaValue": {
			// Sort numerically: 0, 1, 2, ..., 7+
			return groupNames.sort((a, b) => {
				if (a === "7+") return 1;
				if (b === "7+") return -1;
				return Number.parseInt(a, 10) - Number.parseInt(b, 10);
			});
		}

		case "colorIdentity": {
			// Sort by WUBRG order, then by length (mono → multi)
			const order = ["W", "U", "B", "R", "G"];
			return groupNames.sort((a, b) => {
				if (a === "Colorless") return -1;
				if (b === "Colorless") return 1;

				// Compare by length first (mono < dual < tri, etc)
				if (a.length !== b.length) return a.length - b.length;

				// Same length, compare by first color
				const firstA = order.indexOf(a[0]);
				const firstB = order.indexOf(b[0]);
				return firstA - firstB;
			});
		}

		default:
			// Alphabetical for tag, type, subtype, etc
			return groupNames.sort((a, b) => {
				const aIsSpecial = a.startsWith("(");
				const bIsSpecial = b.startsWith("(");

				// Put special groups at the end
				if (aIsSpecial && !bIsSpecial) return 1;
				if (!aIsSpecial && bIsSpecial) return -1;

				// Both special or both normal: sort alphabetically
				return a.localeCompare(b);
			});
	}
}
