/**
 * Reusable card image components for different use cases
 */

import { Link } from "@tanstack/react-router";
import type { Card, ScryfallId } from "../lib/scryfall-types";
import { getImageUri } from "../lib/scryfall-utils";

interface CardImageProps {
	card: Card;
	size?: "small" | "normal" | "large";
	className?: string;
}

/**
 * Basic card image without container
 */
export function CardImage({
	card,
	size = "normal",
	className,
}: CardImageProps) {
	return (
		<img
			src={getImageUri(card.id, size)}
			alt={card.name}
			className={`${className ?? ""}`}
			loading="lazy"
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
				size="small"
				className="w-full h-full object-cover"
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
				<div className="absolute bottom-0 left-0 right-0 p-3">
					<p className="text-white font-semibold text-sm line-clamp-2">
						{card.name}
					</p>
					{card.set_name && (
						<p className="text-gray-300 text-xs mt-1">{card.set_name}</p>
					)}
				</div>
			</div>
		</>
	);

	const className =
		"group relative aspect-[5/7] rounded-lg overflow-hidden bg-slate-800 hover:ring-2 hover:ring-cyan-500 transition-all block";

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
			size="small"
			className="w-full h-full object-cover"
		/>
	);

	const baseClassName =
		"aspect-[5/7] rounded overflow-hidden hover:ring-2 hover:ring-cyan-500 transition-all block";
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
