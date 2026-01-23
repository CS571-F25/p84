import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { CardInstance, Zone } from "@/lib/goldfish/types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { GoldfishCard } from "./GoldfishCard";

interface GoldfishPileProps {
	zone: Zone;
	label: string;
	cards: CardInstance[];
	cardLookup?: (id: ScryfallId) => Card | undefined;
	onHover?: (instanceId: number | null) => void;
	onClick?: (instanceId: number) => void;
}

export function GoldfishPile({
	zone,
	label,
	cards,
	cardLookup,
	onHover,
	onClick,
}: GoldfishPileProps) {
	const [expanded, setExpanded] = useState(false);

	const { setNodeRef, isOver } = useDroppable({
		id: `zone-${zone}`,
		data: { zone },
	});

	return (
		<div
			ref={setNodeRef}
			className={`rounded-lg border-2 border-dashed transition-colors ${
				isOver
					? "border-purple-500 bg-purple-500/10"
					: "border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50"
			}`}
		>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="w-full flex items-center justify-between p-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-t-lg"
			>
				<span>
					{label} ({cards.length})
				</span>
				{expanded ? (
					<ChevronUp className="w-4 h-4" />
				) : (
					<ChevronDown className="w-4 h-4" />
				)}
			</button>
			{expanded && cards.length > 0 && (
				<div className="p-2 pt-0 grid grid-cols-3 gap-1 max-h-36 overflow-y-auto">
					{cards.map((instance) => (
						<GoldfishCard
							key={instance.instanceId}
							instance={instance}
							card={cardLookup?.(instance.cardId)}
							onHover={onHover}
							onClick={onClick}
							size="tiny"
						/>
					))}
				</div>
			)}
			{!expanded && cards.length > 0 && (
				<div className="p-2 pt-0">
					<div className="relative h-14 w-10">
						{cards.slice(-3).map((instance, i) => (
							<GoldfishCard
								key={instance.instanceId}
								instance={instance}
								card={cardLookup?.(instance.cardId)}
								onHover={onHover}
								onClick={onClick}
								size="tiny"
								positioning="absolute"
								style={{
									top: i * 2,
									left: i * 2,
									zIndex: i,
								}}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
