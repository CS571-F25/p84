import { useQuery } from "@tanstack/react-query";
import { DeckPreview } from "@/components/DeckPreview";
import { recentDecksQueryOptions } from "@/lib/ufos-queries";

interface ActivityFeedProps {
	limit?: number;
}

export function ActivityFeed({ limit = 6 }: ActivityFeedProps) {
	const {
		data: records,
		isLoading,
		error,
	} = useQuery(recentDecksQueryOptions(limit));

	if (isLoading) {
		return <ActivityFeedSkeleton count={limit} />;
	}

	if (error || !records) {
		return (
			<div className="text-center py-8 text-gray-500 dark:text-gray-400">
				Unable to load recent activity
			</div>
		);
	}

	if (records.length === 0) {
		return (
			<div className="text-center py-8 text-gray-500 dark:text-gray-400">
				No recent activity yet
			</div>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{records.map((record) => (
				<DeckPreview
					key={`${record.did}/${record.rkey}`}
					did={record.did}
					rkey={record.rkey}
					deck={record.record}
					showHandle
					showCounts={false}
				/>
			))}
		</div>
	);
}

function ActivityFeedSkeleton({ count }: { count: number }) {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
					key={i}
					className="flex gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg animate-pulse"
				>
					<div className="flex-shrink-0 w-16 h-[90px] bg-gray-200 dark:bg-slate-700 rounded" />
					<div className="flex-1 min-w-0">
						{/* Handle */}
						<div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-1" />
						{/* Name */}
						<div className="h-7 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
						{/* Format */}
						<div className="h-5 w-20 bg-gray-200 dark:bg-slate-700 rounded mt-1" />
						{/* Date */}
						<div className="h-5 w-28 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
					</div>
				</div>
			))}
		</div>
	);
}
