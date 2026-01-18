/**
 * TanStack Query integration for profile operations
 * Provides query options and mutations with optimistic updates
 */

import type { Did } from "@atcute/lexicons";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { getProfileRecord, upsertProfileRecord } from "./atproto-client";
import type {
	ComDeckbelcherActorProfile,
	ComDeckbelcherRichtext,
} from "./lexicons/index";
import { optimisticRecord, runOptimistic } from "./optimistic-utils";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

export interface Profile {
	bio?: ComDeckbelcherRichtext.Document;
	pronouns?: string;
	createdAt: string;
}

export interface ProfileRecord {
	profile: Profile;
	cid: string;
}

/**
 * Query options for fetching a profile
 * Returns null if profile doesn't exist (new user)
 */
export const getProfileQueryOptions = (did: Did) =>
	queryOptions({
		queryKey: ["profile", did] as const,
		queryFn: async (): Promise<ProfileRecord | null> => {
			const result = await getProfileRecord(did);
			if (!result.success) {
				// Profile doesn't exist yet - return null (not an error)
				// ATProto returns 400 for RecordNotFound
				if (result.status === 400) {
					return null;
				}
				throw result.error;
			}
			return {
				profile: result.data.value,
				cid: result.data.cid,
			};
		},
		staleTime: 60 * 1000, // 1 minute
	});

/**
 * Mutation for creating/updating a profile
 * Uses upsert since rkey is always "self"
 */
export function useUpdateProfileMutation() {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async (profile: Profile) => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to update profile");
			}

			const record: ComDeckbelcherActorProfile.Main = {
				$type: "com.deckbelcher.actor.profile",
				bio: profile.bio,
				pronouns: profile.pronouns,
				createdAt: profile.createdAt,
			};

			const result = await upsertProfileRecord(agent, record);

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onMutate: async (newProfile) => {
			if (!session) return { rollback: () => {} };

			const rollback = await runOptimistic([
				optimisticRecord<ProfileRecord | null>(
					queryClient,
					["profile", session.info.sub],
					(old) => ({
						profile: newProfile,
						cid: old?.cid ?? "",
					}),
				),
			]);
			return { rollback };
		},
		onSuccess: (data, newProfile) => {
			if (!session) return;

			queryClient.setQueryData<ProfileRecord>(["profile", session.info.sub], {
				profile: newProfile,
				cid: data.cid,
			});
		},
		onError: (_err, _newProfile, context) => {
			context?.rollback();
			if (session) {
				queryClient.invalidateQueries({
					queryKey: ["profile", session.info.sub],
				});
			}
		},
	});
}
