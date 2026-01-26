import type { Card } from "@/lib/scryfall-types";
import { getPrimaryFace } from "./card-faces";
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

// Color combination names (guild/shard/wedge names)
// Keys are in WUBRG order (how we sort them internally)
// But we display the canonical MTG order in the UI
const COLOR_NAMES_BY_SORTED: Record<
	string,
	{ name: string; canonical: string }
> = {
	// Mono
	W: { name: "White", canonical: "W" },
	U: { name: "Blue", canonical: "U" },
	B: { name: "Black", canonical: "B" },
	R: { name: "Red", canonical: "R" },
	G: { name: "Green", canonical: "G" },
	// Guilds (2-color) - already in WUBRG order
	WU: { name: "Azorius", canonical: "WU" },
	WB: { name: "Orzhov", canonical: "WB" },
	WR: { name: "Boros", canonical: "WR" },
	WG: { name: "Selesnya", canonical: "WG" },
	UB: { name: "Dimir", canonical: "UB" },
	UR: { name: "Izzet", canonical: "UR" },
	UG: { name: "Simic", canonical: "UG" },
	BR: { name: "Rakdos", canonical: "BR" },
	BG: { name: "Golgari", canonical: "BG" },
	RG: { name: "Gruul", canonical: "RG" },
	// Shards (3-color, color + 2 allies)
	WUG: { name: "Bant", canonical: "GWU" }, // Sorted WUG, shown as GWU
	WUB: { name: "Esper", canonical: "WUB" },
	UBR: { name: "Grixis", canonical: "UBR" },
	BRG: { name: "Jund", canonical: "BRG" },
	WRG: { name: "Naya", canonical: "RGW" }, // Sorted WRG, shown as RGW
	// Wedges (3-color, color + 2 enemies)
	WBG: { name: "Abzan", canonical: "WBG" },
	WUR: { name: "Jeskai", canonical: "URW" }, // Sorted WUR, shown as URW
	UBG: { name: "Sultai", canonical: "BGU" }, // Sorted UBG, shown as BGU
	WBR: { name: "Mardu", canonical: "RWB" }, // Sorted WBR, shown as RWB
	URG: { name: "Temur", canonical: "GUR" }, // Sorted URG, shown as GUR
	// 4-color
	WUBR: { name: "Non-Green", canonical: "WUBR" },
	WUBG: { name: "Non-Red", canonical: "WUBG" },
	WURG: { name: "Non-Black", canonical: "WURG" },
	WBRG: { name: "Non-Blue", canonical: "WBRG" },
	UBRG: { name: "Non-White", canonical: "UBRG" },
	// 5-color
	WUBRG: { name: "Five-Color", canonical: "WUBRG" },
};

/**
 * Get a label for a color identity
 * Example: ["W", "U"] → "Azorius (WU)"
 * Example: ["U"] → "Blue"
 * Example: [] → "Colorless"
 */
export function getColorIdentityLabel(
	colorIdentity: string[] | undefined,
): string {
	if (!colorIdentity || colorIdentity.length === 0) return "Colorless";

	// Sort in WUBRG order for lookup
	const order = ["W", "U", "B", "R", "G"];
	const sorted = [...colorIdentity].sort(
		(a, b) => order.indexOf(a) - order.indexOf(b),
	);

	const sortedKey = sorted.join("");
	const colorInfo = COLOR_NAMES_BY_SORTED[sortedKey];

	// For mono-color, just return the name
	if (sorted.length === 1) return colorInfo?.name ?? sortedKey;

	// For multi-color, return "Name (Canonical)"
	return colorInfo ? `${colorInfo.name} (${colorInfo.canonical})` : sortedKey;
}

/**
 * Get mana value bucket for grouping
 * Example: 0 → "0", 0.5 → "1", 3 → "3", 8 → "8"
 */
