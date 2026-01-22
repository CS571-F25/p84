import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type AtUri, asRkey } from "@/lib/atproto-client";
import type { BacklinkRecord } from "@/lib/constellation-client";
import {
	directRepliesQueryOptions,
	directReplyCountQueryOptions,
	type SocialItemUri,
} from "@/lib/constellation-queries";
import { CommentItem } from "./CommentItem";

interface CommentThreadProps {
	backlink: BacklinkRecord;
	type: "comment" | "reply";
	subjectUri: SocialItemUri;
	/** URI of the parent comment/reply (for deletion cache updates) */
	parentUri?: AtUri;
	depth?: number;
}

export function CommentThread({
	backlink,
	type,
	subjectUri,
	parentUri,
	depth = 0,
}: CommentThreadProps) {
	const [showReplies, setShowReplies] = useState(depth < 2);

	const did = backlink.did;
	const rkey = asRkey(backlink.rkey);
	const uri = `at://${did}/${backlink.collection}/${rkey}` satisfies AtUri;

	const replyCountQuery = useQuery(directReplyCountQueryOptions(uri));
	const replyCount = replyCountQuery.data ?? 0;

	const repliesQuery = useInfiniteQuery({
		...directRepliesQueryOptions(uri),
		enabled: showReplies,
	});

	const replies = repliesQuery.data?.pages.flatMap((p) => p.records) ?? [];
	const hasReplies = replyCount > 0 || replies.length > 0;

	return (
		<div
			className={
				depth > 0 ? "pl-4 border-l border-gray-200 dark:border-slate-700" : ""
			}
		>
			<CommentItem
				backlink={backlink}
				type={type}
				subjectUri={subjectUri}
				parentUri={parentUri}
			/>

			{hasReplies && !showReplies && (
				<button
					type="button"
					onClick={() => setShowReplies(true)}
					className="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
				>
					{replyCount === 1 ? "Show 1 reply" : `Show ${replyCount} replies`}
				</button>
			)}

			{showReplies && replies.length > 0 && (
				<div className="mt-1">
					{replies.map((reply) => (
						<CommentThread
							key={`${reply.did}/${reply.rkey}`}
							backlink={reply}
							type="reply"
							subjectUri={subjectUri}
							parentUri={uri}
							depth={depth + 1}
						/>
					))}
				</div>
			)}

			{showReplies && repliesQuery.hasNextPage && (
				<button
					type="button"
					onClick={() => repliesQuery.fetchNextPage()}
					disabled={repliesQuery.isFetchingNextPage}
					className="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
				>
					{repliesQuery.isFetchingNextPage ? "Loading..." : "Load more replies"}
				</button>
			)}
		</div>
	);
}
