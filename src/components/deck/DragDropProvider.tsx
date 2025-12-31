import {
	DndContext,
	type DragCancelEvent,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useId, useState } from "react";

interface DragDropProviderProps {
	children: ReactNode;
	onDragEnd: (event: DragEndEvent) => void;
	onDragCancel?: (event: DragCancelEvent) => void;
}

export function DragDropProvider({
	children,
	onDragEnd,
	onDragCancel,
}: DragDropProviderProps) {
	const dndContextId = useId();

	// WARN: Screen size is checked once on mount and never updated.
	// dnd-kit's useSensors doesn't support dynamic sensor changes.
	// This will break on foldable phones that change size mid-session.
	// Fix requires either dnd-kit fix or remounting DndContext on resize.
	const [isLargeScreen] = useState(() => {
		if (typeof window === "undefined") return true;
		return window.matchMedia("(min-width: 768px)").matches;
	});

	const pointerSensor = useSensor(PointerSensor, {
		activationConstraint: {
			distance: 8,
		},
	});

	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: {
			delay: 250,
			tolerance: 5,
		},
	});

	const keyboardSensor = useSensor(KeyboardSensor);

	// Only include touch sensor on larger screens (tablets, laptops)
	// On small screens (<768px), touch scrolls instead of dragging
	const sensors = useSensors(
		pointerSensor,
		...(isLargeScreen ? [touchSensor] : []),
		keyboardSensor,
	);

	return (
		<DndContext
			id={dndContextId}
			sensors={sensors}
			onDragEnd={onDragEnd}
			onDragCancel={onDragCancel}
		>
			{children}
		</DndContext>
	);
}
