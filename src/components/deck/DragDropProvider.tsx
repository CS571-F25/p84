import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

interface DragDropProviderProps {
	children: ReactNode;
	onDragEnd: (event: DragEndEvent) => void;
}

export function DragDropProvider({
	children,
	onDragEnd,
}: DragDropProviderProps) {
	// Configure sensors for different input methods
	const pointerSensor = useSensor(PointerSensor, {
		activationConstraint: {
			distance: 8, // Require 8px movement to start drag (prevents accidental drags)
		},
	});

	const touchSensor = useSensor(TouchSensor, {
		activationConstraint: {
			delay: 250, // 250ms delay before drag starts on touch
			tolerance: 5, // 5px tolerance for distinguishing scroll vs drag
		},
	});

	const keyboardSensor = useSensor(KeyboardSensor);

	const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

	return (
		<DndContext sensors={sensors} onDragEnd={onDragEnd}>
			{children}
		</DndContext>
	);
}
