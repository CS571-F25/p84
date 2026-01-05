/**
 * Renders an MTG set symbol using the Keyrune font
 *
 * https://github.com/andrewgioia/keyrune
 */

import { getSetSymbol } from "@/lib/set-symbols";

interface SetSymbolProps {
	setCode: string;
	rarity?: "common" | "uncommon" | "rare" | "mythic" | "timeshifted";
	size?: "small" | "medium" | "large";
	className?: string;
}

const SIZE_CLASSES = {
	small: "text-base",
	medium: "text-xl",
	large: "text-2xl",
};

const RARITY_CLASSES = {
	common: "text-rarity-common dark:text-gray-400",
	uncommon: "text-rarity-uncommon",
	rare: "text-rarity-rare",
	mythic: "text-rarity-mythic",
	timeshifted: "text-rarity-timeshifted",
};

export function SetSymbol({
	setCode,
	rarity = "common",
	size = "medium",
	className,
}: SetSymbolProps) {
	const symbol = getSetSymbol(setCode);

	if (!symbol) {
		return null;
	}

	return (
		<span
			role="img"
			className={`font-['Keyrune'] ${SIZE_CLASSES[size]} ${RARITY_CLASSES[rarity]} ${className ?? ""}`}
			title={`${setCode.toUpperCase()} (${rarity})`}
			aria-label={`Set: ${setCode.toUpperCase()}, Rarity: ${rarity}`}
		>
			{symbol}
		</span>
	);
}
