import { DragOverlay } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface CardDragOverlayProps {
	draggedCardId: ScryfallId | null;
}

export function CardDragOverlay({ draggedCardId }: CardDragOverlayProps) {
	const { data: cardData } = useQuery({
		...getCardByIdQueryOptions(draggedCardId ?? ("" as ScryfallId)),
		enabled: !!draggedCardId,
	});

	return (
		<DragOverlay>
			{draggedCardId && cardData ? (
				<div className="bg-gray-100 dark:bg-slate-800 rounded px-2 py-1 shadow-lg opacity-90 cursor-grabbing">
					<div className="flex items-center gap-2">
						<span className="text-gray-900 dark:text-white text-sm font-medium">
							{cardData.name}
						</span>
					</div>
				</div>
			) : null}
		</DragOverlay>
	);
}
