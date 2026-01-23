import { useDroppable } from "@dnd-kit/core";
import { forwardRef } from "react";
import type { CardInstance } from "@/lib/goldfish/types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { GoldfishCard } from "./GoldfishCard";

interface GoldfishBattlefieldProps {
	cards: CardInstance[];
	cardLookup?: (id: ScryfallId) => Card | undefined;
	onHover?: (instanceId: number | null) => void;
	onClick?: (instanceId: number) => void;
}

export const GoldfishBattlefield = forwardRef<
	HTMLDivElement,
	GoldfishBattlefieldProps
>(function GoldfishBattlefield({ cards, cardLookup, onHover, onClick }, ref) {
	const { setNodeRef, isOver } = useDroppable({
		id: "zone-battlefield",
		data: { zone: "battlefield" },
	});

	return (
		<div ref={ref} className="flex-1 min-h-[300px]">
			<div
				ref={setNodeRef}
				className={`isolate relative w-full h-full rounded-lg border-2 border-dashed transition-colors ${
					isOver
						? "border-green-500 bg-green-500/10"
						: "border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50"
				}`}
			>
				{cards.length === 0 && (
					<div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-zinc-400 text-sm pointer-events-none">
						Battlefield
					</div>
				)}
				{cards.map((instance) => (
					<GoldfishCard
						key={instance.instanceId}
						instance={instance}
						card={cardLookup?.(instance.cardId)}
						onHover={onHover}
						onClick={onClick}
						positioning="absolute"
						style={{
							left: instance.position?.x ?? 100,
							top: instance.position?.y ?? 100,
							zIndex: instance.zIndex,
						}}
					/>
				))}
			</div>
		</div>
	);
});
