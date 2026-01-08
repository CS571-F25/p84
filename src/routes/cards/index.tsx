import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, ChevronDown, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardSkeleton, CardThumbnail } from "@/components/CardImage";
import { OracleText } from "@/components/OracleText";
import {
	getCardsMetadataQueryOptions,
	PAGE_SIZE,
	searchPageQueryOptions,
} from "@/lib/queries";
import type { Card, SortOption } from "@/lib/search-types";
import { useDebounce } from "@/lib/useDebounce";

export const Route = createFileRoute("/cards/")({
	ssr: false,
	component: CardsPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			q: (search.q as string) || "",
			sort: (search.sort as string) || undefined,
		};
	},
});

function MetadataDisplay() {
	const { data: metadata } = useQuery(getCardsMetadataQueryOptions());

	if (!metadata) {
		return (
			<p className="text-gray-400">
				<Loader2 className="inline w-4 h-4 animate-spin" />
			</p>
		);
	}

	return (
		<p className="text-gray-400">
			{metadata.cardCount.toLocaleString()} cards • Version: {metadata.version}{" "}
			• Data from{" "}
			<a
				href="https://scryfall.com"
				target="_blank"
				rel="noopener noreferrer"
				className="text-cyan-600 dark:text-cyan-400 hover:underline"
			>
				Scryfall
			</a>
		</p>
	);
}

// Breakpoints match Tailwind: grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
function getColumns() {
	if (typeof window === "undefined") return 5;
	const width = window.innerWidth;
	if (width >= 1280) return 5;
	if (width >= 1024) return 4;
	if (width >= 768) return 3;
	return 2;
}

function useColumns() {
	const [columns, setColumns] = useState(getColumns);

	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout>;
		const update = () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => setColumns(getColumns()), 150);
		};

		window.addEventListener("resize", update);
		return () => {
			clearTimeout(timeout);
			window.removeEventListener("resize", update);
		};
	}, []);

	return columns;
}

const SCROLL_STORAGE_KEY = "cards-scroll-position";

const SORT_OPTIONS: { value: string; label: string; sort: SortOption }[] = [
	{
		value: "name-asc",
		label: "Name (A to Z)",
		sort: { field: "name", direction: "asc" },
	},
	{
		value: "name-desc",
		label: "Name (Z to A)",
		sort: { field: "name", direction: "desc" },
	},
	{
		value: "mv-asc",
		label: "Mana Value (Low to High)",
		sort: { field: "mv", direction: "asc" },
	},
	{
		value: "mv-desc",
		label: "Mana Value (High to Low)",
		sort: { field: "mv", direction: "desc" },
	},
	{
		value: "released-desc",
		label: "Release (Newest)",
		sort: { field: "released", direction: "desc" },
	},
	{
		value: "released-asc",
		label: "Release (Oldest)",
		sort: { field: "released", direction: "asc" },
	},
	{
		value: "rarity-desc",
		label: "Rarity (Mythic to Common)",
		sort: { field: "rarity", direction: "desc" },
	},
	{
		value: "rarity-asc",
		label: "Rarity (Common to Mythic)",
		sort: { field: "rarity", direction: "asc" },
	},
];

const DEFAULT_SORT = SORT_OPTIONS[0];

