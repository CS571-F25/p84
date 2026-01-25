/**
 * Reusable card image components for different use cases
 */

import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { canFlip, getFlipBehavior, hasBackImage } from "../lib/card-faces";
import type {
	Card,
	ImageSize,
	Layout,
	ScryfallId,
} from "../lib/scryfall-types";
import { type CardFaceType, getImageUri } from "../lib/scryfall-utils";

export const PLACEHOLDER_STRIPES = `repeating-linear-gradient(
	-45deg,
	transparent,
	transparent 8px,
	rgba(0,0,0,0.05) 8px,
	rgba(0,0,0,0.05) 16px
)`;

/** Scryfall card image aspect ratio (672×936 pixels) */
export const CARD_ASPECT_RATIO = "672/936";

/** Card border radius matching physical card corners */
export const CARD_BORDER_RADIUS = "4.75% / 3.5%";

/**
 * Inline styles for card dimensions.
 * Using inline styles instead of Tailwind arbitrary values like `aspect-[${VAR}]`
 * because Tailwind's JIT compiler can't see dynamic template literals at build time.
 */
export const CARD_STYLES = {
	aspectRatio: CARD_ASPECT_RATIO,
	borderRadius: CARD_BORDER_RADIUS,
} as const;

interface CardImageProps {
	card: Pick<Card, "name" | "id"> & { layout?: Layout };
	size?: ImageSize;
	face?: CardFaceType;
	/** Classes for the outer wrapper (sizing, layout). For non-flippable cards, applied to img. */
	outerClassName?: string;
	/** Classes for the img element (shadows, object-fit, etc.) */
	imgClassName?: string;
	isFlipped?: boolean;
	onFlip?: (flipped: boolean) => void;
}

/**
 * Card image with optional flip support for multi-faced cards.
 *
 * Flip behavior is auto-detected from card.layout:
 * - transform/modal_dfc/meld: 3D flip to back face image
 * - split: 90° rotation (scaled to fit)
 * - flip (Kamigawa): 180° rotation
 *
 * Uncontrolled by default (manages own flip state).
 * Pass isFlipped + onFlip for controlled mode.
 */
export function CardImage({
	card,
	size = "normal",
	face = "front",
	outerClassName,
	imgClassName,
	isFlipped: controlledFlipped,
	onFlip,
}: CardImageProps) {
	const [internalFlipped, setInternalFlipped] = useState(false);
	const isControlled = controlledFlipped !== undefined;
	const isFlipped = isControlled ? controlledFlipped : internalFlipped;

	const flippable = canFlip({ layout: card.layout } as Card);
	const flipBehavior = getFlipBehavior(card.layout);
	const hasBack = hasBackImage(card.layout);

	// Button position varies by card type to sit nicely over art
	const buttonPosition =
		flipBehavior === "rotate90"
			? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" // split: center
			: flipBehavior === "rotate180"
				? "top-[15%] right-[15%]" // flip (Kamigawa): more inset
				: "top-[15%] right-[8%]"; // transform/MDFC: top-right of art

	const handleFlip = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const newValue = !isFlipped;
		if (onFlip) {
			onFlip(newValue);
		}
		if (!isControlled) {
			setInternalFlipped(newValue);
		}
	};

	// Base styles always applied to images
	// text-transparent hides browser's ugly alt text rendering
	const imgBaseClassName = `max-w-full text-transparent ${imgClassName ?? ""}`;

	if (!flippable) {
		// Non-flippable: no wrapper, both outer and img classes go on the img
		return (
			<img
				src={getImageUri(card.id, size, face)}
				alt={card.name}
				className={`${outerClassName ?? ""} ${imgBaseClassName} bg-gray-200 dark:bg-zinc-700`}
				style={{ ...CARD_STYLES, backgroundImage: PLACEHOLDER_STRIPES }}
				loading="lazy"
			/>
		);
	}

	// Scale factor for 90° rotation to keep card in bounds (card is 5:7 ratio)
	const rotateScale = 5 / 7;

	return (
		<div
			className={`relative group ${outerClassName ?? ""}`}
			style={{ aspectRatio: CARD_ASPECT_RATIO }}
		>
			{flipBehavior === "transform" && hasBack ? (
				<div
					className="w-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out"
					style={{
						transformStyle: "preserve-3d",
						transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					<img
						src={getImageUri(card.id, size, "front")}
						alt={card.name}
						className={`w-full ${imgBaseClassName} bg-gray-200 dark:bg-zinc-700`}
						loading="lazy"
						style={{
							...CARD_STYLES,
							backfaceVisibility: "hidden",
							backgroundImage: PLACEHOLDER_STRIPES,
						}}
					/>
					<img
						src={getImageUri(card.id, size, "back")}
						alt={`${card.name} (back)`}
						className={`w-full ${imgBaseClassName} bg-gray-200 dark:bg-zinc-700 absolute inset-0`}
						loading="lazy"
						style={{
							...CARD_STYLES,
							backfaceVisibility: "hidden",
							transform: "rotateY(180deg)",
							backgroundImage: PLACEHOLDER_STRIPES,
						}}
					/>
				</div>
			) : (
				<img
					src={getImageUri(card.id, size, face)}
					alt={card.name}
					className={`w-full ${imgBaseClassName} bg-gray-200 dark:bg-zinc-700 motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-in-out`}
					loading="lazy"
					style={{
						...CARD_STYLES,
						backgroundImage: PLACEHOLDER_STRIPES,
						transformOrigin: "center center",
						transform: isFlipped
							? flipBehavior === "rotate90"
								? `rotate(90deg) scale(${rotateScale})`
								: "rotate(180deg)"
							: "rotate(0deg)",
					}}
				/>
			)}
			<button
				type="button"
				onClick={handleFlip}
				className={`absolute ${buttonPosition} p-3 rounded-full bg-black/60 text-white opacity-60 hover:opacity-100 transition-opacity z-10`}
				aria-label="Flip card"
			>
				<RotateCcw className="w-6 h-6" />
			</button>
		</div>
	);
}

/**
 * Loading placeholder for card thumbnails
 */
export function CardSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={`bg-gray-200 dark:bg-zinc-700 animate-pulse ${className ?? ""}`}
			style={{ ...CARD_STYLES, backgroundImage: PLACEHOLDER_STRIPES }}
		/>
	);
}

