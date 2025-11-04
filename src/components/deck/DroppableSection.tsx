import { useDndContext, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { Section } from "@/lib/deck-types";
import type { DragData } from "./DraggableCard";

interface DroppableSectionProps {
	section: Section;
	children: ReactNode;
	isDragging: boolean;
}

const sectionNames: Record<Section, string> = {
	commander: "Commander",
	mainboard: "Mainboard",
	sideboard: "Sideboard",
	maybeboard: "Maybeboard",
};

export function DroppableSection({
	section,
	children,
	isDragging,
}: DroppableSectionProps) {
	const { active } = useDndContext();
	const dragData = active?.data.current as DragData | undefined;

	// Disable if dragging from this same section (noop)
	const isNoop = dragData?.section === section;

	const { setNodeRef, isOver } = useDroppable({
		id: `section-area-${section}`,
		data: { type: "section", section },
		disabled: isNoop,
	});

	return (
		<div ref={setNodeRef} className="relative">
			{/* Drop zone visual - only visible when dragging and not a noop */}
			{isDragging && !isNoop && (
				<div
					className={`absolute inset-0 rounded-lg pointer-events-none ${
						isOver
							? "ring-4 ring-blue-500 dark:ring-blue-500"
							: "ring-2 ring-blue-300 dark:ring-blue-600"
					}`}
				>
					{isOver && (
						<>
							{/* Dim background */}
							<div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-600/30 rounded-lg z-10" />
							{/* Label */}
							<div className="absolute inset-0 flex items-center justify-center z-20">
								<div className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-lg">
									Drop to move to {sectionNames[section]}
								</div>
							</div>
						</>
					)}
				</div>
			)}
			{children}
		</div>
	);
}
