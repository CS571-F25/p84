import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { CardThumbnail } from "@/components/CardImage";
import {
	getCardsMetadataQueryOptions,
	searchCardsQueryOptions,
} from "@/lib/queries";
import { useDebounce } from "@/lib/useDebounce";

export const Route = createFileRoute("/cards/")({
	ssr: false,
	component: CardsPage,
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
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebounce(searchQuery, 250);
	const { data: searchResults, isFetching } = useQuery(
		searchCardsQueryOptions(debouncedSearchQuery),
	);

	return (
		<div className="min-h-screen bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-white mb-2">Card Browser</h1>
					<MetadataDisplay />
				</div>

				<div className="mb-6">
					<div className="relative">
						<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							type="text"
							placeholder="Search cards..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors"
						/>
					</div>
					{searchQuery && searchResults && searchResults.cards.length > 0 && (
						<p className="text-sm text-gray-400 mt-2">
							Found {searchResults.cards.length} results for "{searchQuery}"
							{isFetching && " • Searching..."}
						</p>
					)}
					{searchQuery && searchResults && searchResults.cards.length === 0 && (
						<p className="text-sm text-gray-400 mt-2">
							No results found for "{searchQuery}"
						</p>
					)}
					{!searchQuery && (
						<p className="text-sm text-gray-400 mt-2">
							Enter a search query to find cards
						</p>
					)}
					{searchQuery && !searchResults && (
						<p className="text-sm text-gray-400 mt-2">Searching...</p>
					)}
				</div>

				<div
					className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 transition-opacity ${isFetching || searchQuery !== debouncedSearchQuery ? "opacity-50" : "opacity-100"}`}
				>
					{searchResults?.cards.map((card) => (
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