interface CardThumbnailProps {
	card: Card;
	href?: string;
	onClick?: () => void;
}

/**
 * Card thumbnail with hover effects and optional link/click
 */
export function CardThumbnail({ card, href, onClick }: CardThumbnailProps) {
	const content = (
		<>
			<CardImage
				card={card}
				size="normal"
				outerClassName="w-full h-full"
				imgClassName="object-cover"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 dark:from-black/90 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity">
				<div className="absolute bottom-0 left-0 right-0 p-3">
					<p className="text-white font-semibold text-sm line-clamp-2">
						{card.name}
					</p>
					{card.set_name && (
						<p className="text-gray-200 dark:text-zinc-300 text-xs mt-1">
							{card.set_name}
						</p>
					)}
				</div>
			</div>
		</>
	);

	const wrapperClassName =
		"group relative overflow-hidden hover:ring-2 hover:ring-cyan-500 motion-safe:transition-shadow block";

	if (href) {
		return (
			<Link
				to={href}
				className={wrapperClassName}
				style={CARD_STYLES}
				onClick={onClick}
			>
				{content}
			</Link>
		);
	}

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={wrapperClassName}
				style={CARD_STYLES}
			>
				{content}
			</button>
		);
	}

	return (
		<div className={wrapperClassName} style={CARD_STYLES}>
			{content}
		</div>
	);
}

interface CardPreviewProps {
	cardId: ScryfallId;
	name: string;
	setName?: string;
	href?: string;
	className?: string;
}

/**
 * Minimal card preview (for "other printings" grids)
 */
export function CardPreview({
	cardId,
	name,
	setName,
	href,
	className,
}: CardPreviewProps) {
	const card: Card = { id: cardId, name } as Card;
	const content = (
		<CardImage
			card={card}
			size="normal"
			outerClassName="w-full h-full"
			imgClassName="object-cover"
		/>
	);

	const baseClassName = `overflow-hidden hover:ring-2 hover:ring-cyan-500 motion-safe:transition-shadow block ${className ?? ""}`;

	if (href) {
		return (
			<Link
				to={href}
				className={baseClassName}
				style={CARD_STYLES}
				title={setName}
			>
				{content}
			</Link>
		);
	}

	return (
		<div className={baseClassName} style={CARD_STYLES} title={setName}>
			{content}
		</div>
	);
}
