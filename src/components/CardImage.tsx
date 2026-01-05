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

interface CardImageProps {
	card: Pick<Card, "name" | "id"> & { layout?: Layout };
	size?: ImageSize;
	face?: CardFaceType;
	className?: string;
	isFlipped?: boolean;
	onFlip?: (flipped: boolean) => void;
}

/**
 * Card image with optional flip support for multi-faced cards.
 *
 * Flip behavior is auto-detected from card.layout:
 * - transform/modal_dfc/meld: 3D flip to back face image
 * - split: 90° rotation
 * - flip (Kamigawa): 180° rotation
 *
 * Uncontrolled by default (manages own flip state).
 * Pass isFlipped + onFlip for controlled mode.
 */
export function CardImage({
	card,
	size = "normal",
	face = "front",
	className,
	isFlipped: controlledFlipped,
	onFlip,
}: CardImageProps) {
	const [internalFlipped, setInternalFlipped] = useState(false);
	const isControlled = controlledFlipped !== undefined;
	const isFlipped = isControlled ? controlledFlipped : internalFlipped;

	const flippable = canFlip({ layout: card.layout } as Card);
	const flipBehavior = getFlipBehavior(card.layout);
	const hasBack = hasBackImage(card.layout);

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

	const baseClassName = `${className ?? ""} rounded-[4.75%/3.5%]`;

	if (!flippable) {
		return (
			<img
				src={getImageUri(card.id, size, face)}
				alt={card.name}
				className={baseClassName}
				loading="lazy"
			/>
		);
	}

	return (
		<div className="relative group">
			{flipBehavior === "transform" && hasBack ? (
				<div
					className="w-full transition-transform duration-500 ease-in-out"
					style={{
						transformStyle: "preserve-3d",
						transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
					}}
				>
					<img
						src={getImageUri(card.id, size, "front")}
						alt={card.name}
						className={baseClassName}
						loading="lazy"
						style={{ backfaceVisibility: "hidden" }}
					/>
					<img
						src={getImageUri(card.id, size, "back")}
						alt={`${card.name} (back)`}
						className={`${baseClassName} absolute inset-0`}
						loading="lazy"
						style={{
							backfaceVisibility: "hidden",
							transform: "rotateY(180deg)",
						}}
					/>
				</div>
			) : (
				<img
					src={getImageUri(card.id, size, face)}
					alt={card.name}
					className={baseClassName}
					loading="lazy"
					style={{
						transition: "transform 0.5s ease-in-out",
						transform: isFlipped
							? `rotate(${flipBehavior === "rotate90" ? 90 : 180}deg)`
							: "rotate(0deg)",
					}}
				/>
			)}
			<button
				type="button"
				onClick={handleFlip}
				className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
				aria-label="Flip card"
			>
				<RotateCcw className="w-4 h-4" />
			</button>
		</div>
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
				className="w-full h-full object-cover rounded-[4.75%/3.5%]"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 dark:from-black/90 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
				<div className="absolute bottom-0 left-0 right-0 p-3">
					<p className="text-white font-semibold text-sm line-clamp-2">
						{card.name}
					</p>
					{card.set_name && (
						<p className="text-gray-200 dark:text-gray-300 text-xs mt-1">
							{card.set_name}
						</p>
					)}
				</div>
			</div>
		</>
	);

	const className =
		"group relative aspect-[5/7] overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all block rounded-[4.75%/3.5%]";

	if (href) {
		return (
			<Link to={href} className={className}>
				{content}
			</Link>
		);
	}

	if (onClick) {
		return (
			<button type="button" onClick={onClick} className={className}>
				{content}
			</button>
		);
	}

	return <div className={className}>{content}</div>;
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
			className="w-full h-full object-cover rounded-[4.75%/3.5%]"
		/>
	);

	const baseClassName =
		"aspect-[5/7] overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all block rounded-[4.75%/3.5%]";
	const finalClassName = `${baseClassName} ${className ?? ""}`;

	if (href) {
		return (
			<Link to={href} className={finalClassName} title={setName}>
				{content}
			</Link>
		);
	}

	return (
		<div className={finalClassName} title={setName}>
			{content}
		</div>
	);
}
