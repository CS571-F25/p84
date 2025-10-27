/**
 * Renders MTG mana cost
 *
 * Parses mana cost strings like "{2}{U}{B}" and renders them as symbols.
 */

import { CardSymbol } from "./CardSymbol";

interface ManaCostProps {
	cost: string;
	size?: "small" | "medium" | "large";
}

export function ManaCost({ cost, size = "medium" }: ManaCostProps) {
	// Parse mana cost string like "{2}{U}{B}" into symbols
	const symbols = Array.from(
		cost.matchAll(/\{([^}]+)\}/g),
		(match) => match[1],
	);

	if (symbols.length === 0) {
		return null;
	}

	return (
		<div className="inline-flex items-center gap-0.5">
			{symbols.map((symbol, i) => (
				<CardSymbol
					// biome-ignore lint/suspicious/noArrayIndexKey: mana symbols are stable ordered list
					key={i}
					symbol={symbol}
					size={size}
				/>
			))}
		</div>
	);
}
