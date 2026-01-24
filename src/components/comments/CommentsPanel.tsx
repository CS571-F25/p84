import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MessageSquare, X } from "lucide-react";
import { useCallback, useState } from "react";
import { generateRkey, useCreateCommentMutation } from "@/lib/comment-queries";
import {
	itemCommentCountQueryOptions,
	itemCommentsQueryOptions,
} from "@/lib/constellation-queries";
import type { ComDeckbelcherSocialComment } from "@/lib/lexicons/index";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import {
	type CommentableItem,
	getSocialItemUri,
} from "@/lib/social-item-types";
import { useAuth } from "@/lib/useAuth";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";

type CommentSubject = ComDeckbelcherSocialComment.Main["subject"];

interface CommentsPanelProps {
	subject: CommentSubject;
	item: CommentableItem;
	title?: string;
	onClose?: () => void;
	availableTags?: string[];
	/** Tailwind max-height class for internal scrolling (default: max-h-[64rem]) */
	maxHeight?: string;
}

export function CommentsPanel({
	subject,
	item,
	title = "Comments",
	onClose,
	availableTags,
	maxHeight = "max-h-[64rem]",
}: CommentsPanelProps) {
	const { session } = useAuth();
	const [showForm, setShowForm] = useState(false);
	const createComment = useCreateCommentMutation();

	const subjectUri = getSocialItemUri(item);

	const countQuery = useQuery(itemCommentCountQueryOptions(item));

	const commentsQuery = useInfiniteQuery(itemCommentsQueryOptions(item));

	const comments = commentsQuery.data?.pages.flatMap((p) => p.records) ?? [];
	const count = countQuery.data ?? 0;

	const handleSubmit = useCallback(
		(content: Document) => {
			if (!session) return;
			setShowForm(false);
			createComment.mutate({
				record: {
					$type: "com.deckbelcher.social.comment",
					subject,
					content,
					createdAt: new Date().toISOString(),
				},
				rkey: generateRkey(),
			});
		},
		[createComment, session, subject],
	);

	return (
		<div className={`flex flex-col ${maxHeight} bg-white dark:bg-zinc-900`}>
			<div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-600">
				<div className="flex items-center gap-2">
					<MessageSquare className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
					<h2 className="font-semibold text-gray-900 dark:text-zinc-100">
						{title}
					</h2>
					{count > 0 && (
						<span className="text-sm text-gray-500 dark:text-zinc-300">
							({count})
						</span>
					)}
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-300"
					>
						<X className="w-5 h-5" />
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto px-4">
				{commentsQuery.isLoading && (
					<div className="py-8 text-center text-gray-500 dark:text-zinc-300">
						Loading comments...
					</div>
				)}

				{!commentsQuery.isLoading && comments.length === 0 && (
					<div className="py-8 text-center text-gray-500 dark:text-zinc-300">
						No comments yet. Be the first to comment!
					</div>
				)}

				{comments.length > 0 && (
					<div className="divide-y divide-gray-100 dark:divide-zinc-800">
						{comments.map((comment) => (
							<CommentThread
								key={`${comment.did}/${comment.rkey}`}
								backlink={comment}
								type="comment"
								subjectUri={subjectUri}
							/>
						))}
					</div>
				)}

				{commentsQuery.hasNextPage && (
					<div className="py-4 text-center">
						<button
							type="button"
							onClick={() => commentsQuery.fetchNextPage()}
							disabled={commentsQuery.isFetchingNextPage}
							className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							{commentsQuery.isFetchingNextPage
								? "Loading..."
								: "Load more comments"}
						</button>
					</div>
				)}
			</div>

			{session && (
				<div className="border-t border-gray-200 dark:border-zinc-600 px-4 py-2">
					{showForm ? (
						<CommentForm
							onSubmit={handleSubmit}
							onCancel={() => setShowForm(false)}
							isPending={createComment.isPending}
							placeholder="Write a comment..."
							availableTags={availableTags}
						/>
					) : (
						<button
							type="button"
							onClick={() => setShowForm(true)}
							className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-700"
						>
							Write a comment...
						</button>
					)}
				</div>
			)}

			{!session && (
				<div className="border-t border-gray-200 dark:border-zinc-600 px-4 py-3 text-center text-sm text-gray-500 dark:text-zinc-300">
					Sign in to comment
				</div>
			)}
		</div>
	);
}
