/**
 * Renders oracle text with inline mana/card symbols
 *
 * Parses text like "Add {G} or {U}\nDraw a card" and renders symbols inline,
 * preserving newlines.
 */

import { CardSymbol } from "./CardSymbol";

interface OracleTextProps {
	text: string;
	className?: string;
}

function parseLine(line: string) {
	const parts: Array<{ type: "text" | "symbol"; content: string }> = [];
	let lastIndex = 0;

	const symbolRegex = /\{([^}]+)\}/g;
	let match = symbolRegex.exec(line);

	while (match !== null) {
		if (match.index > lastIndex) {
			parts.push({
				type: "text",
				content: line.slice(lastIndex, match.index),
			});
		}

		parts.push({
			type: "symbol",
			content: match[1],
		});

		lastIndex = match.index + match[0].length;
		match = symbolRegex.exec(line);
	}

	if (lastIndex < line.length) {
		parts.push({
			type: "text",
			content: line.slice(lastIndex),
		});
	}

	return parts;
}

export function OracleText({ text, className }: OracleTextProps) {
	const lines = text.split("\n");

	return (
		<span className={className}>
			{lines.map((line, lineIndex) => {
				const parts = parseLine(line);
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: oracle text lines are stable ordered list
					<span key={lineIndex}>
						{parts.map((part, i) =>
							part.type === "symbol" ? (
								<CardSymbol
									// biome-ignore lint/suspicious/noArrayIndexKey: symbols in oracle text are stable ordered list
									key={i}
									symbol={part.content}
									size="small"
									className="inline align-text-bottom mx-0.5"
								/>
							) : (
								// biome-ignore lint/suspicious/noArrayIndexKey: text fragments in oracle text are stable ordered list
								<span key={i}>{part.content}</span>
							),
						)}
						{lineIndex < lines.length - 1 && <br />}
					</span>
				);
			})}
		</span>
	);
}
