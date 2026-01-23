/**
 * Type definitions for social items that can have engagement (likes, saves, comments)
 * This is the single source of truth for polymorphic social item types.
 */

import type { OracleId, OracleUri, ScryfallId } from "./scryfall-types";
import { toOracleUri } from "./scryfall-types";

/**
 * URI types for social items
 * - Cards use oracle:<uuid> URIs (aggregates across printings)
 * - Decks/comments/replies use at://<did>/<collection>/<rkey> URIs
 */
export type CardItemUri = OracleUri;
export type DeckItemUri = `at://${string}`;
export type CommentUri =
	`at://${string}/com.deckbelcher.social.comment/${string}`;
export type ReplyUri = `at://${string}/com.deckbelcher.social.reply/${string}`;

/**
 * SocialItem - ALL items that can have social engagement (likes)
 * Discriminated union on 'type' field
 */
export type SocialItem =
	| { type: "card"; scryfallId: ScryfallId; oracleId: OracleId }
	| { type: "deck"; uri: DeckItemUri; cid: string }
	| { type: "comment"; uri: CommentUri; cid: string }
	| { type: "reply"; uri: ReplyUri; cid: string };

/**
 * SaveableItem - subset of SocialItem that can be saved to collection lists
 * Only cards and decks are saveable
 */
export type SaveableItem = Extract<SocialItem, { type: "card" | "deck" }>;

/**
 * CardItem - narrowed to just cards (for deck-count queries, etc.)
 */
export type CardItem = Extract<SocialItem, { type: "card" }>;

/**
 * Type guard: checks if item can be saved to collection lists
 */
export function isSaveable(item: SocialItem): item is SaveableItem {
	return item.type === "card" || item.type === "deck";
}

/**
 * Type guard: checks if item has deck count (only cards)
 */
export function hasDeckCount(
	item: SocialItem,
): item is Extract<SocialItem, { type: "card" }> {
	return item.type === "card";
}

/**
 * SocialItemType discriminator values
 */
export type SocialItemType = SocialItem["type"];

/**
 * URI type for any social item (for Constellation queries)
 */
export type SocialItemUri = CardItemUri | DeckItemUri | CommentUri | ReplyUri;

/**
 * Saveable item types (can be saved to collection lists)
 */
export type SaveableItemType = "card" | "deck";

/**
 * Get the URI for any social item (used for Constellation queries)
 * Overloads preserve type information based on item type.
 */
export function getSocialItemUri(
	item: Extract<SocialItem, { type: "card" }>,
): CardItemUri;
export function getSocialItemUri(
	item: Extract<SocialItem, { type: "deck" }>,
): DeckItemUri;
export function getSocialItemUri(
	item: Extract<SocialItem, { type: "comment" }>,
): CommentUri;
export function getSocialItemUri(
	item: Extract<SocialItem, { type: "reply" }>,
): ReplyUri;
export function getSocialItemUri(item: SaveableItem): CardItemUri | DeckItemUri;
export function getSocialItemUri(item: SocialItem): SocialItemUri;
export function getSocialItemUri(item: SocialItem): SocialItemUri {
	switch (item.type) {
		case "card":
			return toOracleUri(item.oracleId);
		case "deck":
			return item.uri;
		case "comment":
			return item.uri;
		case "reply":
			return item.uri;
	}
}

/**
 * Get a human-readable name for an item type (for toasts)
 */
export function getItemTypeName(item: SocialItem): string {
	switch (item.type) {
		case "card":
			return "Card";
		case "deck":
			return "Deck";
		case "comment":
			return "Comment";
		case "reply":
			return "Reply";
	}
}
