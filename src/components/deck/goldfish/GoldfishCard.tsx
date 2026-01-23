import { useDraggable } from "@dnd-kit/core";
import { PLACEHOLDER_STRIPES } from "@/components/CardImage";
import type { CardInstance } from "@/lib/goldfish/types";
import type { Card } from "@/lib/scryfall-types";
import { getImageUri } from "@/lib/scryfall-utils";

interface GoldfishCardProps {
	instance: CardInstance;
	card?: Card;
	onHover?: (instanceId: number | null) => void;
	onClick?: (instanceId: number) => void;
	size?: "tiny" | "small" | "normal";
	positioning?: "relative" | "absolute";
	className?: string;
	style?: React.CSSProperties;
	fromLibrary?: boolean;
}

export function GoldfishCard({
	instance,
	card,
	onHover,
	onClick,
	size = "normal",
	positioning = "relative",
	className = "",
	style,
	fromLibrary = false,
}: GoldfishCardProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: fromLibrary
			? `library-top-${instance.instanceId}`
			: `card-${instance.instanceId}`,
		data: { instance, fromLibrary },
	});

	const isFlipped = instance.faceIndex > 0;
	const imageSize = size === "normal" ? "normal" : "small";
	const imageSrc = instance.isFaceDown
		? null
		: getImageUri(instance.cardId, imageSize, isFlipped ? "back" : "front");

	const counterEntries = Object.entries(instance.counters);
	const sizeClass =
		size === "tiny" ? "h-14" : size === "small" ? "h-24" : "h-40";

	return (
		<button
			type="button"
			ref={setNodeRef}
			className={`${positioning} select-none w-fit ${className} ${isDragging ? "opacity-0" : ""} ${instance.isTapped ? "rotate-90" : ""}`}
			style={style}
			onMouseEnter={() => onHover?.(instance.instanceId)}
			onMouseLeave={() => onHover?.(null)}
			onClick={() => onClick?.(instance.instanceId)}
			{...listeners}
			{...attributes}
		>
			{imageSrc ? (
				<img
					src={imageSrc}
					alt={card?.name ?? "Card"}
					className={`rounded-[4.75%/3.5%] bg-gray-200 dark:bg-zinc-700 ${sizeClass} aspect-[5/7]`}
					style={{ backgroundImage: PLACEHOLDER_STRIPES }}
					draggable={false}
					loading="lazy"
				/>
			) : (
				<div
					className={`rounded-[4.75%/3.5%] bg-amber-700 ${sizeClass} aspect-[5/7]`}
				/>
			)}
			{counterEntries.length > 0 && (
				<div className="absolute bottom-1 left-1 flex flex-wrap gap-1 max-w-full">
					{counterEntries.map(([type, count]) => (
						<span
							key={type}
							className="px-1.5 py-0.5 text-xs font-bold rounded bg-black/70 text-white"
							title={type}
						>
							{type === "+1/+1" ? `+${count}/+${count}` : `${count}`}
						</span>
					))}
				</div>
			)}
		</button>
	);
}
