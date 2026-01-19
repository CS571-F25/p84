import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Trash2 } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { RichtextRenderer } from "@/components/richtext/RichtextRenderer";
import { type AtUri, asRkey } from "@/lib/atproto-client";
import {
	getCommentQueryOptions,
	getReplyQueryOptions,
	useDeleteCommentMutation,
	useDeleteReplyMutation,
} from "@/lib/comment-queries";
import type { BacklinkRecord } from "@/lib/constellation-client";
import {
	directReplyCountQueryOptions,
	type SocialItemUri,
} from "@/lib/constellation-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { useAuth } from "@/lib/useAuth";

type CommentType = "comment" | "reply";

interface CommentItemProps {
	backlink: BacklinkRecord;
	type: CommentType;
	subjectUri?: SocialItemUri;
	parentUri?: AtUri;
	onReply?: () => void;
}

export function CommentItem({
	backlink,
	type,
	subjectUri,
	parentUri,
	onReply,
}: CommentItemProps) {
	const { session } = useAuth();
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

	const replyCountQuery = useQuery({
		...directReplyCountQueryOptions(uri),
		enabled: !!onReply,
	});

	const { data: didDoc } = useQuery(didDocumentQueryOptions(did));
	const handle = extractHandle(didDoc ?? null);

	const isLoading =
		type === "comment" ? commentQuery.isLoading : replyQuery.isLoading;
	const isError =
		type === "comment" ? commentQuery.isError : replyQuery.isError;
	const record =
		type === "comment" ? commentQuery.data?.comment : replyQuery.data?.reply;

	if (isLoading) {
		return <CommentSkeleton />;
	}

	if (isError || !record) {
		return (
			<div className="py-3 text-sm text-gray-400 dark:text-gray-500 italic">
				[Failed to load {type}]
			</div>
		);
	}

	const handleDelete = () => {
		if (type === "comment" && subjectUri) {
			deleteCommentMutation.mutate({ rkey, subjectUri, did });
		} else if (type === "reply" && parentUri) {
			deleteReplyMutation.mutate({ rkey, parentUri, did });
		}
	};

	const replyCount = replyCountQuery.data ?? 0;

	return (
		<div className="py-3">
			<div className="flex items-start gap-3">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 text-sm">
						<Link
							to="/profile/$did"
							params={{ did }}
							className="font-medium text-gray-900 dark:text-gray-100 hover:underline"
						>
							@{handle ?? did.slice(0, 16)}
						</Link>
						<span className="text-gray-400 dark:text-gray-500">·</span>
						<ClientDate
							dateString={record.createdAt}
							format="relative"
							className="text-gray-500 dark:text-gray-400"
						/>
						{record.updatedAt && record.updatedAt !== record.createdAt && (
							<span className="text-gray-400 dark:text-gray-500 text-xs">
								(edited)
							</span>
						)}
					</div>

					<div className="mt-1 text-gray-800 dark:text-gray-200">
						<RichtextRenderer doc={record.content} />
					</div>

					<div className="mt-2 flex items-center gap-4">
						{onReply && (
							<button
								type="button"
								onClick={onReply}
								className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
							>
								<MessageSquare className="w-4 h-4" />
								{replyCount > 0 && <span>{replyCount}</span>}
							</button>
						)}

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
									className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							)}
					</div>
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
						<div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
						<div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
					</div>
					<div className="mt-2 space-y-2">
						<div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
						<div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
					</div>
				</div>
			</div>
		</div>
	);
}
