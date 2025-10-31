import type { Section, DeckCard } from "@/lib/deck-types";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DeckSectionProps {
	section: Section;
	cards: DeckCard[];
	onCardHover?: (cardId: ScryfallId | null) => void;
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
		<div className="mb-8">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
					{sectionNames[section]}
				</h2>
				<span className="text-lg text-gray-600 dark:text-gray-400">
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
				<div className="space-y-1">
					{cards.map((card, index) => (
						<div
							key={`${card.scryfallId}-${index}`}
							className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded px-4 py-2 cursor-pointer transition-colors"
							onMouseEnter={() => onCardHover?.(card.scryfallId)}
							onMouseLeave={() => onCardHover?.(null)}
						>
							<div className="flex items-center gap-4">
								<span className="text-gray-600 dark:text-gray-400 font-mono w-8 text-right">
									{card.quantity}x
								</span>
								<span className="text-gray-900 dark:text-white flex-1">
									{card.scryfallId}
								</span>
								{card.tags && card.tags.length > 0 && (
									<div className="flex gap-2">
										{card.tags.map((tag) => (
											<span
												key={tag}
												className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 text-xs rounded"
											>
												{tag}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
