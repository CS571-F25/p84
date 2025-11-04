import { useDraggable } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { ManaCost } from "@/components/ManaCost";
import type { DeckCard } from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DraggableCardProps {
	card: DeckCard;
	uniqueId: string; // Unique ID for this card instance
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

export interface DragData {
	scryfallId: ScryfallId;
	section: string;
	tags: string[];
}

export function DraggableCard({
	card,
	uniqueId,
	onCardHover,
	onCardClick,
}: DraggableCardProps) {
	const { data: cardData, isLoading } = useQuery(
		getCardByIdQueryOptions(card.scryfallId),
	);

	const dragData: DragData = {
		scryfallId: card.scryfallId,
		section: card.section,
		tags: card.tags ?? [],
	};

	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: uniqueId,
		data: dragData,
	});

	return (
		<button
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			type="button"
			className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded px-2 py-1 transition-colors w-full text-left touch-none"
			style={{
				opacity: isDragging ? 0.5 : 1,
				cursor: isDragging ? "grabbing" : "grab",
			}}
			onMouseEnter={() => onCardHover?.(card.scryfallId)}
			onMouseLeave={() => onCardHover?.(null)}
			onClick={() => {
				// Only trigger click if not dragging
				if (!isDragging) {
					onCardClick?.(card);
				}
			}}
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
