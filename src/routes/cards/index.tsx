import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, ArrowUpDown, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardSkeleton, CardThumbnail } from "@/components/CardImage";
import { ClientDate } from "@/components/ClientDate";
import {
	HighlightedSearchInput,
	type HighlightedSearchInputHandle,
} from "@/components/HighlightedSearchInput";
import { OracleText } from "@/components/OracleText";
import { SearchPrimer } from "@/components/SearchPrimer";
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
			sort2: (search.sort2 as string) || undefined,
		};
	},
	head: () => ({
		meta: [{ title: "Cards | DeckBelcher" }],
	}),
});

function MetadataDisplay() {
	const { data: metadata } = useQuery(getCardsMetadataQueryOptions());

	if (!metadata) {
		return (
			<span className="text-gray-400 text-sm">
				<Loader2 className="inline w-3 h-3 animate-spin" />
			</span>
		);
	}

	return (
		<span className="text-gray-400 text-sm">
			{metadata.cardCount.toLocaleString()} cards • updated{" "}
			<span title={`Version: ${metadata.version}`}>
				<ClientDate dateString={metadata.version} format="relative" />
			</span>{" "}
			from{" "}
			<a
				href="https://scryfall.com"
				target="_blank"
				rel="noopener noreferrer"
				className="text-cyan-600 dark:text-cyan-400 underline"
			>
				Scryfall
			</a>{" "}
			• supports a subset of{" "}
			<a
				href="https://scryfall.com/docs/syntax"
				target="_blank"
				rel="noopener noreferrer"
				className="text-cyan-600 dark:text-cyan-400 underline"
			>
				Scryfall syntax
			</a>
		</span>
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

// Calculate row height from viewport to avoid dynamic measurement (causes scroll stutter on mobile).
// SYNC WARNING: These values must match the grid CSS in the render below:
//   - gap-4 = 16px, pb-4 = 16px, px-6 = 24px each side, max-w-7xl = 1280px
//   - Cards use aspect-[5/7]
function getRowHeight(columns: number) {
	if (typeof window === "undefined") return 300;

	const GAP = 16;
	const ROW_PADDING = 16;
	const CONTAINER_PADDING = 24 * 2;
	const MAX_WIDTH = 1280;

	const viewportWidth = window.innerWidth;
	const containerWidth = Math.min(viewportWidth, MAX_WIDTH) - CONTAINER_PADDING;
	const totalGapWidth = GAP * (columns - 1);
	const cardWidth = (containerWidth - totalGapWidth) / columns;
	const cardHeight = cardWidth * (7 / 5);

	return cardHeight + ROW_PADDING;
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
	{
		value: "color-asc",
		label: "Color (WUBRG)",
		sort: { field: "color", direction: "asc" },
	},
	{
		value: "color-desc",
		label: "Color (GRBUW)",
		sort: { field: "color", direction: "desc" },
	},
];

const DEFAULT_PRIMARY = SORT_OPTIONS[0];

function buildSortArray(
	primary: (typeof SORT_OPTIONS)[number],
	secondary: (typeof SORT_OPTIONS)[number] | null,
): SortOption[] {
	if (!secondary) return [primary.sort];
	return [primary.sort, secondary.sort];
}

function CardsPage() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const {
		value: debouncedSearchQuery,
		isPending: isDebouncing,
		flush: flushDebounce,
	} = useDebounce(search.q || "", 400);
	const searchInputRef = useRef<HighlightedSearchInputHandle>(null);
	const lastSyncedQuery = useRef<string>(search.q || "");

	// Sync URL → input only for external changes (back button, link clicks)
	useEffect(() => {
		const urlQuery = search.q || "";
		// Skip if we already synced this value (from typing or previous sync)
		if (lastSyncedQuery.current === urlQuery) {
			return;
		}
		// External change - sync input and skip debounce
		if (searchInputRef.current) {
			searchInputRef.current.setValue(urlQuery);
		}
		lastSyncedQuery.current = urlQuery;
		flushDebounce();
	}, [search.q, flushDebounce]);
	const listRef = useRef<HTMLDivElement>(null);
	const columns = useColumns();
	const hasRestoredScroll = useRef(false);
	const primarySort =
		SORT_OPTIONS.find((o) => o.value === search.sort) ?? DEFAULT_PRIMARY;
	const secondarySort = search.sort2
		? (SORT_OPTIONS.find((o) => o.value === search.sort2) ?? null)
		: null;
	const sortArray = buildSortArray(primarySort, secondarySort);

	// First page query to get totalCount and metadata
	const firstPageQuery = useQuery(
		searchPageQueryOptions(debouncedSearchQuery, 0, undefined, sortArray),
	);
	const totalCount = firstPageQuery.data?.totalCount ?? 0;
	const hasError = firstPageQuery.data?.error != null;

	const rowCount = Math.ceil(totalCount / columns);

	// Use calculated row height to minimize measurement corrections (causes scroll stutter on mobile)
	const rowHeight = getRowHeight(columns);

	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		estimateSize: () => rowHeight,
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
				sortArray,
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
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<div className="max-w-7xl w-full mx-auto px-6 pt-8 pb-4">
				<div className="mb-4 flex flex-col gap-2">
					<div className="flex items-center justify-between gap-2">
						<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
							Card Browser
						</h1>
						<div className="flex gap-2">
							<div className="relative">
								<select
									aria-label="Sort by"
									value={primarySort.value}
									onChange={(e) =>
										navigate({
											search: (prev) => ({ ...prev, sort: e.target.value }),
											replace: true,
										})
									}
									className="appearance-none h-9 w-9 sm:w-auto pl-2 sm:pl-3 pr-2 sm:pr-8 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-transparent sm:text-gray-900 dark:sm:text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
								>
									{SORT_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
								<ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none sm:hidden" />
								<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none hidden sm:block" />
							</div>
							<div className="relative">
								<select
									aria-label="Then sort by"
									value={secondarySort?.value ?? ""}
									onChange={(e) =>
										navigate({
											search: (prev) => ({
												...prev,
												sort2: e.target.value || undefined,
											}),
											replace: true,
										})
									}
									className="appearance-none h-9 w-9 sm:w-auto pl-2 sm:pl-3 pr-2 sm:pr-8 py-1.5 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-transparent sm:text-gray-900 dark:sm:text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
								>
									<option value="">then...</option>
									{SORT_OPTIONS.filter(
										(opt) => opt.sort.field !== primarySort.sort.field,
									).map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
								<ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none sm:hidden" />
								<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none hidden sm:block" />
							</div>
						</div>
					</div>

					<HighlightedSearchInput
						ref={searchInputRef}
						placeholder="Search by name or try t:creature cmc<=3"
						defaultValue={search.q}
						errors={
							isDebouncing ? [] : firstPage?.error ? [firstPage.error] : []
						}
						onChange={(value) => {
							lastSyncedQuery.current = value;
							navigate({
								search: (prev) => ({ ...prev, q: value }),
								replace: true,
							});
						}}
					/>

					{hasError && firstPage?.error && (
						<div className="mt-2 flex items-start gap-2 text-sm text-red-500 dark:text-red-400">
							<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
							<span>{firstPage.error.message}</span>
						</div>
					)}

					{search.q && !hasError && (
						<div className="text-sm mt-2 space-y-1">
							{firstPage?.description && (
								<p
									className={`text-gray-500 dark:text-zinc-300 ${isDebouncing ? "opacity-50" : ""}`}
								>
									<OracleText text={firstPage.description} />
								</p>
							)}
							<p className="text-gray-400">
								{isDebouncing
									? "On your mark..."
									: totalCount > 0
										? `Found ${totalCount.toLocaleString()} results${firstPage?.mode === "syntax" ? " (syntax)" : ""}`
										: firstPage && !firstPageQuery.isFetching
											? "No results found"
											: firstPageQuery.isFetching
												? "Searching..."
												: null}
							</p>
						</div>
					)}

					{!search.q && (
						<div className="mt-4">
							<p className="text-sm text-gray-400 mb-4">
								<MetadataDisplay />
							</p>
							<SearchPrimer />
						</div>
					)}
				</div>
			</div>

			<div ref={listRef} className="px-6 pb-6">
				<div
					className={`max-w-7xl mx-auto relative transition-opacity ${isDebouncing ? "opacity-50" : ""}`}
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
