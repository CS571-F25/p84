import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { ManaCost } from "@/components/ManaCost";
import { OracleText } from "@/components/OracleText";
import { getAllFaces } from "@/lib/card-faces";
import {
	getCardByIdQueryOptions,
	getCardPrintingsQueryOptions,
	getVolatileDataQueryOptions,
} from "@/lib/queries";
import type { Card, CardFace, ScryfallId } from "@/lib/scryfall-types";
import { asOracleId, isScryfallId } from "@/lib/scryfall-types";
import { getImageUri } from "@/lib/scryfall-utils";

const NOT_FOUND_META = {
	meta: [
		{
			title: "Card Not Found | DeckBelcher",
		},
	],
};

export const Route = createFileRoute("/card/$id")({
	loader: async ({ context, params }) => {
		// Validate ID format
		if (!isScryfallId(params.id)) {
			return null;
		}

		// Prefetch card and volatile data in parallel
		// Printing IDs and printing cards are loaded client-side to avoid memory bloat
		// (some cards like Lightning Bolt have 100+ printings)
		const [card] = await Promise.all([
			context.queryClient.ensureQueryData(getCardByIdQueryOptions(params.id)),
			context.queryClient.ensureQueryData(
				getVolatileDataQueryOptions(params.id),
			),
		]);
		return card ?? null;
	},
	head: ({ loaderData }) => {
		const card = loaderData;
		if (!card) return NOT_FOUND_META;

		// Large card image (672x936, readable in Discord/Twitter previews)
		const cardImageUrl = getImageUri(card.id, "large");

		// Build description from card details
		let description = card.type_line ?? "";
		if (card.mana_cost) {
			description = description
				? `${description} • ${card.mana_cost}`
				: card.mana_cost;
		}
		if (card.oracle_text) {
			description = description
				? `${description} • ${card.oracle_text}`
				: card.oracle_text;
		}

		return {
			meta: [
				{
					title: `${card.name} | DeckBelcher`,
				},
				{
					name: "description",
					content: description,
				},
				// Open Graph tags
				{
					property: "og:title",
					content: card.name,
				},
				{
					property: "og:description",
					content: description,
				},
				{
					property: "og:image",
					content: cardImageUrl,
				},
				{
					property: "og:image:width",
					content: "672",
				},
				{
					property: "og:image:height",
					content: "936",
				},
				{
					property: "og:type",
					content: "website",
				},
				// Twitter Card tags
				{
					name: "twitter:card",
					content: "summary_large_image",
				},
				{
					name: "twitter:title",
					content: card.name,
				},
				{
					name: "twitter:description",
					content: description,
				},
				{
					name: "twitter:image",
					content: cardImageUrl,
				},
			],
		};
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

	const { data: printingIds, isLoading: printingIdsLoading } = useQuery({
		...getCardPrintingsQueryOptions(card?.oracle_id ?? asOracleId("")),
		enabled: !!card,
	});

	const printingsMap = useQueries({
		queries: (printingIds ?? []).map((printingId) =>
			getCardByIdQueryOptions(printingId),
		),
		combine: combinePrintingQueries,
	});

	// Use hovered printing's ID for volatile data, fall back to current card
	const displayedId = hoveredPrintingId ?? (isValidId ? id : null);
	const { data: volatileData, isLoading: volatileLoading } = useQuery({
		...getVolatileDataQueryOptions(displayedId ?? ("" as ScryfallId)),
		enabled: !!displayedId,
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

	// Sort printings by release date (newest first) for display
	// oracleIdToPrintings is canonical order, but users expect chronological when browsing
	const allPrintings = (printingIds ?? [])
		.map((pid) => printingsMap?.get(pid))
		.filter((c): c is Card => c !== undefined)
		.sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""));

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
						{getAllFaces(card).map((face, idx) => (
							<div key={face.name}>
								{idx > 0 && (
									<div className="border-t border-gray-300 dark:border-slate-600 mb-4" />
								)}
								<FaceInfo face={face} primary={idx === 0} />
							</div>
						))}

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

						<div className="h-10 overflow-x-auto overflow-y-hidden">
							{volatileLoading ? (
								<div className="flex gap-3 items-center">
									<span className="px-2.5 py-1 w-16 bg-gray-200 dark:bg-slate-700 rounded text-sm animate-pulse">
										&nbsp;
									</span>
									<span className="px-2.5 py-1 w-20 bg-gray-200 dark:bg-slate-700 rounded text-sm animate-pulse">
										&nbsp;
									</span>
									<span className="px-2.5 py-1 w-24 bg-gray-200 dark:bg-slate-700 rounded text-sm animate-pulse">
										&nbsp;
									</span>
								</div>
							) : volatileData &&
								(volatileData.usd ||
									volatileData.usdFoil ||
									volatileData.eur ||
									volatileData.tix ||
									volatileData.edhrecRank) ? (
								<div className="flex gap-3 items-center">
									{volatileData.edhrecRank && (
										<span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded text-sm whitespace-nowrap">
											#{volatileData.edhrecRank.toLocaleString()} EDHREC
										</span>
									)}
									{volatileData.usd && (
										<span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm whitespace-nowrap">
											${volatileData.usd.toFixed(2)}
										</span>
									)}
									{volatileData.usdFoil && (
										<span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-sm whitespace-nowrap">
											${volatileData.usdFoil.toFixed(2)}{" "}
											<span className="opacity-70">foil</span>
										</span>
									)}
									{volatileData.usdEtched && (
										<span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-sm whitespace-nowrap">
											${volatileData.usdEtched.toFixed(2)}{" "}
											<span className="opacity-70">etched</span>
										</span>
									)}
									{volatileData.eur && (
										<span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm whitespace-nowrap">
											€{volatileData.eur.toFixed(2)}
										</span>
									)}
									{volatileData.eurFoil && (
										<span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-sm whitespace-nowrap">
											€{volatileData.eurFoil.toFixed(2)}{" "}
											<span className="opacity-70">foil</span>
										</span>
									)}
									{volatileData.tix && (
										<span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-sm whitespace-nowrap">
											{volatileData.tix.toFixed(2)} tix
										</span>
									)}
								</div>
							) : null}
						</div>

						{printingIdsLoading ? (
							<div>
								<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
									Printings
								</h2>
								<div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800/50">
									<div className="flex flex-wrap gap-2">
										{Array.from({ length: 8 }).map((_, i) => (
											<div
												// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
												key={i}
												className="h-8 w-32 bg-gray-300 dark:bg-slate-700 rounded animate-pulse"
											/>
										))}
									</div>
								</div>
							</div>
						) : allPrintings.length > 0 ? (
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
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

interface FaceInfoProps {
	face: CardFace;
	primary?: boolean;
}

function FaceInfo({ face, primary = false }: FaceInfoProps) {
	const hasStats = face.power || face.toughness || face.loyalty || face.defense;

	return (
		<div className="space-y-3">
			<div>
				<div className="flex items-baseline gap-3 mb-2 flex-wrap">
					{primary ? (
						<h1 className="text-4xl font-bold text-gray-900 dark:text-white">
							{face.name}
						</h1>
					) : (
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							{face.name}
						</h2>
					)}
					{face.mana_cost && (
						<ManaCost
							cost={face.mana_cost}
							size={primary ? "large" : "medium"}
						/>
					)}
				</div>
				{face.type_line && (
					<p
						className={`text-gray-600 dark:text-gray-400 ${primary ? "text-lg" : ""}`}
					>
						{face.type_line}
					</p>
				)}
			</div>

			{face.oracle_text && (
				<div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-4 border border-gray-300 dark:border-slate-700">
					<OracleText text={face.oracle_text} />
				</div>
			)}

			{hasStats && (
				<div className="flex gap-4 text-gray-700 dark:text-gray-300">
					{face.power && face.toughness && (
						<span>
							<span className="text-gray-600 dark:text-gray-400">P/T:</span>{" "}
							<span className="font-semibold">
								{face.power}/{face.toughness}
							</span>
						</span>
					)}
					{face.loyalty && (
						<span>
							<span className="text-gray-600 dark:text-gray-400">Loyalty:</span>{" "}
							<span className="font-semibold">{face.loyalty}</span>
						</span>
					)}
					{face.defense && (
						<span>
							<span className="text-gray-600 dark:text-gray-400">Defense:</span>{" "}
							<span className="font-semibold">{face.defense}</span>
						</span>
					)}
				</div>
			)}
		</div>
	);
}
