import { useDraggable } from "@dnd-kit/core";
import type { CardInstance } from "@/lib/goldfish/types";

interface GoldfishLibraryCardProps {
	topCard: CardInstance;
	onDraw: () => void;
}

export function GoldfishLibraryCard({
	topCard,
	onDraw,
}: GoldfishLibraryCardProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `library-top-${topCard.instanceId}`,
		data: {
			instance: { ...topCard, isFaceDown: true },
			fromLibrary: true,
		},
	});

	return (
		<button
			type="button"
			ref={setNodeRef}
			onClick={onDraw}
			className={`w-full aspect-[5/7] rounded-[4.75%/3.5%] bg-amber-700 shadow-md cursor-grab active:cursor-grabbing ${isDragging ? "opacity-0" : ""}`}
			{...listeners}
			{...attributes}
		/>
	);
}
