/**
 * TanStack Query integration for Constellation backlink queries
 */

import type { Did } from "@atcute/lexicons";
import {
	infiniteQueryOptions,
	type QueryClient,
	queryOptions,
	useQuery,
} from "@tanstack/react-query";
import {
	buildSource,
	COLLECTION_LIST_CARD_PATH,
	COLLECTION_LIST_DECK_PATH,
	COLLECTION_LIST_NSID,
	COMMENT_CARD_PATH,
	COMMENT_NSID,
	COMMENT_RECORD_PATH,
	DECK_LIST_CARD_PATH,
	DECK_LIST_NSID,
	getBacklinks,
	getLinksCount,
	LIKE_CARD_PATH,
	LIKE_NSID,
	LIKE_RECORD_PATH,
	REPLY_NSID,
	REPLY_PARENT_PATH,
	REPLY_ROOT_PATH,
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

/**
 * Query options for checking if current user has any deck containing a card
 */
export function userDeckContainsCardQueryOptions(
	itemUri: CardItemUri,
	userDid: Did | undefined,
) {
	return queryOptions({
		queryKey: ["constellation", "userDeckContains", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid) return false;

			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(DECK_LIST_NSID, DECK_LIST_CARD_PATH),
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
 * Query options for getting count of decks containing a card (cards only)
 */
export function cardDeckCountQueryOptions(itemUri: CardItemUri) {
	return queryOptions({
		queryKey: ["constellation", "deckCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: itemUri,
				collection: DECK_LIST_NSID,
				path: DECK_LIST_CARD_PATH,
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
	isInUserDeck: boolean;
	deckCount: number;
	isDeckCountLoading: boolean;
}

/**
 * Combined hook for item social stats (saves + likes + deck count for cards)
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

	// Deck queries only apply to cards
	const userDeckQuery = useQuery({
		...userDeckContainsCardQueryOptions(
			itemUri as CardItemUri,
			session?.info.sub,
		),
		enabled: itemType === "card" && !!session,
	});
	const deckCountQuery = useQuery({
		...cardDeckCountQueryOptions(itemUri as CardItemUri),
		enabled: itemType === "card",
	});

	return {
		isSavedByUser: savedQuery.data ?? false,
		saveCount: saveCountQuery.data ?? 0,
		isSaveLoading: savedQuery.isLoading || saveCountQuery.isLoading,
		isLikedByUser: likedQuery.data ?? false,
		likeCount: likeCountQuery.data ?? 0,
		isLikeLoading: likedQuery.isLoading || likeCountQuery.isLoading,
		isInUserDeck: userDeckQuery.data ?? false,
		deckCount: deckCountQuery.data ?? 0,
		isDeckCountLoading: itemType === "card" && deckCountQuery.isLoading,
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
		likers: ["constellation", "likers", itemUri] as const,
		savers: ["constellation", "savers", itemUri] as const,
		deckBacklinks: ["constellation", "deckBacklinks", itemUri] as const,
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

// ============================================================================
// Backlink List Queries (for modals showing who/what)
// ============================================================================

/**
 * Infinite query for users who liked an item
 */
export function itemLikersQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "likers", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(LIKE_NSID, getLikePathForItemType(itemType)),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for lists that saved an item
 */
export function itemSaversQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "savers", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(COLLECTION_LIST_NSID, getPathForItemType(itemType)),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for decks containing a card
 */
export function cardDeckBacklinksQueryOptions(itemUri: CardItemUri) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "deckBacklinks", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(DECK_LIST_NSID, DECK_LIST_CARD_PATH),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 60 * 1000,
	});
}

// ============================================================================
// Prefetch Helpers
// ============================================================================

/**
 * Prefetch social stats for an item (card or deck).
 * Use in route loaders to warm the cache before render.
 */
export function prefetchSocialStats<T extends SocialItemType>(
	queryClient: QueryClient,
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return Promise.all([
		queryClient.prefetchQuery(itemSaveCountQueryOptions(itemUri, itemType)),
		queryClient.prefetchQuery(itemLikeCountQueryOptions(itemUri, itemType)),
		itemType === "card"
			? queryClient.prefetchQuery(
					cardDeckCountQueryOptions(itemUri as CardItemUri),
				)
			: null,
	] as const);
}

// ============================================================================
// Comment Queries
// ============================================================================

function getCommentPathForItemType(itemType: SocialItemType): string {
	return itemType === "card" ? COMMENT_CARD_PATH : COMMENT_RECORD_PATH;
}

/**
 * Query options for getting top-level comment count for an item
 */
export function itemCommentCountQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return queryOptions({
		queryKey: ["constellation", "commentCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: itemUri,
				collection: COMMENT_NSID,
				path: getCommentPathForItemType(itemType),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data.total;
		},
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for top-level comments on an item (card or deck/collection)
 */
export function itemCommentsQueryOptions<T extends SocialItemType>(
	itemUri: T extends "card" ? CardItemUri : DeckItemUri,
	itemType: T,
) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "comments", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(COMMENT_NSID, getCommentPathForItemType(itemType)),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 60 * 1000,
	});
}

// ============================================================================
// Reply Queries (for threading)
// ============================================================================

/**
 * Infinite query for all replies in a thread (by root comment URI).
 * Use this to expand an entire thread - returns all replies regardless of depth.
 */
export function threadRepliesQueryOptions(rootCommentUri: string) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "threadReplies", rootCommentUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: rootCommentUri,
				source: buildSource(REPLY_NSID, REPLY_ROOT_PATH),
				limit: 50,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 60 * 1000,
	});
}

/**
 * Query options for getting direct reply count for any comment or reply.
 * Use this to show "X replies" on a specific comment.
 */
export function directReplyCountQueryOptions(commentOrReplyUri: string) {
	return queryOptions({
		queryKey: ["constellation", "directReplyCount", commentOrReplyUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: commentOrReplyUri,
				collection: REPLY_NSID,
				path: REPLY_PARENT_PATH,
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data.total;
		},
		staleTime: 60 * 1000,
	});
}
