/**
 * TanStack Query mutations for like operations
 */

import type { ResourceUri } from "@atcute/lexicons";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createLikeRecord, deleteLikeRecord } from "./atproto-client";
import type { SaveItem } from "./collection-list-types";
import { LIKE_NSID } from "./constellation-client";
import { getConstellationQueryKeys } from "./constellation-queries";
import type { ComDeckbelcherSocialLike } from "./lexicons/index";
import {
	optimisticBacklinks,
	optimisticToggle,
	runOptimistic,
	when,
} from "./optimistic-utils";
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
			const newLikedState = !params.isLiked;

			const rollback = await runOptimistic([
				optimisticToggle(
					queryClient,
					keys.userLiked,
					keys.likeCount,
					newLikedState,
				),
				// rkey is deterministic (hash of subject) but empty is fine here
				// since backlinks filtering is by did, not rkey
				when(userDid, (did) =>
					optimisticBacklinks(
						queryClient,
						keys.likers,
						newLikedState ? "add" : "remove",
						{
							did,
							collection: LIKE_NSID,
							rkey: "",
						},
					),
				),
			]);

			return { rollback };
		},
		onError: (_err, _params, context) => {
			context?.rollback();
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
