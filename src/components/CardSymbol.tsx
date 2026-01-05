/**
 * Renders a single MTG card symbol (mana, tap, energy, etc)
 *
 * Uses locally downloaded symbol SVGs from Scryfall.
 */

interface CardSymbolProps {
	symbol: string;
	size?: "small" | "medium" | "large" | "text";
	className?: string;
}

const SIZE_CLASSES = {
	small: "w-4 h-4",
	medium: "w-5 h-5",
	large: "w-6 h-6",
	text: "h-[1.1em] w-[1.1em]",
};

export function CardSymbol({
	symbol,
	size = "medium",
	className,
}: CardSymbolProps) {
	// Normalize symbol for filename (e.g., "2/W" -> "2w", "T" -> "t")
	const normalizedSymbol = symbol.toLowerCase().replace("/", "");

	return (
		<img
			src={`/symbols/${normalizedSymbol}.svg`}
			alt={symbol}
			className={`${SIZE_CLASSES[size]} ${className ?? ""}`}
			title={symbol}
		/>
	);
}
