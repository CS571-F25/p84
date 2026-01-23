/**
 * TanStack Query mutations for like operations
 */

import type { ResourceUri } from "@atcute/lexicons";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	createLikeRecord,
	deleteLikeRecord,
	hashToRkey,
} from "./atproto-client";
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
import {
	getItemTypeName,
	getSocialItemUri,
	type SocialItem,
} from "./social-item-types";
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
	item: SocialItem;
	isLiked: boolean;
	itemName?: string;
}

/**
 * Build the like subject for any social item type.
 * Cards use cardSubject, everything else uses recordSubject.
 */
function buildLikeSubject(item: SocialItem): LikeSubject {
	if (item.type === "card") {
		return buildCardSubject(item.scryfallId, item.oracleId);
	}
	// deck, comment, reply all use recordSubject with uri + cid
	return buildRecordSubject(item.uri, item.cid);
}

/**
 * Mutation for toggling a like on any social item (card, deck, comment, reply)
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

			const subject = buildLikeSubject(params.item);

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
			const itemUri = getSocialItemUri(params.item);

			const keys = getConstellationQueryKeys(itemUri, userDid);
			const newLikedState = !params.isLiked;

			// Compute the deterministic rkey from subject ref (same as create/delete)
			const subject = buildLikeSubject(params.item);
			const rkey = await hashToRkey(subject.ref);

			const rollback = await runOptimistic([
				optimisticToggle(
					queryClient,
					keys.userLiked,
					keys.likeCount,
					newLikedState,
				),
				when(userDid, (did) =>
					optimisticBacklinks(
						queryClient,
						keys.likers,
						newLikedState ? "add" : "remove",
						{
							did,
							collection: LIKE_NSID,
							rkey,
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
			const what = params.itemName ?? getItemTypeName(params.item);
			if (data.wasLiked) {
				toast.success(`Unliked ${what}`);
			} else {
				toast.success(`Liked ${what}`);
			}
		},
	});
}
