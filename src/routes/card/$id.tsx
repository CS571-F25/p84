import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { ManaCost } from "@/components/ManaCost";
import { OracleText } from "@/components/OracleText";
import {
	getCardByIdQueryOptions,
	getCardPrintingsQueryOptions,
} from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { isScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/card/$id")({
	loader: async ({ context, params }) => {
		// Validate ID format
		if (!isScryfallId(params.id)) {
			return null;
		}

		// Prefetch card data during SSR
		const cardData = await context.queryClient.ensureQueryData(
			getCardByIdQueryOptions(params.id),
		);

		// Also prefetch printings if card was found
		if (cardData) {
			const printingIds = await context.queryClient.ensureQueryData(
				getCardPrintingsQueryOptions(cardData.oracle_id),
			);

			// Prefetch all printing cards
			await Promise.all(
				printingIds.map((printingId) =>
					context.queryClient.ensureQueryData(
						getCardByIdQueryOptions(printingId),
					),
				),
			);
		}
	},
	component: CardDetailPage,
});

function combinePrintingQueries(
	results: Array<{ data?: Card | undefined }>,
): Map<ScryfallId, Card> | undefined {
	const map = new Map<ScryfallId, Card>();
	for (const result of results) {
		if (result.data) {
			map.set(result.data.id, result.data);
		}
	}
	return results.every((r) => r.data) ? map : undefined;
}

function CardDetailPage() {
	const { id } = Route.useParams();
	const [hoveredPrintingId, setHoveredPrintingId] = useState<ScryfallId | null>(
		null,
	);
	const currentPrintingRef = useRef<HTMLAnchorElement>(null);

	const isValidId = isScryfallId(id);
	const { data: card, isLoading: cardLoading } = useQuery(
		getCardByIdQueryOptions(isValidId ? id : ("" as ScryfallId)),
	);

	const { data: printingIds } = useQuery({
		...getCardPrintingsQueryOptions(card?.oracle_id ?? ("" as any)),
		enabled: !!card,
	});

	const printingsMap = useQueries({
		queries: (printingIds ?? []).map((printingId) =>
			getCardByIdQueryOptions(printingId),
		),
		combine: combinePrintingQueries,
	});

	useEffect(() => {
		if (currentPrintingRef.current) {
			currentPrintingRef.current.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, []);

	if (!isValidId) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-red-600 dark:text-red-400 text-lg">
					Invalid card ID format
				</p>
			</div>
		);
	}

	if (cardLoading) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900">
				<div className="max-w-7xl mx-auto px-6 py-8">
					<div className="flex items-center justify-center py-20">
						<p className="text-gray-600 dark:text-gray-400 text-lg">
							Loading card...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (!card) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-red-600 dark:text-red-400 text-lg">Card not found</p>
			</div>
		);
	}

	const displayCard = hoveredPrintingId
		? (printingsMap?.get(hoveredPrintingId) ?? card)
		: card;

	const allPrintings = (printingIds ?? [])
		.map((pid) => printingsMap?.get(pid))
		.filter((c): c is Card => c !== undefined);

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
					<div className="sticky top-0 z-10 bg-white dark:bg-slate-900 py-4 -mx-6 px-6 lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent lg:dark:bg-transparent lg:top-8 flex justify-center lg:justify-end">
						<CardImage
							card={displayCard}
							size="large"
							className="shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] max-w-full h-auto max-h-[50vh] lg:max-h-[80vh] object-contain"
						/>
					</div>

					<div className="space-y-6 min-w-0">
						<div>
							<div className="flex items-baseline gap-3 mb-2 flex-wrap">
								<h1 className="text-4xl font-bold text-gray-900 dark:text-white">
									{card.name}
								</h1>
								{card.mana_cost && (
									<div className="flex-shrink-0">
										<ManaCost cost={card.mana_cost} size="large" />
									</div>
								)}
							</div>
							{card.type_line && (
								<p className="text-lg text-gray-600 dark:text-gray-400">
									{card.type_line}
								</p>
							)}
						</div>

						{card.oracle_text && (
							<div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4 border border-gray-300 dark:border-slate-700">
								<p className="text-gray-900 dark:text-gray-200">
									<OracleText text={card.oracle_text} />
								</p>
							</div>
						)}

						{(card.power || card.toughness || card.loyalty) && (
							<div className="flex gap-4 text-gray-700 dark:text-gray-300">
								{card.power && card.toughness && (
									<div>
										<span className="text-gray-600 dark:text-gray-400">
											P/T:
										</span>{" "}
										<span className="font-semibold">
											{card.power}/{card.toughness}
										</span>
									</div>
								)}
								{card.loyalty && (
									<div>
										<span className="text-gray-600 dark:text-gray-400">
											Loyalty:
										</span>{" "}
										<span className="font-semibold">{card.loyalty}</span>
									</div>
								)}
							</div>
						)}

						<div
							className="grid gap-x-8 gap-y-4 text-sm"
							style={{
								gridTemplateColumns: "minmax(50%, auto) minmax(0, 1fr)",
							}}
						>
							{displayCard.set_name && (
								<>
									<div className="min-w-0">
										<p className="text-gray-600 dark:text-gray-400">Set</p>
										<p
											className="text-gray-900 dark:text-white truncate"
											title={`${displayCard.set_name} (${displayCard.set?.toUpperCase()})`}
										>
											{displayCard.set_name} ({displayCard.set?.toUpperCase()})
										</p>
									</div>
									{displayCard.rarity && (
										<div className="min-w-0">
											<p className="text-gray-600 dark:text-gray-400">Rarity</p>
											<p className="text-gray-900 dark:text-white capitalize truncate">
												{displayCard.rarity}
											</p>
										</div>
									)}
								</>
							)}
							{displayCard.artist && (
								<>
									<div className="min-w-0">
										<p className="text-gray-600 dark:text-gray-400">Artist</p>
										<p
											className="text-gray-900 dark:text-white truncate"
											title={displayCard.artist}
										>
											{displayCard.artist}
										</p>
									</div>
									{displayCard.collector_number && (
										<div className="min-w-0">
											<p className="text-gray-600 dark:text-gray-400">
												Collector Number
											</p>
											<p className="text-gray-900 dark:text-white truncate">
												{displayCard.collector_number}
											</p>
										</div>
									)}
								</>
							)}
						</div>

						{allPrintings.length > 0 && (
							<div>
								<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
									Printings ({allPrintings.length})
								</h2>
								<div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800/50">
									<div className="flex flex-wrap gap-2">
										{allPrintings.map((printing) => (
											<Link
												key={printing.id}
												to="/card/$id"
												params={{ id: printing.id }}
												ref={
													printing.id === id ? currentPrintingRef : undefined
												}
												onMouseEnter={() => setHoveredPrintingId(printing.id)}
												onMouseLeave={() => setHoveredPrintingId(null)}
												className={`px-3 py-1.5 text-sm rounded transition-colors whitespace-nowrap ${
													printing.id === id
														? "bg-cyan-500 text-white font-medium"
														: "bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600"
												}`}
											>
												{printing.set_name}
												{printing.collector_number && (
													<span className="ml-1.5 opacity-70">
														#{printing.collector_number}
													</span>
												)}
											</Link>
										))}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
