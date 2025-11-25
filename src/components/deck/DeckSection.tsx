import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { groupCards, sortCards, sortGroupNames } from "@/lib/deck-grouping";
import type { DeckCard, GroupBy, Section, SortBy } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { DraggableCard } from "./DraggableCard";
import { DroppableSection } from "./DroppableSection";
import { DroppableSectionHeader } from "./DroppableSectionHeader";
import { DroppableTagGroup } from "./DroppableTagGroup";

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
	isDragging: boolean;
	readOnly?: boolean;
}

export function DeckSection({
	section,
	cards,
	groupBy,
	sortBy,
	onCardHover,
	onCardClick,
	isDragging,
	readOnly = false,
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
		if (!cardMap) return new Map([["all", { cards, forTag: false }]]);
		const lookup = (card: DeckCard) => cardMap.get(card.scryfallId);
		return groupCards(cards, lookup, groupBy);
	}, [cards, cardMap, groupBy]);

	const sortedGroupNames = useMemo(
		() => sortGroupNames(groupedCards, groupBy),
		[groupedCards, groupBy],
	);

	// Sort cards within each group
	const sortedGroups = useMemo(() => {
		if (!cardMap)
			return new Map(
				Array.from(groupedCards.entries(), ([k, v]) => [k, v.cards]),
			);
		const lookup = (card: DeckCard) => cardMap.get(card.scryfallId);
		return new Map(
			sortedGroupNames.map((groupName) => {
				const groupCards = groupedCards.get(groupName) ?? {
					cards: [],
					forTag: false,
				};
				return [groupName, sortCards(groupCards.cards, lookup, sortBy)];
			}),
		);
	}, [sortedGroupNames, groupedCards, cardMap, sortBy]);

	return (
		<div className="mb-8 pb-8 border-b border-gray-200 dark:border-slate-800 last:border-b-0 last:pb-0">
			<DroppableSection section={section} isDragging={isDragging}>
				<DroppableSectionHeader>
					<h2 className="text-xl font-bold text-gray-900 dark:text-white">
						{sectionNames[section]}
					</h2>
					<span className="text-sm text-gray-600 dark:text-gray-400">
						{totalQuantity} {totalQuantity === 1 ? "card" : "cards"}
					</span>
				</DroppableSectionHeader>
				{cards.length === 0 ? (
					<div className="bg-gray-100 dark:bg-slate-800 rounded-lg p-6 border-2 border-dashed border-gray-300 dark:border-slate-700">
						<p className="text-gray-500 dark:text-gray-400 text-center">
							No cards in {sectionNames[section].toLowerCase()}
						</p>
					</div>
				) : groupBy === "none" ? (
					<div
						className="gap-x-6 gap-y-1"
						style={{
							columnWidth: "16rem",
							columnGap: "1.5rem",
						}}
					>
						{cardMap
							? sortCards(
									cards,
									(card) => cardMap.get(card.scryfallId),
									sortBy,
								).map((card, index) => {
									const uniqueId = `${card.scryfallId}-${section}-none-${index}`;
									return (
										<div key={uniqueId} className="mb-1">
											<DraggableCard
												card={card}
												uniqueId={uniqueId}
												onCardHover={onCardHover}
												onCardClick={onCardClick}
												disabled={readOnly}
												isDraggingGlobal={isDragging}
											/>
										</div>
									);
								})
							: cards.map((card, index) => {
									const uniqueId = `${card.scryfallId}-${section}-none-${index}`;
									return (
										<div key={uniqueId} className="mb-1">
											<DraggableCard
												card={card}
												uniqueId={uniqueId}
												onCardHover={onCardHover}
												onCardClick={onCardClick}
												disabled={readOnly}
												isDraggingGlobal={isDragging}
											/>
										</div>
									);
								})}
					</div>
				) : (
					<div
						className="gap-x-6"
						style={{
							columnWidth: "16rem",
							columnGap: "1.5rem",
						}}
					>
						{sortedGroupNames.map((groupName) => {
							const groupCards = sortedGroups.get(groupName) ?? [];
							const groupQuantity = groupCards.reduce(
								(sum, card) => sum + card.quantity,
								0,
							);

							return (
								<DroppableTagGroup
									key={groupName}
									tagName={groupName}
									section={section}
									enabled={groupedCards.get(groupName)?.forTag ?? false}
									isDragging={isDragging}
								>
									<div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
										{groupName} ({groupQuantity})
									</div>
									<div className="space-y-1">
										{groupCards.map((card, index) => {
											const uniqueId = `${card.scryfallId}-${section}-${groupName}-${index}`;
											return (
												<DraggableCard
													key={uniqueId}
													uniqueId={uniqueId}
													card={card}
													onCardHover={onCardHover}
													onCardClick={onCardClick}
													disabled={readOnly}
													isDraggingGlobal={isDragging}
												/>
											);
										})}
									</div>
								</DroppableTagGroup>
							);
						})}
					</div>
				)}
			</DroppableSection>
		</div>
	);
}
