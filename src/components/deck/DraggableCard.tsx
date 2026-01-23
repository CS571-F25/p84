import { useDraggable } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { ManaCost } from "@/components/ManaCost";
import { getPrimaryFace } from "@/lib/card-faces";
import type { DeckCard } from "@/lib/deck-types";
import type { Violation } from "@/lib/deck-validation";
import { getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";

interface DraggableCardProps {
	card: DeckCard;
	uniqueId: string;
	onCardHover?: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
	disabled?: boolean;
	isDraggingGlobal?: boolean;
	isHighlighted?: boolean;
	violations?: Violation[];
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
	disabled = false,
	isDraggingGlobal = false,
	isHighlighted = false,
	violations,
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
		disabled,
	});

	const highlightRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isHighlighted && highlightRef.current) {
			highlightRef.current.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 2000,
				easing: "ease-out",
			});
		}
	}, [isHighlighted]);

	const primaryFace = cardData ? getPrimaryFace(cardData) : null;

	return (
		<button
			ref={setNodeRef}
			{...attributes}
			{...(disabled ? {} : listeners)}
			type="button"
			className="group relative rounded px-2 py-1 w-full text-left md:touch-none bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
			style={{
				opacity: isDragging ? 0.5 : 1,
				cursor: disabled ? "pointer" : isDragging ? "grabbing" : "grab",
			}}
			onMouseEnter={() => {
				if (!isDraggingGlobal) {
					onCardHover?.(card.scryfallId);
				}
			}}
			onMouseLeave={() => {
				if (!isDraggingGlobal) {
					onCardHover?.(null);
				}
			}}
			onClick={() => {
				if (!isDragging) {
					onCardClick?.(card);
				}
			}}
		>
			<div
				ref={highlightRef}
				className="absolute inset-0 rounded bg-amber-100 dark:bg-zinc-700 opacity-0 pointer-events-none"
			/>
			<div className="flex items-baseline gap-2">
				<span className="text-gray-600 dark:text-zinc-300 font-mono text-xs w-4 text-right flex-shrink-0">
					{card.quantity}
				</span>
				<span className="text-gray-900 dark:text-white text-sm truncate flex-1 min-w-0 motion-safe:transition-[font-variation-settings] motion-safe:duration-200 motion-safe:ease-out [font-variation-settings:'wght'_400] motion-safe:group-hover:[font-variation-settings:'wght'_500]">
					{primaryFace ? primaryFace.name : isLoading ? "" : "Unknown Card"}
				</span>
				{violations && violations.length > 0 && (
					<span title={violations.map((v) => v.message).join("\n")}>
						<AlertTriangle
							className={`w-4 h-4 flex-shrink-0 ${
								violations.some((v) => v.severity === "error")
									? "text-red-500 dark:text-red-400"
									: "text-amber-500 dark:text-amber-400"
							}`}
						/>
					</span>
				)}
				<div className="flex-shrink-0 flex items-center ml-auto self-center">
					{primaryFace?.mana_cost ? (
						<ManaCost cost={primaryFace.mana_cost} size="small" />
					) : isLoading ? (
						<div className="h-5 w-12 bg-gray-300 dark:bg-zinc-700 rounded animate-pulse" />
					) : null}
				</div>
			</div>
		</button>
	);
}
