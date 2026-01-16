import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Bookmark, Heart, Loader2, Rows3, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import {
	type CardItemUri,
	cardDeckBacklinksQueryOptions,
	type DeckItemUri,
	itemLikersQueryOptions,
	itemSaversQueryOptions,
	type SocialItemType,
	type SocialItemUri,
} from "@/lib/constellation-queries";
import { BacklinkRow, type BacklinkType, RowSkeleton } from "./BacklinkRow";

interface BacklinkModalProps {
	isOpen: boolean;
	onClose: () => void;
	type: BacklinkType;
	itemUri: SocialItemUri;
	itemType: SocialItemType;
	total: number;
}

const MODAL_CONFIG = {
	likes: {
		title: "Liked by",
		icon: Heart,
		iconBg: "bg-red-100 dark:bg-red-900/30",
		iconColor: "text-red-600 dark:text-red-400",
	},
	saves: {
		title: "Saved to lists",
		icon: Bookmark,
		iconBg: "bg-blue-100 dark:bg-blue-900/30",
		iconColor: "text-blue-600 dark:text-blue-400",
	},
	decks: {
		title: "In decks",
		icon: Rows3,
		iconBg: "bg-purple-100 dark:bg-purple-900/30",
		iconColor: "text-purple-600 dark:text-purple-400",
	},
} as const;

export function BacklinkModal({
	isOpen,
	onClose,
	type,
	itemUri,
	itemType,
	total,
}: BacklinkModalProps) {
	const titleId = useId();
	const scrollRef = useRef<HTMLDivElement>(null);
	const config = MODAL_CONFIG[type];
	const Icon = config.icon;

	const likersQuery = useInfiniteQuery({
		...itemLikersQueryOptions(itemUri as CardItemUri | DeckItemUri, itemType),
		enabled: isOpen && type === "likes",
	});

	const saversQuery = useInfiniteQuery({
		...itemSaversQueryOptions(itemUri as CardItemUri | DeckItemUri, itemType),
		enabled: isOpen && type === "saves",
	});

	const decksQuery = useInfiniteQuery({
		...cardDeckBacklinksQueryOptions(itemUri as CardItemUri),
		enabled: isOpen && type === "decks",
	});

	const activeQuery =
		type === "likes"
			? likersQuery
			: type === "saves"
				? saversQuery
				: decksQuery;

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		activeQuery;

	const allRecords = data?.pages.flatMap((page) => page.records) ?? [];

	const virtualizer = useVirtualizer({
		count: allRecords.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => (type === "likes" ? 44 : 80),
		overscan: 5,
	});

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [isOpen, onClose]);

	const virtualItems = virtualizer.getVirtualItems();
	const lastItem = virtualItems[virtualItems.length - 1];
	const shouldFetchMore =
		lastItem &&
		lastItem.index >= allRecords.length - 5 &&
		hasNextPage &&
		!isFetchingNextPage;

	useEffect(() => {
		if (shouldFetchMore) {
			fetchNextPage();
		}
	}, [shouldFetchMore, fetchNextPage]);

	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Dialog */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-xl w-full pointer-events-auto border border-gray-300 dark:border-slate-700 flex flex-col h-[70vh]"
				>
					{/* Header */}
					<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
						<div className="flex items-center gap-3">
							<div className={`p-2 ${config.iconBg} rounded-full`}>
								<Icon className={`w-5 h-5 ${config.iconColor}`} />
							</div>
							<div>
								<h2
									id={titleId}
									className="text-xl font-bold text-gray-900 dark:text-white"
								>
									{config.title}
								</h2>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									{total.toLocaleString()}{" "}
									{total === 1
										? type === "likes"
											? "person"
											: type === "saves"
												? "list"
												: "deck"
										: type === "likes"
											? "people"
											: type === "saves"
												? "lists"
												: "decks"}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
							aria-label="Close"
						>
							<X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
						</button>
					</div>

					{/* Body */}
					<div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4">
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 6 }).map((_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
									<RowSkeleton key={i} />
								))}
							</div>
						) : allRecords.length === 0 ? (
							<p className="text-gray-600 dark:text-gray-400 text-center py-4">
								No {type} yet
							</p>
						) : (
							<div
								className="relative w-full"
								style={{ height: virtualizer.getTotalSize() }}
							>
								{virtualItems.map((virtualRow) => {
									const record = allRecords[virtualRow.index];
									if (!record) return null;
									return (
										<div
											key={virtualRow.key}
											data-index={virtualRow.index}
											ref={virtualizer.measureElement}
											className="absolute top-0 left-0 w-full"
											style={{
												transform: `translateY(${virtualRow.start}px)`,
											}}
										>
											<BacklinkRow type={type} record={record} />
										</div>
									);
								})}
							</div>
						)}

						{isFetchingNextPage && (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="w-5 h-5 animate-spin text-gray-400" />
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
