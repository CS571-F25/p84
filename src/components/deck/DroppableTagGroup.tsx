import { useDndContext, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { DragData } from "./DraggableCard";

interface DroppableTagGroupProps {
	tagName: string;
	section: string; // Add section to make ID unique
	enabled: boolean;
	children: ReactNode;
	isDragging: boolean;
}

export function DroppableTagGroup({
	tagName,
	section,
	enabled,
	children,
	isDragging,
}: DroppableTagGroupProps) {
	const { active } = useDndContext();
	const dragData = active?.data.current as DragData | undefined;

	// Disable if card already has this tag (noop)
	const isNoop = dragData?.tags.includes(tagName);

	const { setNodeRef, isOver } = useDroppable({
		id: `tag-${section}-${tagName}`,
		data: { type: "tag", tagName },
		disabled: !enabled || isNoop,
	});

	const showDropZone = enabled && isDragging && !isNoop;

	return (
		<div
			ref={setNodeRef}
			className="mb-4 break-inside-avoid rounded-lg relative"
			style={{ breakInside: "avoid" }}
		>
			{/* Drop zone visual */}
			{showDropZone && (
				<div
					className={`absolute inset-0 rounded-lg pointer-events-none ${
						isOver
							? "ring-4 ring-cyan-500 dark:ring-cyan-500"
							: "ring-2 ring-cyan-300 dark:ring-cyan-600"
					}`}
				>
					{isOver && (
						<>
							{/* Dim background */}
							<div className="absolute inset-0 bg-cyan-500/20 dark:bg-cyan-600/30 rounded-lg z-10" />
							{/* Label */}
							<div className="absolute inset-0 flex items-center justify-center z-20">
								<div className="bg-cyan-500 dark:bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-lg">
									Drop to add "{tagName}"
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
