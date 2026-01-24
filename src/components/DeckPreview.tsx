import type { Did } from "@atcute/lexicons";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CardSpread } from "@/components/CardSpread";
import { ClientDate } from "@/components/ClientDate";
import { HandleLink } from "@/components/HandleLink";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import { getPreviewCardIds } from "@/lib/deck-preview-utils";
import type { Deck } from "@/lib/deck-types";
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
	const sectionString = showCounts
		? formatSectionCounts(getSectionCounts(deck.cards))
		: "";
	const dateString = deck.updatedAt ?? deck.createdAt;

	const hasCommanders = deck.cards.some((c) => c.section === "commander");
	const mainboardCards = useMemo(
		() => deck.cards.filter((c) => c.section === "mainboard"),
		[deck.cards],
	);

	// Load card data for mainboard to filter lands (skip for commander decks)
	const cardQueries = useQueries({
		queries: mainboardCards.map((c) => ({
			...getCardByIdQueryOptions(c.scryfallId as ScryfallId),
			enabled: !hasCommanders,
		})),
	});

	const isLoadingCards = cardQueries.some((q) => q.isLoading);

	// Build a lookup map from card queries
	const cardDataMap = useMemo(() => {
		const map = new Map<
			string,
			{ name?: string; type_line?: string; oracle_text?: string }
		>();
		mainboardCards.forEach((c, i) => {
			const data = cardQueries[i]?.data;
			if (data) map.set(c.scryfallId, data);
		});
		return map;
	}, [mainboardCards, cardQueries]);

	const previewCardIds = useMemo(() => {
		// While loading, show top 3 by quantity as placeholders
		if (isLoadingCards && !hasCommanders) {
			return [...mainboardCards]
				.sort((a, b) => b.quantity - a.quantity)
				.slice(0, 3)
				.map((c) => c.scryfallId);
		}

		return getPreviewCardIds(deck.name, deck.cards, (id) =>
			cardDataMap.get(id),
		);
	}, [
		deck.name,
		deck.cards,
		cardDataMap,
		isLoadingCards,
		hasCommanders,
		mainboardCards,
	]);

	return (
		<Link
			to="/profile/$did/deck/$rkey"
			params={{ did, rkey: asRkey(rkey) }}
			className="group flex items-start gap-4 p-4 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 motion-safe:hover:shadow-lg transition-colors motion-safe:transition-shadow min-w-0"
		>
			<CardSpread cardIds={previewCardIds} />

			<div className="flex-1 min-w-0">
				{showHandle && (
					<p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
						<HandleLink did={did} link={false} />
					</p>
				)}

				<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate font-display">
					{deck.name}
				</h2>
				{deck.format && (
					<p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
						{formatDisplayName(deck.format)}
					</p>
				)}
				{sectionString && (
					<p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
						{sectionString}
					</p>
				)}
				<p className="text-sm text-gray-500 dark:text-zinc-400">
					Updated <ClientDate dateString={dateString} />
				</p>
			</div>
		</Link>
	);
}
