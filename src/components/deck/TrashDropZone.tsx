import { useDroppable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";

interface TrashDropZoneProps {
	isDragging: boolean;
}

export function TrashDropZone({ isDragging }: TrashDropZoneProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: "trash",
		data: { type: "trash" },
	});

	if (!isDragging) return null;

	return (
		<div
			ref={setNodeRef}
			className={`fixed right-0 top-0 bottom-0 w-20 z-20 flex items-center justify-center transition-colors ${
				isOver
					? "bg-red-500 dark:bg-red-900/80"
					: "bg-red-100 dark:bg-red-950/30"
			}`}
		>
			<Trash2
				className={`transition-all ${
					isOver
						? "w-10 h-10 text-white scale-110 animate-bounce"
						: "w-8 h-8 text-red-600 dark:text-red-300"
				}`}
			/>
		</div>
	);
}
