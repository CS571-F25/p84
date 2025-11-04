import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ManaCost } from "@/components/ManaCost";
import { groupCards, sortCards, sortGroupNames } from "@/lib/deck-grouping";
import type { DeckCard, GroupBy, Section, SortBy } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";

// Combine function for useQueries - converts query results into a Map
function combineCardQueries(
	results: Array<{ data?: Card | undefined }>,
): Map<ScryfallId, Card> | undefined {
	const map = new Map<ScryfallId, Card>();
	for (const result of results) {
		if (result.data) {
			map.set(result.data.id, result.data);
		}
	}
	// Only return the map if all cards are loaded
	return results.every((r) => r.data) ? map : undefined;
}

interface DeckSectionProps {
	section: Section;
	cards: DeckCard[];
	groupBy: GroupBy;
	sortBy: SortBy;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

interface DeckCardRowProps {
	card: DeckCard;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

function DeckCardRow({ card, onCardHover, onCardClick }: DeckCardRowProps) {
	const { data: cardData, isLoading } = useQuery(
		getCardByIdQueryOptions(card.scryfallId),
	);

	return (
		<button
			type="button"
			className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded px-2 py-1 cursor-pointer transition-colors w-full text-left"
			onMouseEnter={() => onCardHover?.(card.scryfallId)}
			onMouseLeave={() => onCardHover?.(null)}
			onClick={() => onCardClick?.(card)}
		>
			<div className="flex items-center gap-2">
				<span className="text-gray-600 dark:text-gray-400 font-mono text-xs w-4 text-right flex-shrink-0">
					{card.quantity}
				</span>
				<span className="text-gray-900 dark:text-white text-sm truncate flex-1 min-w-0">
					{cardData ? cardData.name : isLoading ? "" : "Unknown Card"}
				</span>
				<div className="flex-shrink-0 flex items-center ml-auto">
					{cardData?.mana_cost ? (
						<ManaCost cost={cardData.mana_cost} size="small" />
					) : isLoading ? (
						<div className="h-5 w-12 bg-gray-300 dark:bg-slate-700 rounded animate-pulse" />
					) : null}
				</div>
			</div>
		</button>
	);
}

export function DeckSection({
	section,
	cards,
	groupBy,
	sortBy,
	onCardHover,
	onCardClick,
}: DeckSectionProps) {
	const sectionNames: Record<Section, string> = {
		commander: "Commander",
		mainboard: "Mainboard",
		sideboard: "Sideboard",
		maybeboard: "Maybeboard",
	};

	const totalQuantity = cards.reduce((sum, card) => sum + card.quantity, 0);

	// Fetch all card data individually (populates cache for DeckCardRow)
	const cardMap = useQueries({
		queries: cards.map((card) => getCardByIdQueryOptions(card.scryfallId)),
		combine: combineCardQueries,
	});

	// Group and sort cards with memoization
	const groupedCards = useMemo(() => {
		if (!cardMap) return new Map([["all", cards]]);
		const lookup = (card: DeckCard) => cardMap.get(card.scryfallId);
		return groupCards(cards, lookup, groupBy);
	}, [cards, cardMap, groupBy]);

	const sortedGroupNames = useMemo(
		() => sortGroupNames(Array.from(groupedCards.keys()), groupBy),
		[groupedCards, groupBy],
	);

	// Sort cards within each group
	const sortedGroups = useMemo(() => {
		if (!cardMap) return groupedCards;
		const lookup = (card: DeckCard) => cardMap.get(card.scryfallId);
		return new Map(
			sortedGroupNames.map((groupName) => {
				const groupCards = groupedCards.get(groupName) ?? [];
				return [groupName, sortCards(groupCards, lookup, sortBy)];
			}),
		);
	}, [sortedGroupNames, groupedCards, cardMap, sortBy]);

	return (
		<div className="mb-6">
			<div className="flex items-center justify-between mb-2">
				<h2 className="text-xl font-bold text-gray-900 dark:text-white">
					{sectionNames[section]}
				</h2>
				<span className="text-sm text-gray-600 dark:text-gray-400">
					{totalQuantity} {totalQuantity === 1 ? "card" : "cards"}
				</span>
			</div>

			{cards.length === 0 ? (
				<div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-6 border-2 border-dashed border-gray-300 dark:border-slate-700">
					<p className="text-gray-500 dark:text-gray-400 text-center">
						No cards in {sectionNames[section].toLowerCase()}
					</p>
				</div>
			) : groupBy === "none" ? (
				<div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2 gap-y-1">
					{cardMap
						? sortCards(
								cards,
								(card) => cardMap.get(card.scryfallId),
								sortBy,
							).map((card, index) => (
								<DeckCardRow
									key={`${card.scryfallId}-${index}`}
									card={card}
									onCardHover={onCardHover}
									onCardClick={onCardClick}
								/>
							))
						: cards.map((card, index) => (
								<DeckCardRow
									key={`${card.scryfallId}-${index}`}
									card={card}
									onCardHover={onCardHover}
									onCardClick={onCardClick}
								/>
							))}
				</div>
			) : (
				<div className="space-y-4">
					{sortedGroupNames.map((groupName) => {
						const groupCards = sortedGroups.get(groupName) ?? [];
						const groupQuantity = groupCards.reduce(
							(sum, card) => sum + card.quantity,
							0,
						);

						return (
							<div key={groupName} className="space-y-1">
								<div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
									{groupName} ({groupQuantity})
								</div>
								<div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2 gap-y-1">
									{groupCards.map((card, index) => (
										<DeckCardRow
											key={`${card.scryfallId}-${groupName}-${index}`}
											card={card}
											onCardHover={onCardHover}
											onCardClick={onCardClick}
										/>
									))}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