export function getManaValueBucket(cmc: number | undefined): string {
	if (cmc === undefined || cmc === 0) return "0";
	return Math.ceil(cmc).toString();
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
 * also includes a bool to indicate if the group is based on a user tag
 *
 * Note: Cards with multiple tags will appear in multiple groups
 */
export function groupCards(
	cards: DeckCard[],
	cardLookup: CardLookup,
	groupBy: GroupBy,
): Map<
	string,
	{
		cards: DeckCard[];
		forTag: boolean;
	}
> {
	const groups = new Map<
		string,
		{
			cards: DeckCard[];
			forTag: boolean;
		}
	>();

	switch (groupBy) {
		case "none": {
			groups.set("all", { cards, forTag: false });
			break;
		}

		case "type": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const face = cardData ? getPrimaryFace(cardData) : undefined;
				const type = extractPrimaryType(face?.type_line);
				const group = groups.get(type) ?? { cards: [], forTag: false };
				group.cards.push(card);
				groups.set(type, group);
			}
			break;
		}

		case "typeAndTags": {
			for (const card of cards) {
				if (!card.tags || card.tags.length === 0) {
					// No tags → group by type
					const cardData = cardLookup(card);
					const face = cardData ? getPrimaryFace(cardData) : undefined;
					const type = extractPrimaryType(face?.type_line);
					const group = groups.get(type) ?? { cards: [], forTag: false };
					group.cards.push(card);
					groups.set(type, group);
				} else {
					// Has tags → add to each unique tag group (dedupe to handle malformed data)
					for (const tag of new Set(card.tags)) {
						const group = groups.get(tag) ?? { cards: [], forTag: true };
						group.forTag = true;
						group.cards.push(card);
						groups.set(tag, group);
					}
				}
			}
			break;
		}

		case "typeAndTagCount": {
			// Group by type first, then by tag count within type
			// Format: "Type (N tags)" or "Type (no tags)"
			for (const card of cards) {
				const cardData = cardLookup(card);
				const face = cardData ? getPrimaryFace(cardData) : undefined;
				const type = extractPrimaryType(face?.type_line);
				const tagCount = card.tags?.length ?? 0;
				const countLabel =
					tagCount === 0
						? "no tags"
						: tagCount === 1
							? "1 tag"
							: `${tagCount} tags`;
				const groupName = `${type} (${countLabel})`;
				const group = groups.get(groupName) ?? { cards: [], forTag: false };
				group.cards.push(card);
				groups.set(groupName, group);
			}
			break;
		}

		case "subtype": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const face = cardData ? getPrimaryFace(cardData) : undefined;
				const subtypes = extractSubtypes(face?.type_line);

				if (subtypes.length === 0) {
					const group = groups.get("(No Subtype)") ?? {
						cards: [],
						forTag: false,
					};
					group.cards.push(card);
					groups.set("(No Subtype)", group);
				} else {
					// Add card to each subtype group it belongs to
					for (const subtype of subtypes) {
						const group = groups.get(subtype) ?? { cards: [], forTag: false };
						group.cards.push(card);
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
				const group = groups.get(bucket) ?? { cards: [], forTag: false };
				group.cards.push(card);
				groups.set(bucket, group);
			}
			break;
		}

		case "colorIdentity": {
			for (const card of cards) {
				const cardData = cardLookup(card);
				const label = getColorIdentityLabel(cardData?.color_identity);
				const group = groups.get(label) ?? { cards: [], forTag: false };
				group.cards.push(card);
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
	groups: Map<string, { cards: DeckCard[]; forTag: boolean }>,
	groupBy: GroupBy,
): string[] {
	const groupNames = Array.from(groups.keys());

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

		case "typeAndTags": {
			// Sort tags before types, then alphabetically within each category
			return groupNames.sort((a, b) => {
				const aIsSpecial = a.startsWith("(");
				const bIsSpecial = b.startsWith("(");
				const aIsTag = groups.get(a)?.forTag ?? false;
				const bIsTag = groups.get(b)?.forTag ?? false;

				// Put special groups at the end
				if (aIsSpecial && !bIsSpecial) return 1;
				if (!aIsSpecial && bIsSpecial) return -1;

				// Tags before types
				if (aIsTag && !bIsTag) return -1;
				if (!aIsTag && bIsTag) return 1;

				// Both tags, both types, or both special: sort alphabetically
				return a.localeCompare(b);
			});
		}

		case "typeAndTagCount": {
			// Sort by tag count ascending, then by type
			// Format: "Type (N tags)" or "Type (no tags)"
			const parseGroup = (name: string) => {
				const match = name.match(/^(.+) \((\d+|no) tags?\)$/);
				if (!match) return { type: name, count: 0 };
				const countStr = match[2];
				return {
					type: match[1],
					count: countStr === "no" ? 0 : parseInt(countStr, 10),
				};
			};

			return groupNames.sort((a, b) => {
				const parsedA = parseGroup(a);
				const parsedB = parseGroup(b);

				// Sort by tag count first (fewer tags = cut candidates at top)
				if (parsedA.count !== parsedB.count) {
					return parsedA.count - parsedB.count;
				}

				// Then by type alphabetically
				return parsedA.type.localeCompare(parsedB.type);
			});
		}

		default:
			// Alphabetical for type, subtype, etc
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
