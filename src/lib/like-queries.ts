/**
 * TanStack Query mutations for like operations
 */

import type { ResourceUri } from "@atcute/lexicons";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createLikeRecord, deleteLikeRecord } from "./atproto-client";
import type { SaveItem } from "./collection-list-types";
import { type BacklinksResponse, LIKE_NSID } from "./constellation-client";
import { getConstellationQueryKeys } from "./constellation-queries";
import type { ComDeckbelcherSocialLike } from "./lexicons/index";
import type { OracleId, ScryfallId } from "./scryfall-types";
import { toOracleUri, toScryfallUri } from "./scryfall-types";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

type LikeSubject = ComDeckbelcherSocialLike.Main["subject"];

function buildCardSubject(
	scryfallId: ScryfallId,
	oracleId: OracleId,
): ComDeckbelcherSocialLike.CardSubject & {
	$type: "com.deckbelcher.social.like#cardSubject";
} {
	return {
		$type: "com.deckbelcher.social.like#cardSubject",
		ref: {
			scryfallUri: toScryfallUri(scryfallId),
			oracleUri: toOracleUri(oracleId),
		},
	};
}

function buildRecordSubject(
	uri: string,
	cid: string,
): ComDeckbelcherSocialLike.RecordSubject & {
	$type: "com.deckbelcher.social.like#recordSubject";
} {
	return {
		$type: "com.deckbelcher.social.like#recordSubject",
		ref: {
			uri: uri as ResourceUri,
			cid,
		},
	};
}

interface ToggleLikeParams {
	item: SaveItem;
	isLiked: boolean;
	itemName?: string;
}

/**
 * Mutation for toggling a like on a card or deck
 * Handles optimistic updates for constellation queries
 */
export function useLikeMutation() {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async (params: ToggleLikeParams) => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to like");
			}

			let subject: LikeSubject;
			if (params.item.type === "deck") {
				subject = buildRecordSubject(params.item.uri, params.item.cid);
			} else {
				subject = buildCardSubject(
					params.item.scryfallId,
					params.item.oracleId,
				);
			}

			if (params.isLiked) {
				const result = await deleteLikeRecord(agent, subject);
				if (!result.success) {
					throw result.error;
				}
				return { wasLiked: true };
			}

			const result = await createLikeRecord(agent, subject);
			if (!result.success) {
				throw result.error;
			}
			return { wasLiked: false };
		},
		onMutate: async (params: ToggleLikeParams) => {
			const userDid = session?.info.sub;
			const itemUri =
				params.item.type === "deck"
					? (params.item.uri as `at://${string}`)
					: toOracleUri(params.item.oracleId);

			const keys = getConstellationQueryKeys(itemUri, userDid);

			await queryClient.cancelQueries({ queryKey: keys.userLiked });
			await queryClient.cancelQueries({ queryKey: keys.likeCount });
			await queryClient.cancelQueries({ queryKey: keys.likers });

			const previousLiked = queryClient.getQueryData<boolean>(keys.userLiked);
			const previousCount = queryClient.getQueryData<number>(keys.likeCount);
			const previousLikers = queryClient.getQueryData<
				InfiniteData<BacklinksResponse>
			>(keys.likers);

			queryClient.setQueryData<boolean>(keys.userLiked, !params.isLiked);
			queryClient.setQueryData<number>(keys.likeCount, (old) =>
				params.isLiked ? Math.max(0, (old ?? 1) - 1) : (old ?? 0) + 1,
			);

			// Optimistically update likers list
			if (userDid) {
				queryClient.setQueryData<InfiniteData<BacklinksResponse>>(
					keys.likers,
					(old) => {
						if (params.isLiked) {
							// Remove user from likers
							if (!old) return old;
							return {
								...old,
								pages: old.pages.map((page, i) =>
									i === 0
										? {
												...page,
												total: Math.max(0, page.total - 1),
												records: page.records.filter((r) => r.did !== userDid),
											}
										: page,
								),
							};
						}
						// Add user to likers - seed cache if empty
						// WARN: rkey unknown until mutation completes
						const newRecord = { did: userDid, collection: LIKE_NSID, rkey: "" };
						if (!old) {
							return {
								pages: [{ records: [newRecord], total: 1 }],
								pageParams: [undefined],
							};
						}
						return {
							...old,
							pages: old.pages.map((page, i) =>
								i === 0
									? {
											...page,
											total: page.total + 1,
											records: [newRecord, ...page.records],
										}
									: page,
							),
						};
					},
				);
			}

			return { previousLiked, previousCount, previousLikers, keys };
		},
		onError: (_err, _params, context) => {
			if (!context) return;

			queryClient.setQueryData<boolean>(
				context.keys.userLiked,
				context.previousLiked,
			);
			queryClient.setQueryData<number>(
				context.keys.likeCount,
				context.previousCount,
			);
			if (context.previousLikers) {
				queryClient.setQueryData<InfiniteData<BacklinksResponse>>(
					context.keys.likers,
					context.previousLikers,
				);
			}
		},
		onSuccess: (data, params) => {
			const what =
				params.itemName ?? (params.item.type === "card" ? "Card" : "Deck");
			if (data.wasLiked) {
				toast.success(`Unliked ${what}`);
			} else {
				toast.success(`Liked ${what}`);
			}
		},
	});
}
