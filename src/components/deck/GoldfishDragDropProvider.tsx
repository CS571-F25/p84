import {
	DndContext,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useId, useRef, useState } from "react";
import {
	CARD_ASPECT_RATIO,
	CARD_BORDER_RADIUS,
	PLACEHOLDER_STRIPES,
} from "@/components/CardImage";
import type { CardInstance } from "@/lib/goldfish/types";
import { getImageUri } from "@/lib/scryfall-utils";

export interface DragPosition {
	translated: { left: number; top: number } | null;
}

interface GoldfishDragDropProviderProps {
	children: ReactNode;
	onDragStart?: (event: DragStartEvent) => void;
	onDragOver?: (event: DragOverEvent) => void;
	onDragEnd: (event: DragEndEvent, lastPosition: DragPosition | null) => void;
}

export function GoldfishDragDropProvider({
	children,
	onDragStart,
	onDragOver,
	onDragEnd,
}: GoldfishDragDropProviderProps) {
	const dndContextId = useId();
	const [activeCard, setActiveCard] = useState<CardInstance | null>(null);
	// Track position during drag since rect.current.translated is null in onDragEnd
	// See: https://github.com/clauderic/dnd-kit/discussions/236
	const lastPositionRef = useRef<DragPosition | null>(null);

	const pointerSensor = useSensor(PointerSensor, {
		activationConstraint: {
			distance: 8,
		},
	});

	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: {
			delay: 200,
			tolerance: 5,
		},
	});

	const keyboardSensor = useSensor(KeyboardSensor);

	const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

	const handleDragStart = (event: DragStartEvent) => {
		const data = event.active.data.current as
			| { instance: CardInstance }
			| undefined;
		if (data?.instance) {
			setActiveCard(data.instance);
		}
		lastPositionRef.current = null;
		onDragStart?.(event);
	};

	const handleDragMove = (event: DragMoveEvent) => {
		const rect = event.active.rect.current.translated;
		if (rect) {
			lastPositionRef.current = {
				translated: { left: rect.left, top: rect.top },
			};
		}
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const lastPosition = lastPositionRef.current;
		setActiveCard(null);
		lastPositionRef.current = null;
		onDragEnd(event, lastPosition);
	};

	return (
		<DndContext
			id={dndContextId}
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragMove={handleDragMove}
			onDragOver={onDragOver}
			onDragEnd={handleDragEnd}
		>
			{children}
			<DragOverlay dropAnimation={null}>
				{activeCard && <DragPreview instance={activeCard} />}
			</DragOverlay>
		</DndContext>
	);
}

function DragPreview({ instance }: { instance: CardInstance }) {
	const isFlipped = instance.faceIndex > 0;
	const imageSrc = instance.isFaceDown
		? null
		: getImageUri(instance.cardId, "normal", isFlipped ? "back" : "front");

	const counterEntries = Object.entries(instance.counters);

	return (
		<div
			className={`relative pointer-events-none ${instance.isTapped ? "rotate-90" : ""}`}
		>
			{imageSrc ? (
				<img
					src={imageSrc}
					alt="Dragging card"
					className={`h-40 aspect-[${CARD_ASPECT_RATIO}] rounded-[${CARD_BORDER_RADIUS}] bg-gray-200 dark:bg-zinc-700 shadow-2xl`}
					style={{ backgroundImage: PLACEHOLDER_STRIPES }}
					draggable={false}
				/>
			) : (
				<div
					className={`h-40 aspect-[${CARD_ASPECT_RATIO}] rounded-[${CARD_BORDER_RADIUS}] bg-amber-700 shadow-2xl`}
				/>
			)}
			{counterEntries.length > 0 && (
				<div className="absolute bottom-1 left-1 flex flex-wrap gap-1 max-w-full">
					{counterEntries.map(([type, count]) => (
						<span
							key={type}
							className="px-1.5 py-0.5 text-xs font-bold rounded bg-black/70 text-white"
						>
							{type === "+1/+1" ? `+${count}/+${count}` : `${count}`}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
