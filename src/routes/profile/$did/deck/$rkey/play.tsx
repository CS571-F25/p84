import type { Did } from "@atcute/lexicons";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { GoldfishBoard } from "@/components/deck/goldfish";
import { asRkey } from "@/lib/atproto-client";
import { prefetchCards } from "@/lib/card-prefetch";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import { getCardsInSection } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

export const Route = createFileRoute("/profile/$did/deck/$rkey/play")({
	component: PlaytestPage,
	loader: async ({ context, params }) => {
		const { deck } = await context.queryClient.ensureQueryData(
			getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
		);

		const cardIds = deck.cards.map((card) => card.scryfallId);
		await prefetchCards(context.queryClient, cardIds);

		return deck;
	},
	head: ({ loaderData: deck }) => ({
		meta: [
			{
				title: deck
					? `Playtest: ${deck.name} | DeckBelcher`
					: "Playtest | DeckBelcher",
			},
		],
	}),
});

function PlaytestPage() {
	const { did, rkey } = Route.useParams();
	const {
		data: { deck },
	} = useSuspenseQuery(getDeckQueryOptions(did as Did, asRkey(rkey)));

	const playtestCards = [
		...getCardsInSection(deck, "commander"),
		...getCardsInSection(deck, "mainboard"),
	];

	const cardMap = useQueries({
		queries: playtestCards.map((card) =>
			getCardByIdQueryOptions(card.scryfallId),
		),
		combine: combineCardQueries,
	});

	const getCard = useCallback((id: ScryfallId) => cardMap?.get(id), [cardMap]);

	const startingLife = deck.format === "commander" ? 40 : 20;

	if (!cardMap) {
		return (
			<div className="h-screen flex items-center justify-center bg-white dark:bg-slate-950">
				<span className="text-gray-500 dark:text-gray-400">
					Loading cards...
				</span>
			</div>
		);
	}

	return (
		<div className="h-screen flex flex-col bg-white dark:bg-slate-950">
			<header className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-slate-800">
				<Link
					to="/profile/$did/deck/$rkey"
					params={{ did, rkey }}
					className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
				>
					<ArrowLeft className="w-4 h-4" />
					Back to Editor
				</Link>
				<h1 className="text-lg font-semibold text-gray-900 dark:text-white">
					{deck.name}
				</h1>
			</header>
			<div className="flex-1 overflow-hidden">
				<GoldfishBoard
					deck={playtestCards}
					cardLookup={getCard}
					startingLife={startingLife}
				/>
			</div>
		</div>
	);
}
