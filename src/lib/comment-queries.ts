/**
 * TanStack Query integration for comment and reply records.
 * - Query options for fetching record content (PDS)
 * - Mutations with optimistic updates
 *
 * Backlink queries (who commented, counts) are in constellation-queries.ts
 */

import type { Did } from "@atcute/lexicons";
import { now as createTid } from "@atcute/tid";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	type AtUri,
	asRkey,
	computeRecordCid,
	createCommentRecord,
	createReplyRecord,
	deleteCommentRecord,
	deleteReplyRecord,
	getCommentRecord,
	getReplyRecord,
	type Rkey,
	updateCommentRecord,
	updateReplyRecord,
} from "./atproto-client";
import { COMMENT_NSID, REPLY_NSID } from "./constellation-client";
import type {
	ComDeckbelcherSocialComment,
	ComDeckbelcherSocialReply,
} from "./lexicons/index";
import {
	optimisticBacklinks,
	optimisticCount,
	optimisticRecord,
	runOptimistic,
} from "./optimistic-utils";
import type { SocialItemUri } from "./social-item-types";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

type CommentRecord = ComDeckbelcherSocialComment.Main;
type ReplyRecord = ComDeckbelcherSocialReply.Main;

// ============================================================================
// Query Options (fetch record content from PDS)
// ============================================================================

export interface CommentRecordData {
	comment: CommentRecord;
	cid: string;
}

export const getCommentQueryOptions = (did: Did, rkey: Rkey) =>
	queryOptions({
		queryKey: ["comment", did, rkey] as const,
		queryFn: async (): Promise<CommentRecordData> => {
			const result = await getCommentRecord(did, rkey);
			if (!result.success) {
				throw result.error;
			}
			return {
				comment: result.data.value,
				cid: result.data.cid,
			};
		},
		staleTime: 60 * 1000,
	});

export interface ReplyRecordData {
	reply: ReplyRecord;
	cid: string;
}

export const getReplyQueryOptions = (did: Did, rkey: Rkey) =>
	queryOptions({
		queryKey: ["reply", did, rkey] as const,
		queryFn: async (): Promise<ReplyRecordData> => {
			const result = await getReplyRecord(did, rkey);
			if (!result.success) {
				throw result.error;
			}
			return {
				reply: result.data.value,
				cid: result.data.cid,
			};
		},
		staleTime: 60 * 1000,
	});

// ============================================================================
// Mutations
// ============================================================================

function getSubjectUri(subject: CommentRecord["subject"]): string | undefined {
	if ("ref" in subject) {
		const ref = subject.ref;
		if ("oracleUri" in ref) return ref.oracleUri;
		if ("uri" in ref) return ref.uri;
	}
	return undefined;
}

interface CreateCommentParams {
	record: CommentRecord;
	rkey: Rkey;
}

export function useCreateCommentMutation() {
	const queryClient = useQueryClient();
	const { agent, session } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ record, rkey }: CreateCommentParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await createCommentRecord(agent, record, rkey);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ record, rkey }) => {
			const subjectUri = getSubjectUri(record.subject);
			const userDid = session?.info.sub;
			if (!subjectUri || !userDid) return;

			const cid = await computeRecordCid(record);

			const rollback = await runOptimistic([
				optimisticCount(
					queryClient,
					["constellation", "commentCount", subjectUri],
					1,
				),
				optimisticBacklinks(
					queryClient,
					["constellation", "comments", subjectUri],
					"add",
					{
						did: userDid,
						collection: COMMENT_NSID,
						rkey,
					},
				),
				optimisticRecord<CommentRecordData>(
					queryClient,
					["comment", userDid, rkey],
					{ comment: record, cid },
				),
			]);

			return { rollback };
		},
		onError: (_err, _params, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Comment posted");
		},
	});
}

/** Generate a TID for use as an rkey */
export function generateRkey(): Rkey {
	return asRkey(createTid());
}

interface CreateReplyParams {
	record: ReplyRecord;
	rkey: Rkey;
}

