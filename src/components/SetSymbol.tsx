/**
 * Renders an MTG set symbol using the Keyrune font
 *
 * https://github.com/andrewgioia/keyrune
 */

import { getSetSymbol } from "@/lib/set-symbols";

interface SetSymbolProps {
	setCode: string;
	rarity?: string;
	size?: "small" | "medium" | "large";
	className?: string;
}

const SIZE_CLASSES = {
	small: "text-base",
	medium: "text-xl",
	large: "text-2xl",
};

const RARITY_CLASSES: Record<string, string> = {
	common: "text-rarity-common dark:text-zinc-300",
	uncommon: "text-rarity-uncommon",
	rare: "text-rarity-rare",
	mythic: "text-rarity-mythic",
	timeshifted: "text-rarity-timeshifted",
};

export function SetSymbol({
	setCode,
	rarity,
	size = "medium",
	className,
}: SetSymbolProps) {
	const symbol = getSetSymbol(setCode);

	if (!symbol) {
		return null;
	}

	const rarityClass =
		RARITY_CLASSES[rarity ?? "common"] ?? RARITY_CLASSES.common;

	return (
		<span
			role="img"
			className={`font-['Keyrune'] ${SIZE_CLASSES[size]} ${rarityClass} ${className ?? ""}`}
			title={`${setCode.toUpperCase()}${rarity ? ` (${rarity})` : ""}`}
			aria-label={`Set: ${setCode.toUpperCase()}${rarity ? `, Rarity: ${rarity}` : ""}`}
		>
			{symbol}
		</span>
	);
}
