import type { Did } from "@atcute/lexicons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CardSpread } from "@/components/CardSpread";
import { ClientDate } from "@/components/ClientDate";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import {
	getDeckNameWords,
	isNonCreatureLand,
	textMatchesDeckTitle,
} from "@/lib/deck-preview-utils";
import type { Deck } from "@/lib/deck-types";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

export interface DeckPreviewProps {
	did: Did;
	rkey: Rkey | string;
	deck: Deck;
	/** Whether to show handle row (fetches DID document, with skeleton while loading) */
	showHandle?: boolean;
	/** Whether to show section counts like "100 main · 15 side" (default: true) */
	showCounts?: boolean;
}

function getSectionCounts(cards: { quantity: number; section: string }[]) {
	const counts: Record<string, number> = {};
	for (const card of cards) {
		counts[card.section] = (counts[card.section] ?? 0) + card.quantity;
	}
	return counts;
}

function formatSectionCounts(counts: Record<string, number>): string {
	const parts: string[] = [];

	if (counts.commander) {
		parts.push(`${counts.commander} cmdr`);
	}
	if (counts.mainboard) {
		parts.push(`${counts.mainboard} main`);
	}
	if (counts.sideboard) {
		parts.push(`${counts.sideboard} side`);
	}
	if (counts.maybeboard) {
		parts.push(`${counts.maybeboard} maybe`);
	}

	for (const [section, count] of Object.entries(counts)) {
		if (
			!["commander", "mainboard", "sideboard", "maybeboard"].includes(section)
		) {
			parts.push(`${count} ${section}`);
		}
	}

	return parts.join(" · ");
}

export function DeckPreview({
	did,
	rkey,
	deck,
	showHandle = false,
	showCounts = true,
}: DeckPreviewProps) {
	const { data: didDocument } = useQuery({
		...didDocumentQueryOptions(did),
		enabled: showHandle,
	});
	const handle = showHandle ? extractHandle(didDocument ?? null) : null;

	const sectionString = showCounts
		? formatSectionCounts(getSectionCounts(deck.cards))
		: "";
	const dateString = deck.updatedAt ?? deck.createdAt;

	const commanders = useMemo(
		() => deck.cards.filter((c) => c.section === "commander"),
		[deck.cards],
	);
	const mainboardCards = useMemo(
		() => deck.cards.filter((c) => c.section === "mainboard"),
		[deck.cards],
	);
	const hasCommanders = commanders.length > 0;

	// Load card data for mainboard to filter lands (skip for commander decks)
	const cardQueries = useQueries({
		queries: mainboardCards.map((c) => ({
			...getCardByIdQueryOptions(c.scryfallId as ScryfallId),
			enabled: !hasCommanders,
		})),
	});

	const deckWords = useMemo(() => getDeckNameWords(deck.name), [deck.name]);

	const isLoadingCards = cardQueries.some((q) => q.isLoading);

	const previewCardIds = useMemo(() => {
		if (hasCommanders) {
			return commanders.slice(0, 3).map((c) => c.scryfallId);
		}

		// While loading, show top 3 by quantity as placeholders
		if (isLoadingCards) {
			return mainboardCards
				.sort((a, b) => b.quantity - a.quantity)
				.slice(0, 3)
				.map((c) => c.scryfallId);
		}

		// Filter lands, sort by quantity (tiebreak by name matching deck title), take top 3
		const withData = mainboardCards
			.map((deckCard, i) => ({
				deckCard,
				card: cardQueries[i]?.data,
			}))
			.filter(({ card }) => card && !isNonCreatureLand(card.type_line));

		return withData
			.sort((a, b) => {
				const qtyDiff = b.deckCard.quantity - a.deckCard.quantity;
				if (qtyDiff !== 0) return qtyDiff;
				// Tiebreak 1: prefer cards whose name matches deck title
				const aNameMatch = textMatchesDeckTitle(a.card?.name, deckWords);
				const bNameMatch = textMatchesDeckTitle(b.card?.name, deckWords);
				if (aNameMatch && !bNameMatch) return 1;
				if (bNameMatch && !aNameMatch) return -1;
				// Tiebreak 2: prefer cards whose type line matches deck title
				const aTypeMatch = textMatchesDeckTitle(a.card?.type_line, deckWords);
				const bTypeMatch = textMatchesDeckTitle(b.card?.type_line, deckWords);
				if (aTypeMatch && !bTypeMatch) return 1;
				if (bTypeMatch && !aTypeMatch) return -1;
				// Tiebreak 3: prefer cards whose oracle text matches deck title
				const aTextMatch = textMatchesDeckTitle(a.card?.oracle_text, deckWords);
				const bTextMatch = textMatchesDeckTitle(b.card?.oracle_text, deckWords);
				if (aTextMatch && !bTextMatch) return 1;
				if (bTextMatch && !aTextMatch) return -1;
				return 0;
			})
			.slice(0, 3)
			.map(({ deckCard }) => deckCard.scryfallId);
	}, [
		hasCommanders,
		commanders,
		mainboardCards,
		cardQueries,
		deckWords,
		isLoadingCards,
	]);

	return (
		<Link
			to="/profile/$did/deck/$rkey"
			params={{ did, rkey: asRkey(rkey) }}
			className="group flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 motion-safe:hover:shadow-lg transition-colors motion-safe:transition-shadow"
		>
			<CardSpread cardIds={previewCardIds} />

			<div className="flex-1 min-w-0">
				{showHandle &&
					(handle ? (
						<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
							@{handle}
						</p>
					) : (
						<div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
					))}

				<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate font-display">
					{deck.name}
				</h2>
				{deck.format && (
					<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
						{formatDisplayName(deck.format)}
					</p>
				)}
				{sectionString && (
					<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
						{sectionString}
					</p>
				)}
				<p className="text-sm text-gray-500 dark:text-gray-500">
					Updated <ClientDate dateString={dateString} />
				</p>
			</div>
		</Link>
	);
}