export function useCreateReplyMutation() {
	const queryClient = useQueryClient();
	const { agent, session } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ record, rkey }: CreateReplyParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await createReplyRecord(agent, record, rkey);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ record, rkey }) => {
			const userDid = session?.info.sub;
			if (!userDid) return;

			const parentUri = record.parent.uri;
			const cid = await computeRecordCid(record);

			const rollback = await runOptimistic([
				optimisticCount(
					queryClient,
					["constellation", "directReplyCount", parentUri],
					1,
				),
				optimisticBacklinks(
					queryClient,
					["constellation", "directReplies", parentUri],
					"add",
					{
						did: userDid,
						collection: REPLY_NSID,
						rkey,
					},
				),
				optimisticRecord<ReplyRecordData>(
					queryClient,
					["reply", userDid, rkey],
					{ reply: record, cid },
				),
			]);

			return { rollback };
		},
		onError: (_err, _params, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Reply posted");
		},
	});
}

interface DeleteCommentParams {
	rkey: Rkey;
	subjectUri: SocialItemUri;
	did: Did;
}

export function useDeleteCommentMutation() {
	const queryClient = useQueryClient();
	const { agent } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ rkey }: DeleteCommentParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await deleteCommentRecord(agent, rkey);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ rkey, subjectUri, did }) => {
			const rollback = await runOptimistic([
				optimisticCount(
					queryClient,
					["constellation", "commentCount", subjectUri],
					-1,
				),
				optimisticBacklinks(
					queryClient,
					["constellation", "comments", subjectUri],
					"remove",
					{
						did,
						collection: COMMENT_NSID,
						rkey,
					},
				),
			]);

			return { rollback };
		},
		onError: (_err, _vars, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Comment deleted");
		},
	});
}

interface DeleteReplyParams {
	rkey: Rkey;
	parentUri: AtUri;
	did: Did;
}

export function useDeleteReplyMutation() {
	const queryClient = useQueryClient();
	const { agent } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ rkey }: DeleteReplyParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await deleteReplyRecord(agent, rkey);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ rkey, parentUri, did }) => {
			const rollback = await runOptimistic([
				optimisticCount(
					queryClient,
					["constellation", "directReplyCount", parentUri],
					-1,
				),
				optimisticBacklinks(
					queryClient,
					["constellation", "directReplies", parentUri],
					"remove",
					{
						did,
						collection: REPLY_NSID,
						rkey,
					},
				),
			]);

			return { rollback };
		},
		onError: (_err, _vars, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Reply deleted");
		},
	});
}

interface UpdateCommentParams {
	did: Did;
	rkey: Rkey;
	record: CommentRecord;
}

export function useUpdateCommentMutation() {
	const queryClient = useQueryClient();
	const { agent } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ rkey, record }: UpdateCommentParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await updateCommentRecord(agent, rkey, record);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ did, rkey, record }) => {
			const rollback = await runOptimistic([
				optimisticRecord<CommentRecordData>(
					queryClient,
					["comment", did, rkey],
					(old) => (old ? { ...old, comment: record } : undefined),
				),
			]);
			return { rollback };
		},
		onError: (_err, _vars, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Comment updated");
		},
	});
}

interface UpdateReplyParams {
	did: Did;
	rkey: Rkey;
	record: ReplyRecord;
}

export function useUpdateReplyMutation() {
	const queryClient = useQueryClient();
	const { agent } = useAuth();

	return useMutationWithToast({
		mutationFn: async ({ rkey, record }: UpdateReplyParams) => {
			if (!agent) throw new Error("Not authenticated");
			const result = await updateReplyRecord(agent, rkey, record);
			if (!result.success) throw result.error;
			return result.data;
		},
		onMutate: async ({ did, rkey, record }) => {
			const rollback = await runOptimistic([
				optimisticRecord<ReplyRecordData>(
					queryClient,
					["reply", did, rkey],
					(old) => (old ? { ...old, reply: record } : undefined),
				),
			]);
			return { rollback };
		},
		onError: (_err, _vars, context) => {
			context?.rollback();
		},
		onSuccess: () => {
			toast.success("Reply updated");
		},
	});
}
