import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CardThumbnail } from "@/components/CardImage";
import {
	getCardsMetadataQueryOptions,
	unifiedSearchQueryOptions,
} from "@/lib/queries";
import { useDebounce } from "@/lib/useDebounce";

export const Route = createFileRoute("/cards/")({
	ssr: false,
	component: CardsPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			q: (search.q as string) || "",
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
			{metadata.cardCount.toLocaleString()} cards • Version: {metadata.version}
		</p>
	);
}

function CardsPage() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const [searchQuery, setSearchQuery] = useState(search.q || "");
	const debouncedSearchQuery = useDebounce(searchQuery, 250);
	const { data: searchResult, isFetching } = useQuery(
		unifiedSearchQueryOptions(debouncedSearchQuery),
	);

	// Sync state with URL when navigating back/forward
	useEffect(() => {
		setSearchQuery(search.q || "");
	}, [search.q]);

	// Update URL immediately on search query change
	useEffect(() => {
		if (searchQuery !== search.q) {
			navigate({
				search: { q: searchQuery },
				replace: true,
			});
		}
	}, [searchQuery, search.q, navigate]);

	const cards = searchResult?.cards ?? [];
	const hasError = searchResult?.error != null;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
						Card Browser
					</h1>
					<MetadataDisplay />
				</div>

				<div className="mb-6">
					<div className="relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							type="text"
							placeholder="Search by name or try t:creature cmc<=3"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-slate-800 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors ${
								hasError
									? "border-red-500 focus:border-red-500"
									: "border-gray-300 dark:border-slate-700 focus:border-cyan-500"
							}`}
						/>
					</div>

					{/* Error message */}
					{hasError && searchResult?.error && (
						<div className="mt-2 flex items-start gap-2 text-sm text-red-500 dark:text-red-400">
							<AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
							<span>{searchResult.error.message}</span>
						</div>
					)}

					{/* Query description for syntax mode */}
					{searchResult?.description && !hasError && (
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
							{searchResult.description}
						</p>
					)}

					{/* Result count */}
					{searchQuery && !hasError && (
						<p className="text-sm text-gray-400 mt-2">
							{cards.length > 0 && (
								<>
									Found {cards.length} results
									{searchResult?.mode === "syntax" && " (syntax)"}
									{isFetching && " • Searching..."}
								</>
							)}
							{cards.length === 0 &&
								searchResult &&
								!isFetching &&
								"No results found"}
							{!searchResult && "Searching..."}
						</p>
					)}

					{!searchQuery && (
						<p className="text-sm text-gray-400 mt-2">
							Enter a search query to find cards
						</p>
					)}
				</div>

				<div
					className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 transition-opacity ${
						isFetching || searchQuery !== debouncedSearchQuery
							? "opacity-50"
							: "opacity-100"
					}`}
				>
					{cards.map((card) => (
						<CardThumbnail
							key={card.id}
							card={card}
							href={`/card/${card.id}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
