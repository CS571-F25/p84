import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { CardThumbnail } from "../../components/CardImage";
import type { CardDataOutput } from "../../lib/scryfall-types";

export const Route = createFileRoute("/cards/")({
	component: CardsPage,
});

function CardsPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const { data } = useQuery<CardDataOutput>({
		queryKey: ["cards"],
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (!data) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Failed to load card data</p>
			</div>
		);
	}

	const cards = Object.values(data.cards);
	const filteredCards = searchQuery
		? cards
				.filter((card) =>
					card.name.toLowerCase().includes(searchQuery.toLowerCase()),
				)
				.slice(0, 100)
		: cards.slice(0, 100);

	return (
		<div className="min-h-screen bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-white mb-2">Card Browser</h1>
					<p className="text-gray-400">
						{data.cardCount.toLocaleString()} cards • Version: {data.version}
					</p>
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
					{searchQuery && (
						<p className="text-sm text-gray-400 mt-2">
							Showing first 100 results for "{searchQuery}"
						</p>
					)}
					{!searchQuery && (
						<p className="text-sm text-gray-400 mt-2">
							Showing first 100 cards (use search to find specific cards)
						</p>
					)}
				</div>

				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
					{filteredCards.map((card) => (
						<CardThumbnail
							key={card.id}
							card={card}
							href={`/cards/${card.id}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
