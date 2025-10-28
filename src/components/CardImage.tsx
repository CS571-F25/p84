/**
 * Reusable card image components for different use cases
 */

import { Link } from "@tanstack/react-router";
import type { Card, ImageSize, ScryfallId } from "../lib/scryfall-types";
import { getImageUri } from "../lib/scryfall-utils";

interface CardImageProps {
	card: Card;
	size?: ImageSize;
	className?: string;
}

/**
 * Basic card image - use specific components (CardThumbnail, CardDetail) when possible
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
			className={`${className ?? ""} rounded-[4.75%/3.5%]`}
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
				size="normal"
				className="w-full h-full object-cover rounded-[4.75%/3.5%]"
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
