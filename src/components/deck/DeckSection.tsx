import { useQuery } from "@tanstack/react-query";
import { ManaCost } from "@/components/ManaCost";
import type { DeckCard, Section } from "@/lib/deck-types";
import { getCardWithPrintingsQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DeckSectionProps {
	section: Section;
	cards: DeckCard[];
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

interface DeckCardRowProps {
	card: DeckCard;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

function DeckCardRow({ card, onCardHover, onCardClick }: DeckCardRowProps) {
	const { data, isLoading } = useQuery(
		getCardWithPrintingsQueryOptions(card.scryfallId),
	);

	return (
		<div
			className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded px-2 py-1 cursor-pointer transition-colors"
			onMouseEnter={() => onCardHover?.(card.scryfallId)}
			onMouseLeave={() => onCardHover?.(null)}
			onClick={() => onCardClick?.(card)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onCardClick?.(card);
				}
			}}
			role="button"
			tabIndex={0}
		>
			<div className="flex items-center gap-2">
				<span className="text-gray-600 dark:text-gray-400 font-mono text-xs w-4 text-right flex-shrink-0">
					{card.quantity}
				</span>
				<span className="text-gray-900 dark:text-white text-sm truncate flex-1 min-w-0">
					{data ? data.card.name : isLoading ? "" : "Unknown Card"}
				</span>
				<div className="flex-shrink-0 flex items-center ml-auto">
					{data?.card.mana_cost ? (
						<ManaCost cost={data.card.mana_cost} size="small" />
					) : isLoading ? (
						<div className="h-5 w-12 bg-gray-300 dark:bg-slate-700 rounded animate-pulse" />
					) : null}
				</div>
			</div>
		</div>
	);
}

export function DeckSection({
	section,
	cards,
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
			) : (
				<div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-0.5">
					{cards.map((card, index) => (
						<DeckCardRow
							key={`${card.scryfallId}-${index}`}
							card={card}
							onCardHover={onCardHover}
							onCardClick={onCardClick}
						/>
					))}
				</div>
			)}
		</div>
	);
}
