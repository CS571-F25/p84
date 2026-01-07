import { useDroppable } from "@dnd-kit/core";
import type { CardInstance } from "@/lib/goldfish/types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { GoldfishCard } from "./GoldfishCard";

interface GoldfishHandProps {
	cards: CardInstance[];
	cardLookup?: (id: ScryfallId) => Card | undefined;
	onHover?: (instanceId: number | null) => void;
	onClick?: (instanceId: number) => void;
}

export function GoldfishHand({
	cards,
	cardLookup,
	onHover,
	onClick,
}: GoldfishHandProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: "zone-hand",
		data: { zone: "hand" },
	});

	return (
		<div
			ref={setNodeRef}
			className={`flex gap-2 overflow-x-auto p-2 min-h-[11rem] rounded-lg border-2 border-dashed transition-colors ${
				isOver
					? "border-blue-500 bg-blue-500/10"
					: "border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50"
			}`}
		>
			{cards.length === 0 ? (
				<div className="flex items-center justify-center w-full text-gray-400 dark:text-gray-500 text-sm">
					Hand is empty
				</div>
			) : (
				cards.map((instance) => (
					<GoldfishCard
						key={instance.instanceId}
						instance={instance}
						card={cardLookup?.(instance.cardId)}
						onHover={onHover}
						onClick={onClick}
						className="flex-shrink-0"
					/>
				))
			)}
		</div>
	);
}
