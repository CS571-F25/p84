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
import {
	type CardItem,
	getSocialItemUri,
	isSaveable,
	type SaveableItem,
	type SaveableItemType,
	type SocialItem,
	type SocialItemType,
	type SocialItemUri,
} from "./social-item-types";
import { useAuth } from "./useAuth";

function getPathForItemType(itemType: SaveableItemType): string {
	return itemType === "card"
		? COLLECTION_LIST_CARD_PATH
		: COLLECTION_LIST_DECK_PATH;
}

/**
 * Query options for checking if current user has saved an item to any list.
 * Auto-disables when item is undefined.
 */
export function userSavedItemQueryOptions(
	item: SaveableItem | undefined,
	userDid: Did | undefined,
) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	const itemType = item?.type;
	return queryOptions({
		queryKey: ["constellation", "userSaved", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid || !itemUri || !itemType) return false;

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
		enabled: !!userDid && !!item,
		staleTime: 30 * 1000,
	});
}

/**
 * Query options for getting total save count for an item.
 * Auto-disables when item is undefined.
 */
export function itemSaveCountQueryOptions(item: SaveableItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	const itemType = item?.type;
	return queryOptions({
		queryKey: ["constellation", "saveCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			if (!itemUri || !itemType) return 0;

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
		enabled: !!item,
		staleTime: 60 * 1000,
	});
}

/**
 * Query options for checking if current user has any deck containing a card.
 * Auto-disables when item is undefined.
 */
export function userDeckContainsCardQueryOptions(
	item: CardItem | undefined,
	userDid: Did | undefined,
) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return queryOptions({
		queryKey: ["constellation", "userDeckContains", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid || !itemUri) return false;

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
		enabled: !!userDid && !!item,
		staleTime: 30 * 1000,
	});
}

/**
 * Query options for getting count of decks containing a card (cards only).
 * Auto-disables when item is undefined.
 */
