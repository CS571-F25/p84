import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import type { Deck } from "@/lib/deck-types";
import { useCommonTags } from "@/lib/useCommonTags";
import type { DragData } from "./DraggableCard";

interface CommonTagsOverlayProps {
	deck: Deck;
	isDragging: boolean;
}

const TAG_BUTTON_HEIGHT = 56; // px - large, touch-friendly size

export function CommonTagsOverlay({
	deck,
	isDragging,
}: CommonTagsOverlayProps) {
	const [maxTags, setMaxTags] = useState(5); // Default value for SSR

	// Calculate how many tags can fit based on viewport height
	useEffect(() => {
		const updateMaxTags = () => {
			setMaxTags(calculateMaxTags(window.innerHeight));
		};

		// Set initial value after mount
		updateMaxTags();

		window.addEventListener("resize", updateMaxTags);
		return () => window.removeEventListener("resize", updateMaxTags);
	}, []);

	const commonTags = useCommonTags(deck, maxTags);

	if (!isDragging || commonTags.length === 0) {
		return null;
	}

	return (
		<div className="fixed left-6 top-24 w-56 z-20 pointer-events-none">
			<div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 pointer-events-auto">
				<div className="text-xs font-semibold text-white uppercase tracking-wide mb-2">
					Quick Tags
				</div>
				<div className="flex flex-col gap-2">
					{commonTags.map((tag) => (
						<DroppableTagButton key={tag.tagName} tag={tag} />
					))}
				</div>
			</div>
		</div>
	);
}

function calculateMaxTags(screenHeight: number): number {
	const availableHeight = screenHeight * 0.6;
	return Math.max(
		1,
		Math.min(10, Math.floor(availableHeight / TAG_BUTTON_HEIGHT)),
	);
}

interface DroppableTagButtonProps {
	tag: { tagName: string; count: number };
}

function DroppableTagButton({ tag }: DroppableTagButtonProps) {
	const { active } = useDndContext();
	const dragData = active?.data.current as DragData | undefined;

	// Disable if card already has this tag (noop)
	const isNoop = dragData?.tags.includes(tag.tagName);

	const { setNodeRef, isOver } = useDroppable({
		id: `common-tag-${tag.tagName}`,
		data: { type: "tag", tagName: tag.tagName },
		disabled: isNoop,
	});

	return (
		<button
			ref={setNodeRef}
			type="button"
			className={`relative px-3 py-2 rounded text-sm font-medium text-left ${
				isNoop ? "opacity-40" : ""
			}`}
			style={{
				touchAction: "none",
			}}
		>
			{/* Ring indicator - only show for active targets */}
			{!isNoop && (
				<div
					className={`absolute inset-0 rounded pointer-events-none ${
						isOver
							? "ring-4 ring-cyan-500 dark:ring-cyan-500"
							: "ring-2 ring-cyan-300 dark:ring-cyan-600"
					}`}
				/>
			)}

			{/* Background */}
			<div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 rounded" />

			{/* Content */}
			<div className="relative flex items-center justify-between gap-2">
				<span className="truncate text-gray-900 dark:text-white">
					{tag.tagName}
				</span>
				<span className="text-xs opacity-70 flex-shrink-0 text-gray-600 dark:text-gray-400">
					{tag.count}
				</span>
			</div>

			{/* Hover dim + label - only for active targets */}
			{!isNoop && isOver && (
				<>
					<div className="absolute inset-0 bg-cyan-500/20 dark:bg-cyan-600/30 rounded pointer-events-none z-10" />
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
						<div className="text-cyan-900 dark:text-cyan-200 text-xs font-bold">
							Drop to add
						</div>
					</div>
				</>
			)}
		</button>
	);
}
