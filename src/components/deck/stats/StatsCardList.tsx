import { useQueries } from "@tanstack/react-query";
import { ManaCost } from "@/components/ManaCost";
import type { DeckCard } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface StatsCardListProps {
	title: string;
	cards: DeckCard[];
	onCardHover: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

export function StatsCardList({
	title,
	cards,
	onCardHover,
	onCardClick,
}: StatsCardListProps) {
	// Deduplicate cards (same card may appear multiple times for quantity)
	const uniqueCards = cards.reduce<DeckCard[]>((acc, card) => {
		if (!acc.some((c) => c.scryfallId === card.scryfallId)) {
			acc.push(card);
		}
		return acc;
	}, []);

	// Fetch card data for display
	const cardMap = useQueries({
		queries: uniqueCards.map((card) =>
			getCardByIdQueryOptions(card.scryfallId),
		),
		combine: combineCardQueries,
	});

	return (
		<div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 min-w-48 max-h-80 overflow-y-auto">
			<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				{title}
			</h4>
			{uniqueCards.length === 0 ? (
				<p className="text-sm text-gray-500 dark:text-gray-400 italic">
					No cards
				</p>
			) : (
				<ul className="space-y-1">
					{uniqueCards.map((deckCard) => {
						const card = cardMap?.get(deckCard.scryfallId);
						return (
							<li key={deckCard.scryfallId}>
								<button
									type="button"
									className="w-full text-left px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
									onMouseEnter={() => onCardHover(deckCard.scryfallId)}
									onMouseLeave={() => onCardHover(null)}
									onClick={() => onCardClick?.(deckCard)}
								>
									<span className="text-gray-600 dark:text-gray-400 font-mono text-xs w-4 text-right flex-shrink-0">
										{deckCard.quantity}
									</span>
									<span className="text-gray-900 dark:text-white text-sm truncate flex-1 min-w-0">
										{card?.name ?? "Loading..."}
									</span>
									<div className="flex-shrink-0 flex items-center ml-auto">
										{card?.mana_cost && (
											<ManaCost cost={card.mana_cost} size="small" />
										)}
									</div>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
