/**
 * TanStack Query integration for Constellation backlink queries
 */

import type { Did } from "@atcute/lexicons";
import { queryOptions, useQuery } from "@tanstack/react-query";
import {
	buildSource,
	COLLECTION_LIST_CARD_PATH,
	COLLECTION_LIST_DECK_PATH,
	COLLECTION_LIST_NSID,
	getBacklinks,
	getLinksCount,
} from "./constellation-client";
import type { OracleUri } from "./scryfall-types";
import { useAuth } from "./useAuth";

/**
 * Item types that can have social stats
 */
export type SocialItemType = "card" | "deck";

/**
 * URI types for each item type
 * - Cards use oracle:<uuid> URIs (aggregates across printings)
 * - Decks use at://<did>/com.deckbelcher.deck.list/<rkey> URIs
 */
export type CardItemUri = OracleUri;
export type DeckItemUri = `at://${string}`;
export type SocialItemUri = CardItemUri | DeckItemUri;

function getPathForItemType(itemType: SocialItemType): string {
	return itemType === "card"
		? COLLECTION_LIST_CARD_PATH
		: COLLECTION_LIST_DECK_PATH;
}

/**
 * Query options for checking if current user has saved an item to any list
 */
export function userSavedItemQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	userDid: Did | undefined,
	itemType: T,
) {
	return queryOptions({
		queryKey: ["constellation", "userSaved", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid) return false;

			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(COLLECTION_LIST_NSID, getPathForItemType(itemType)),
				did: userDid,
				limit: 1,
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data.records.length > 0;
		},
		enabled: !!userDid,
		staleTime: 30 * 1000,
	});
}

/**
 * Query options for getting total save count for an item
 */
export function itemSaveCountQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return queryOptions({
		queryKey: ["constellation", "saveCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: itemUri,
				collection: COLLECTION_LIST_NSID,
				path: getPathForItemType(itemType),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data.total;
		},
		staleTime: 60 * 1000,
	});
}

export interface ItemSocialStats {
	isSavedByUser: boolean;
	saveCount: number;
	isLoading: boolean;
	isSavedLoading: boolean;
	isCountLoading: boolean;
}

/**
 * Combined hook for item social stats (save state + count)
 */
export function useItemSocialStats<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
): ItemSocialStats {
	const { session } = useAuth();

	const savedQuery = useQuery(
		userSavedItemQueryOptions(itemUri, session?.info.sub, itemType),
	);

	const countQuery = useQuery(itemSaveCountQueryOptions(itemUri, itemType));

	return {
		isSavedByUser: savedQuery.data ?? false,
		saveCount: countQuery.data ?? 0,
		isLoading: savedQuery.isLoading || countQuery.isLoading,
		isSavedLoading: savedQuery.isLoading,
		isCountLoading: countQuery.isLoading,
	};
}

/**
 * Get query keys for cache invalidation/optimistic updates
 */
export function getConstellationQueryKeys(
	itemUri: SocialItemUri,
	userDid?: Did,
) {
	return {
		userSaved: ["constellation", "userSaved", itemUri, userDid] as const,
		saveCount: ["constellation", "saveCount", itemUri] as const,
	};
}
