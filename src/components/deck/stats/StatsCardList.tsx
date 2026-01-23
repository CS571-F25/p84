import { useQueries } from "@tanstack/react-query";
import { ManaCost } from "@/components/ManaCost";
import { getCastableFaces } from "@/lib/card-faces";
import type { FacedCard } from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface StatsCardListProps {
	title: string;
	cards: FacedCard[];
	onCardHover: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

export function StatsCardList({
	title,
	cards,
	onCardHover,
	onCardClick,
}: StatsCardListProps) {
	// Deduplicate cards (same card+face may appear multiple times for quantity)
	// Use card id + face index as unique key
	const uniqueCards = cards.reduce<FacedCard[]>((acc, facedCard) => {
		const key = `${facedCard.card.scryfallId}-${facedCard.faceIdx}`;
		if (!acc.some((c) => `${c.card.scryfallId}-${c.faceIdx}` === key)) {
			acc.push(facedCard);
		}
		return acc;
	}, []);

	// Fetch card data for display
	const cardMap = useQueries({
		queries: uniqueCards.map((fc) =>
			getCardByIdQueryOptions(fc.card.scryfallId),
		),
		combine: combineCardQueries,
	});

	return (
		<div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4 min-w-48">
			<h4 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
				{title}
			</h4>
			{uniqueCards.length === 0 ? (
				<p className="text-sm text-gray-500 dark:text-zinc-300 italic">
					No cards
				</p>
			) : (
				<ul className="space-y-1">
					{uniqueCards.map((facedCard) => {
						const { card: deckCard, faceIdx } = facedCard;
						const card = cardMap?.get(deckCard.scryfallId);

						// Get the specific face that matched
						const faces = card ? getCastableFaces(card) : [];
						const face = faces[faceIdx] ?? faces[0];
						const faceName = face?.name ?? card?.name ?? "Loading...";
						const faceManaCost = face?.mana_cost ?? card?.mana_cost;

						return (
							<li key={`${deckCard.scryfallId}-${faceIdx}`}>
								<button
									type="button"
									className="w-full text-left px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
									onMouseEnter={() => onCardHover(deckCard.scryfallId)}
									onMouseLeave={() => onCardHover(null)}
									onClick={() => onCardClick?.(deckCard)}
								>
									<span className="text-gray-600 dark:text-zinc-300 font-mono text-xs w-4 text-right flex-shrink-0">
										{deckCard.quantity}
									</span>
									<span className="text-gray-900 dark:text-white text-sm truncate flex-1 min-w-0">
										{faceName}
									</span>
									<div className="flex-shrink-0 flex items-center ml-auto">
										{faceManaCost && (
											<ManaCost cost={faceManaCost} size="small" />
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
