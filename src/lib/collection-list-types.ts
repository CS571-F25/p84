/**
 * Type definitions for collection lists
 * Based on generated lexicon types from com.deckbelcher.collection.list
 */

import type { ResourceUri } from "@atcute/lexicons";
import type { ComDeckbelcherCollectionList } from "./lexicons/index";
import type { OracleId, ScryfallId } from "./scryfall-types";

/**
 * App-side card item with flat typed IDs.
 * The lexicon stores ref.scryfallUri and ref.oracleUri as URIs,
 * but app code works with typed IDs after boundary parsing.
 */
export type ListCardItem = Omit<
	ComDeckbelcherCollectionList.CardItem,
	"ref"
> & {
	scryfallId: ScryfallId;
	oracleId: OracleId;
};

export type ListDeckItem = ComDeckbelcherCollectionList.DeckItem;

export type ListItem = ListCardItem | ListDeckItem;

export type CollectionList = Omit<
	ComDeckbelcherCollectionList.Main,
	"items"
> & {
	items: ListItem[];
};

export function isCardItem(item: ListItem): item is ListCardItem {
	return item.$type === "com.deckbelcher.collection.list#cardItem";
}

export function isDeckItem(item: ListItem): item is ListDeckItem {
	return item.$type === "com.deckbelcher.collection.list#deckItem";
}

export function hasCard(list: CollectionList, scryfallId: ScryfallId): boolean {
	return list.items.some(
		(item) => isCardItem(item) && item.scryfallId === scryfallId,
	);
}

export function hasDeck(list: CollectionList, deckUri: string): boolean {
	return list.items.some(
		(item) => isDeckItem(item) && item.deckUri === deckUri,
	);
}

export function addCardToList(
	list: CollectionList,
	scryfallId: ScryfallId,
	oracleId: OracleId,
): CollectionList {
	if (hasCard(list, scryfallId)) {
		return list;
	}

	const newItem: ListCardItem = {
		$type: "com.deckbelcher.collection.list#cardItem",
		scryfallId,
		oracleId,
		addedAt: new Date().toISOString(),
	};

	return {
		...list,
		items: [...list.items, newItem],
		updatedAt: new Date().toISOString(),
	};
}

export function addDeckToList(
	list: CollectionList,
	deckUri: string,
): CollectionList {
	if (hasDeck(list, deckUri)) {
		return list;
	}

	const newItem: ListDeckItem = {
		$type: "com.deckbelcher.collection.list#deckItem",
		deckUri: deckUri as ResourceUri,
		addedAt: new Date().toISOString(),
	};

	return {
		...list,
		items: [...list.items, newItem],
		updatedAt: new Date().toISOString(),
	};
}

export function removeCardFromList(
	list: CollectionList,
	scryfallId: ScryfallId,
): CollectionList {
	return {
		...list,
		items: list.items.filter(
			(item) => !(isCardItem(item) && item.scryfallId === scryfallId),
		),
		updatedAt: new Date().toISOString(),
	};
}

export function removeDeckFromList(
	list: CollectionList,
	deckUri: string,
): CollectionList {
	return {
		...list,
		items: list.items.filter(
			(item) => !(isDeckItem(item) && item.deckUri === deckUri),
		),
		updatedAt: new Date().toISOString(),
	};
}
