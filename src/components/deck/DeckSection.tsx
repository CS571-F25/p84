import { useQuery } from "@tanstack/react-query";
import { ManaCost } from "@/components/ManaCost";
import type { DeckCard, Section } from "@/lib/deck-types";
import { getCardWithPrintingsQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DeckSectionProps {
	section: Section;
	cards: DeckCard[];
	onCardHover?: (cardId: ScryfallId | null) => void;
}

interface DeckCardRowProps {
	card: DeckCard;
	onCardHover?: (cardId: ScryfallId | null) => void;
}

function DeckCardRow({ card, onCardHover }: DeckCardRowProps) {
	const { data, isLoading } = useQuery(
		getCardWithPrintingsQueryOptions(card.scryfallId),
	);

	return (
		<div
			className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded px-2 py-1 cursor-pointer transition-colors"
			onMouseEnter={() => onCardHover?.(card.scryfallId)}
			onMouseLeave={() => onCardHover?.(null)}
		>
			<div className="flex items-center gap-2">
				<span className="text-gray-600 dark:text-gray-400 font-mono text-xs w-6 text-right flex-shrink-0">
					{card.quantity}x
				</span>
				<div className="flex-1 flex items-center gap-1.5 min-w-0">
					{isLoading ? (
						<span className="text-gray-500 dark:text-gray-500 font-mono text-xs truncate">
							{card.scryfallId}
						</span>
					) : data ? (
						<>
							<span className="text-gray-900 dark:text-white text-sm truncate">
								{data.card.name}
							</span>
							{data.card.mana_cost && (
								<ManaCost cost={data.card.mana_cost} size="small" />
							)}
						</>
					) : (
						<span className="text-red-600 dark:text-red-400 text-sm">
							Unknown Card
						</span>
					)}
				</div>
				{card.tags && card.tags.length > 0 && (
					<div className="flex gap-1 flex-shrink-0">
						{card.tags.map((tag) => (
							<span
								key={tag}
								className="px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 text-xs rounded"
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export function DeckSection({ section, cards, onCardHover }: DeckSectionProps) {
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
				<div className="space-y-0.5">
					{cards.map((card, index) => (
						<DeckCardRow
							key={`${card.scryfallId}-${index}`}
							card={card}
							onCardHover={onCardHover}
						/>
					))}
				</div>
			)}
		</div>
	);
}