export function cardDeckCountQueryOptions(item: CardItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return queryOptions({
		queryKey: ["constellation", "deckCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			if (!itemUri) return 0;

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
		enabled: !!item,
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
	/** Comment count for cards/decks, reply count for comments/replies */
	commentOrReplyCount: number;
	isCommentOrReplyCountLoading: boolean;
}

/**
 * Combined hook for item social stats (saves + likes + deck count for cards + comment/reply count)
 * For comments/replies, save-related stats are disabled and "comment count" shows reply count instead.
 */
export function useItemSocialStats(item: SocialItem): ItemSocialStats {
	const { session } = useAuth();

	// Extract narrowed items (undefined if not applicable type)
	const saveableItem = isSaveable(item) ? item : undefined;
	const cardItem = item.type === "card" ? item : undefined;
	const isCommentOrReply = item.type === "comment" || item.type === "reply";

	// Like queries apply to all item types
	const likedQuery = useQuery(
		userLikedItemQueryOptions(item, session?.info.sub),
	);
	const likeCountQuery = useQuery(itemLikeCountQueryOptions(item));

	// Save queries only apply to cards and decks (auto-disabled when undefined)
	const savedQuery = useQuery(
		userSavedItemQueryOptions(saveableItem, session?.info.sub),
	);
	const saveCountQuery = useQuery(itemSaveCountQueryOptions(saveableItem));

	// Deck queries only apply to cards (auto-disabled when undefined)
	const userDeckQuery = useQuery(
		userDeckContainsCardQueryOptions(cardItem, session?.info.sub),
	);
	const deckCountQuery = useQuery(cardDeckCountQueryOptions(cardItem));

	// Comment count for cards/decks, reply count for comments/replies
	const commentCountQuery = useQuery(
		itemCommentCountQueryOptions(saveableItem),
	);
	const replyCountQuery = useQuery({
		...directReplyCountQueryOptions(getSocialItemUri(item)),
		enabled: isCommentOrReply,
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
		isDeckCountLoading: item.type === "card" && deckCountQuery.isLoading,
		commentOrReplyCount: isCommentOrReply
			? (replyCountQuery.data ?? 0)
			: (commentCountQuery.data ?? 0),
		isCommentOrReplyCountLoading: isCommentOrReply
			? replyCountQuery.isLoading
			: commentCountQuery.isLoading,
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
	// Cards use oracleUri path, everything else (decks, comments, replies) uses record URI path
	return itemType === "card" ? LIKE_CARD_PATH : LIKE_RECORD_PATH;
}

/**
 * Query options for checking if current user has liked an item.
 * Works for all social item types.
 */
export function userLikedItemQueryOptions(
	item: SocialItem,
	userDid: Did | undefined,
) {
	const itemUri = getSocialItemUri(item);
	return queryOptions({
		queryKey: ["constellation", "userLiked", itemUri, userDid] as const,
		queryFn: async (): Promise<boolean> => {
			if (!userDid) return false;

			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(LIKE_NSID, getLikePathForItemType(item.type)),
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
 * Query options for getting total like count for an item.
 * Works for all social item types.
 */
export function itemLikeCountQueryOptions(item: SocialItem) {
	const itemUri = getSocialItemUri(item);
	return queryOptions({
		queryKey: ["constellation", "likeCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			const result = await getLinksCount({
				target: itemUri,
				collection: LIKE_NSID,
				path: getLikePathForItemType(item.type),
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
 * Infinite query for users who liked an item.
 * Works for all social item types. Auto-disables when item is undefined.
 */
export function itemLikersQueryOptions(item: SocialItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return infiniteQueryOptions({
		queryKey: ["constellation", "likers", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			if (!item || !itemUri) throw new Error("No item");
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(LIKE_NSID, getLikePathForItemType(item.type)),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		enabled: !!item,
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for lists that saved an item (only for saveable items: cards/decks).
 * Auto-disables when item is undefined.
 */
export function itemSaversQueryOptions(item: SaveableItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return infiniteQueryOptions({
		queryKey: ["constellation", "savers", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			if (!item || !itemUri) throw new Error("No item");
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(
					COLLECTION_LIST_NSID,
					getPathForItemType(item.type),
				),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		enabled: !!item,
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for decks containing a card.
 * Auto-disables when item is undefined.
 */
export function cardDeckBacklinksQueryOptions(item: CardItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return infiniteQueryOptions({
		queryKey: ["constellation", "deckBacklinks", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			if (!itemUri) throw new Error("No item");
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
		enabled: !!item,
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
export function prefetchSocialStats(
	queryClient: QueryClient,
	item: SaveableItem,
) {
	const cardItem = item.type === "card" ? item : undefined;
	return Promise.all([
		queryClient.prefetchQuery(itemSaveCountQueryOptions(item)),
		queryClient.prefetchQuery(itemLikeCountQueryOptions(item)),
		queryClient.prefetchQuery(itemCommentCountQueryOptions(item)),
		cardItem
			? queryClient.prefetchQuery(cardDeckCountQueryOptions(cardItem))
			: null,
	] as const);
}

// ============================================================================
// Comment Queries
// ============================================================================

function getCommentPathForItemType(itemType: SaveableItemType): string {
	return itemType === "card" ? COMMENT_CARD_PATH : COMMENT_RECORD_PATH;
}

/**
 * Query options for getting top-level comment count for an item.
 * Auto-disables when item is undefined.
 */
export function itemCommentCountQueryOptions(item: SaveableItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	const itemType = item?.type;
	return queryOptions({
		queryKey: ["constellation", "commentCount", itemUri] as const,
		queryFn: async (): Promise<number> => {
			if (!itemUri || !itemType) return 0;

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
		enabled: !!item,
		staleTime: 60 * 1000,
	});
}

/**
 * Infinite query for top-level comments on an item (card or deck/collection).
 * Auto-disables when item is undefined.
 */
export function itemCommentsQueryOptions(item: SaveableItem | undefined) {
	const itemUri = item ? getSocialItemUri(item) : undefined;
	return infiniteQueryOptions({
		queryKey: ["constellation", "comments", itemUri] as const,
		queryFn: async ({ pageParam }) => {
			if (!item || !itemUri) throw new Error("No item");
			const result = await getBacklinks({
				subject: itemUri,
				source: buildSource(COMMENT_NSID, getCommentPathForItemType(item.type)),
				limit: 25,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		enabled: !!item,
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

/**
 * Query for direct replies to a comment or reply.
 * Each node uses this to find its children.
 */
export function directRepliesQueryOptions(parentUri: string) {
	return infiniteQueryOptions({
		queryKey: ["constellation", "directReplies", parentUri] as const,
		queryFn: async ({ pageParam }) => {
			const result = await getBacklinks({
				subject: parentUri,
				source: buildSource(REPLY_NSID, REPLY_PARENT_PATH),
				limit: 50,
				cursor: pageParam,
			});
			if (!result.success) throw result.error;
			return result.data;
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
		staleTime: 30 * 1000,
	});
}
