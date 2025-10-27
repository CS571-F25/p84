import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Card, CardDataOutput } from "../../lib/scryfall-types";
import { isScryfallId } from "../../lib/scryfall-types";
import { getImageUri } from "../../lib/scryfall-utils";

export const Route = createFileRoute("/cards/$id")({
	component: CardDetailPage,
});

function CardDetailPage() {
	const { id } = Route.useParams();

	const {
		data: cardsData,
		isLoading,
		error,
	} = useQuery<CardDataOutput>({
		queryKey: ["cards"],
		queryFn: async () => {
			const response = await fetch("/data/cards.json");
			if (!response.ok) {
				throw new Error("Failed to load card data");
			}
			return response.json();
		},
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (isLoading) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-white text-lg">Loading card...</p>
			</div>
		);
	}

	if (error || !cardsData) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Failed to load card data</p>
			</div>
		);
	}

	if (!isScryfallId(id)) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Invalid card ID format</p>
			</div>
		);
	}

	const card: Card | undefined = cardsData.cards[id];

	if (!card) {
		return (
			<div className="min-h-screen bg-slate-900 flex items-center justify-center">
				<p className="text-red-400 text-lg">Card not found</p>
			</div>
		);
	}

	const otherPrintings = cardsData.oracleIdToPrintings[card.oracle_id]?.filter(
		(printId) => printId !== id,
	);

	return (
		<div className="min-h-screen bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<a
					href="/cards"
					className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6 transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					Back to card browser
				</a>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div className="flex justify-center lg:justify-end">
						<img
							src={getImageUri(card.id, "large")}
							alt={card.name}
							className="rounded-xl shadow-2xl max-w-full h-auto"
						/>
					</div>

					<div className="space-y-6">
						<div>
							<h1 className="text-4xl font-bold text-white mb-2">
								{card.name}
							</h1>
							{card.mana_cost && (
								<p className="text-xl text-gray-300 font-mono">
									{card.mana_cost}
								</p>
							)}
							{card.type_line && (
								<p className="text-lg text-gray-400 mt-2">{card.type_line}</p>
							)}
						</div>

						{card.oracle_text && (
							<div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
								<p className="text-gray-200 whitespace-pre-line">
									{card.oracle_text}
								</p>
							</div>
						)}

						{(card.power || card.toughness || card.loyalty) && (
							<div className="flex gap-4 text-gray-300">
								{card.power && card.toughness && (
									<div>
										<span className="text-gray-400">P/T:</span>{" "}
										<span className="font-semibold">
											{card.power}/{card.toughness}
										</span>
									</div>
								)}
								{card.loyalty && (
									<div>
										<span className="text-gray-400">Loyalty:</span>{" "}
										<span className="font-semibold">{card.loyalty}</span>
									</div>
								)}
							</div>
						)}

						<div className="grid grid-cols-2 gap-4 text-sm">
							{card.set_name && (
								<div>
									<p className="text-gray-400">Set</p>
									<p className="text-white">
										{card.set_name} ({card.set?.toUpperCase()})
									</p>
								</div>
							)}
							{card.rarity && (
								<div>
									<p className="text-gray-400">Rarity</p>
									<p className="text-white capitalize">{card.rarity}</p>
								</div>
							)}
							{card.artist && (
								<div>
									<p className="text-gray-400">Artist</p>
									<p className="text-white">{card.artist}</p>
								</div>
							)}
							{card.collector_number && (
								<div>
									<p className="text-gray-400">Collector Number</p>
									<p className="text-white">{card.collector_number}</p>
								</div>
							)}
						</div>

						{otherPrintings && otherPrintings.length > 0 && (
							<div>
								<h2 className="text-xl font-semibold text-white mb-3">
									Other Printings ({otherPrintings.length})
								</h2>
								<div className="grid grid-cols-4 md:grid-cols-6 gap-2">
									{otherPrintings.slice(0, 12).map((printId) => {
										const printing = cardsData.cards[printId];
										return (
											<a
												key={printId}
												href={`/cards/${printId}`}
												className="aspect-[5/7] rounded overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all"
												title={printing.set_name}
											>
												<img
													src={getImageUri(printId, "small")}
													alt={printing.name}
													className="w-full h-full object-cover"
													loading="lazy"
												/>
											</a>
										);
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
