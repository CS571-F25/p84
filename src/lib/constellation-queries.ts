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
	LIKE_CARD_PATH,
	LIKE_NSID,
	LIKE_RECORD_PATH,
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
	isSaveLoading: boolean;
	isLikedByUser: boolean;
	likeCount: number;
	isLikeLoading: boolean;
}

/**
 * Combined hook for item social stats (saves + likes)
 */
export function useItemSocialStats<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
): ItemSocialStats {
	const { session } = useAuth();

	const savedQuery = useQuery(
		userSavedItemQueryOptions(itemUri, session?.info.sub, itemType),
	);
	const saveCountQuery = useQuery(itemSaveCountQueryOptions(itemUri, itemType));

	const likedQuery = useQuery(
		userLikedItemQueryOptions(itemUri, session?.info.sub, itemType),
	);
	const likeCountQuery = useQuery(itemLikeCountQueryOptions(itemUri, itemType));

	return {
		isSavedByUser: savedQuery.data ?? false,
		saveCount: saveCountQuery.data ?? 0,
		isSaveLoading: savedQuery.isLoading || saveCountQuery.isLoading,
		isLikedByUser: likedQuery.data ?? false,
		likeCount: likeCountQuery.data ?? 0,
		isLikeLoading: likedQuery.isLoading || likeCountQuery.isLoading,
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
		userLiked: ["constellation", "userLiked", itemUri, userDid] as const,
		likeCount: ["constellation", "likeCount", itemUri] as const,
	};
}

// ============================================================================
// Like Queries
// ============================================================================

function getLikePathForItemType(itemType: SocialItemType): string {
	return itemType === "card" ? LIKE_CARD_PATH : LIKE_RECORD_PATH;
}

/**
 * Query options for checking if current user has liked an item
 */
export function userLikedItemQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	userDid: Did | undefined,
	itemType: T,
) {
	return queryOptions({
		queryKey: ["constellation", "userLiked", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid) return false;

			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(LIKE_NSID, getLikePathForItemType(itemType)),
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
 * Query options for getting total like count for an item
 */
export function itemLikeCountQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return queryOptions({
		queryKey: ["constellation", "likeCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: itemUri,
				collection: LIKE_NSID,
				path: getLikePathForItemType(itemType),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data.total;
		},
		staleTime: 60 * 1000,
	});
}
