import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { ClientDate } from "@/components/ClientDate";
import { RichtextRenderer } from "@/components/richtext/RichtextRenderer";
import { SocialStats } from "@/components/social/SocialStats";
import { type AtUri, asRkey } from "@/lib/atproto-client";
import {
	generateRkey,
	getCommentQueryOptions,
	getReplyQueryOptions,
	useCreateReplyMutation,
	useDeleteCommentMutation,
	useDeleteReplyMutation,
} from "@/lib/comment-queries";
import type { BacklinkRecord } from "@/lib/constellation-client";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import type {
	CommentUri,
	ReplyUri,
	SocialItem,
	SocialItemUri,
} from "@/lib/social-item-types";
import { useAuth } from "@/lib/useAuth";
import { CommentForm } from "./CommentForm";

type CommentType = "comment" | "reply";

interface CommentItemProps {
	backlink: BacklinkRecord;
	type: CommentType;
	subjectUri?: SocialItemUri;
	parentUri?: AtUri;
}

export function CommentItem({
	backlink,
	type,
	subjectUri,
	parentUri,
}: CommentItemProps) {
	const { session } = useAuth();
	const [showReplyForm, setShowReplyForm] = useState(false);
	const createReply = useCreateReplyMutation();

	const did = backlink.did;
	const rkey = asRkey(backlink.rkey);

	const isOwner = session?.info.sub === did;
	const uri = `at://${did}/${backlink.collection}/${rkey}` satisfies AtUri;

	const deleteCommentMutation = useDeleteCommentMutation();
	const deleteReplyMutation = useDeleteReplyMutation();

	const commentQuery = useQuery({
		...getCommentQueryOptions(did, rkey),
		enabled: type === "comment",
	});

	const replyQuery = useQuery({
		...getReplyQueryOptions(did, rkey),
		enabled: type === "reply",
	});

	const { data: didDoc } = useQuery(didDocumentQueryOptions(did));
	const handle = extractHandle(didDoc ?? null);

	const isLoading =
		type === "comment" ? commentQuery.isLoading : replyQuery.isLoading;
	const isError =
		type === "comment" ? commentQuery.isError : replyQuery.isError;
	const record =
		type === "comment" ? commentQuery.data?.comment : replyQuery.data?.reply;
	const cid =
		type === "comment" ? commentQuery.data?.cid : replyQuery.data?.cid;
	const rootRef =
		type === "comment" && cid ? { uri, cid } : replyQuery.data?.reply.root;

	// Construct SocialItem for SocialStats - requires cid from loaded record
	const socialItem: SocialItem | null = cid
		? type === "comment"
			? { type: "comment", uri: uri as CommentUri, cid }
			: { type: "reply", uri: uri as ReplyUri, cid }
		: null;

	const handleReplySubmit = useCallback(
		(content: Document) => {
			if (!session || !cid || !rootRef) return;

			createReply.mutate(
				{
					record: {
						$type: "com.deckbelcher.social.reply",
						parent: { uri, cid },
						root: rootRef,
						content,
						createdAt: new Date().toISOString(),
					},
					rkey: generateRkey(),
				},
				{
					onSuccess: () => setShowReplyForm(false),
				},
			);
		},
		[session, uri, cid, rootRef, createReply],
	);

	const handleDelete = useCallback(() => {
		if (type === "comment" && subjectUri) {
			deleteCommentMutation.mutate({ rkey, subjectUri, did });
		} else if (type === "reply" && parentUri) {
			deleteReplyMutation.mutate({ rkey, parentUri, did });
		}
	}, [
		type,
		subjectUri,
		parentUri,
		rkey,
		did,
		deleteCommentMutation,
		deleteReplyMutation,
	]);

	if (isLoading) {
		return <CommentSkeleton />;
	}

	if (isError || !record) {
		return (
			<div className="py-3 text-sm text-gray-400 dark:text-zinc-400 italic">
				[Failed to load {type}]
			</div>
		);
	}

	return (
		<div className="py-3">
			<div className="flex items-start gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 text-sm">
						<Link
							to="/profile/$did"
							params={{ did }}
							className="font-medium text-gray-900 dark:text-zinc-100 hover:underline"
						>
							@{handle ?? did.slice(0, 16)}
						</Link>
						<span className="text-gray-400 dark:text-zinc-400">·</span>
						<ClientDate
							dateString={record.createdAt}
							format="relative"
							className="text-gray-500 dark:text-zinc-300"
						/>
						{record.updatedAt && record.updatedAt !== record.createdAt && (
							<span className="text-gray-400 dark:text-zinc-400 text-xs">
								(edited)
							</span>
						)}
					</div>

					<div className="mt-1 text-gray-800 dark:text-zinc-200">
						<RichtextRenderer doc={record.content} />
					</div>

					<div className="mt-2 flex items-center gap-2">
						{/* SocialStats for likes + reply button */}
						{socialItem && (
							<SocialStats
								item={socialItem}
								showCount={true}
								onCommentClick={
									session ? () => setShowReplyForm(!showReplyForm) : undefined
								}
							/>
						)}

						{/* Delete button for owner */}
						{isOwner &&
							((type === "comment" && subjectUri) ||
								(type === "reply" && parentUri)) && (
								<button
									type="button"
									onClick={handleDelete}
									disabled={
										deleteCommentMutation.isPending ||
										deleteReplyMutation.isPending
									}
									className="flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 p-2"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							)}
					</div>

					{showReplyForm && (
						<div className="mt-3">
							<CommentForm
								onSubmit={handleReplySubmit}
								onCancel={() => setShowReplyForm(false)}
								isPending={createReply.isPending}
								placeholder="Write a reply..."
								submitLabel="Reply"
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function CommentSkeleton() {
	return (
		<div className="py-3">
			<div className="flex items-start gap-3">
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<div className="h-4 w-24 bg-gray-200 dark:bg-zinc-700 rounded motion-safe:animate-pulse" />
						<div className="h-4 w-16 bg-gray-200 dark:bg-zinc-700 rounded motion-safe:animate-pulse" />
					</div>
					<div className="mt-2 space-y-2">
						<div className="h-4 w-full bg-gray-200 dark:bg-zinc-700 rounded motion-safe:animate-pulse" />
						<div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded motion-safe:animate-pulse" />
					</div>
				</div>
			</div>
		</div>
	);
}