function CardsPage() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const { value: debouncedSearchQuery } = useDebounce(search.q || "", 400);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const columns = useColumns();
	const hasRestoredScroll = useRef(false);
	const sortOption =
		SORT_OPTIONS.find((o) => o.value === search.sort) ?? DEFAULT_SORT;

	// First page query to get totalCount and metadata
	const firstPageQuery = useQuery(
		searchPageQueryOptions(debouncedSearchQuery, 0, undefined, sortOption.sort),
	);
	const totalCount = firstPageQuery.data?.totalCount ?? 0;
	const hasError = firstPageQuery.data?.error != null;

	const rowCount = Math.ceil(totalCount / columns);

	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		estimateSize: () => 300, // Initial estimate, measureElement will correct it
		overscan: 2,
		scrollMargin: listRef.current?.offsetTop ?? 0,
	});

	// Save clicked card's row before navigating to detail
	const saveScrollPosition = (cardIndex: number) => {
		if (!debouncedSearchQuery) return;
		const rowIndex = Math.floor(cardIndex / columns);
		sessionStorage.setItem(
			SCROLL_STORAGE_KEY,
			JSON.stringify({
				query: debouncedSearchQuery,
				rowIndex,
			}),
		);
		// Reset window scroll before navigation. useWindowVirtualizer reads
		// window.scrollY during React reconciliation and calls scrollTo() with
		// that value—causing the old scroll position to bleed into the new page.
		// This must happen before navigation starts, not in a cleanup effect.
		window.scrollTo(0, 0);
	};

	// Restore scroll position after data loads
	useEffect(() => {
		if (hasRestoredScroll.current || !firstPageQuery.data || rowCount === 0)
			return;

		try {
			const saved = sessionStorage.getItem(SCROLL_STORAGE_KEY);
			if (!saved) {
				hasRestoredScroll.current = true;
				return;
			}

			const { query, rowIndex } = JSON.parse(saved);
			if (query === debouncedSearchQuery && rowIndex > 0) {
				sessionStorage.removeItem(SCROLL_STORAGE_KEY);
				virtualizer.scrollToIndex(rowIndex, { align: "center" });
			}
		} catch {
			// Ignore parse errors
		}

		hasRestoredScroll.current = true;
	}, [firstPageQuery.data, debouncedSearchQuery, rowCount, virtualizer]);

	// Calculate which pages are needed based on visible rows (excluding page 0, handled by firstPageQuery)
	const visibleItems = virtualizer.getVirtualItems();
	const extraOffsets = (() => {
		if (!debouncedSearchQuery.trim() || visibleItems.length === 0) return [];

		const firstRowIndex = visibleItems[0]?.index ?? 0;
		const lastRowIndex = visibleItems[visibleItems.length - 1]?.index ?? 0;

		const firstCardIndex = firstRowIndex * columns;
		const lastCardIndex = (lastRowIndex + 1) * columns - 1;

		const firstPage = Math.floor(firstCardIndex / PAGE_SIZE);
		const lastPage = Math.floor(lastCardIndex / PAGE_SIZE);

		const offsets: number[] = [];
		for (let p = firstPage; p <= lastPage; p++) {
			const offset = p * PAGE_SIZE;
			if (offset > 0) offsets.push(offset); // Skip page 0, already fetched
		}
		return offsets;
	})();

	// Fetch additional pages beyond page 0
	const extraPageQueries = useQueries({
		queries: extraOffsets.map((offset) =>
			searchPageQueryOptions(
				debouncedSearchQuery,
				offset,
				undefined,
				sortOption.sort,
			),
		),
	});

	// Build card map from all loaded pages
	const cardMap = useMemo(() => {
		const map = new Map<number, Card>();

		// Add cards from first page
		const firstPageCards = firstPageQuery.data?.cards;
		if (firstPageCards) {
			for (let j = 0; j < firstPageCards.length; j++) {
				map.set(j, firstPageCards[j]);
			}
		}

		// Add cards from extra pages
		for (let i = 0; i < extraPageQueries.length; i++) {
			const offset = extraOffsets[i];
			const query = extraPageQueries[i];
			if (query?.data?.cards) {
				for (let j = 0; j < query.data.cards.length; j++) {
					map.set(offset + j, query.data.cards[j]);
				}
			}
		}

		return map;
	}, [firstPageQuery.data?.cards, extraOffsets, extraPageQueries]);

	useEffect(() => {
		searchInputRef.current?.focus();
	}, []);

	const firstPage = firstPageQuery.data;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl w-full mx-auto px-6 pt-8 pb-4">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
						Card Browser
					</h1>
					<MetadataDisplay />
				</div>

				<div className="mb-4">
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Search by name or try t:creature cmc<=3"
								value={search.q}
								onChange={(e) =>
									navigate({
										search: (prev) => ({ ...prev, q: e.target.value }),
										replace: true,
									})
								}
								className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-slate-800 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${
									hasError
										? "border-red-500 focus:border-red-500"
										: "border-gray-300 dark:border-slate-700 focus:border-cyan-500"
								}`}
							/>
						</div>
						<div className="relative">
							<select
								value={sortOption.value}
								onChange={(e) =>
									navigate({
										search: (prev) => ({ ...prev, sort: e.target.value }),
										replace: true,
									})
								}
								className="appearance-none h-full px-4 pr-10 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
							>
								{SORT_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
							<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
						</div>
					</div>

					{hasError && firstPage?.error && (
						<div className="mt-2 flex items-start gap-2 text-sm text-red-500 dark:text-red-400">
							<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
							<span>{firstPage.error.message}</span>
						</div>
					)}

					{firstPage?.description && !hasError && (
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
							<OracleText text={firstPage.description} />
						</p>
					)}

					{search.q && !hasError && (
						<p className="text-sm text-gray-400 mt-2">
							{totalCount > 0 && (
								<>
									Found {totalCount.toLocaleString()} results
									{firstPage?.mode === "syntax" && " (syntax)"}
								</>
							)}
							{totalCount === 0 &&
								firstPage &&
								!firstPageQuery.isFetching &&
								"No results found"}
							{!firstPage && firstPageQuery.isFetching && "Searching..."}
						</p>
					)}

					{!search.q && (
						<p className="text-sm text-gray-400 mt-2">
							Enter a search query to find cards
						</p>
					)}
				</div>
			</div>

			<div ref={listRef} className="px-6 pb-6">
				<div
					className="max-w-7xl mx-auto relative"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{visibleItems.map((virtualRow) => {
						const startIndex = virtualRow.index * columns;
						const itemsInRow = Math.min(columns, totalCount - startIndex);

						return (
							<div
								key={virtualRow.key}
								data-index={virtualRow.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-4"
								style={{
									transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
								}}
							>
								{Array.from({ length: itemsInRow }, (_, i) => {
									const cardIndex = startIndex + i;
									const card = cardMap.get(cardIndex);
									if (card) {
										return (
											<CardThumbnail
												key={card.id}
												card={card}
												href={`/card/${card.id}`}
												onClick={() => saveScrollPosition(cardIndex)}
											/>
										);
									}
									return <CardSkeleton key={`skeleton-${cardIndex}`} />;
								})}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
