/**
 * Renders oracle text with inline mana/card symbols
 *
 * Parses text like "Add {G} or {U}\nDraw a card" and renders symbols inline,
 * preserving newlines.
 */

import type React from "react";
import { VALID_SYMBOLS } from "@/lib/card-manifest";
import { CardSymbol } from "./CardSymbol";

interface OracleTextProps {
	text: string;
	className?: string;
	symbolSize?: "small" | "medium" | "large" | "text";
}

type ParsedPart =
	| { type: "text"; content: string }
	| { type: "symbol"; content: string }
	| { type: "reminder"; parts: ParsedPart[] };

function parseLine(line: string): ParsedPart[] {
	const parts: ParsedPart[] = [];
	let i = 0;

	while (i < line.length) {
		// Check for symbol {X}
		if (line[i] === "{") {
			const closeIdx = line.indexOf("}", i);
			if (closeIdx !== -1) {
				const symbolContent = line.slice(i + 1, closeIdx).toUpperCase();
				// Only treat as symbol if it's a valid MTG symbol
				if (VALID_SYMBOLS.has(symbolContent)) {
					parts.push({
						type: "symbol",
						content: symbolContent,
					});
					i = closeIdx + 1;
					continue;
				}
			}
		}

		// Check for reminder text (...)
		if (line[i] === "(") {
			const closeIdx = findMatchingParen(line, i);
			if (closeIdx !== -1) {
				const reminderContent = line.slice(i + 1, closeIdx);
				// Recursively parse symbols within reminder text
				const reminderParts = parseLine(reminderContent);
				parts.push({
					type: "reminder",
					parts: reminderParts,
				});
				i = closeIdx + 1;
				continue;
			}
		}

		// Regular text - collect until next special char
		let textEnd = i;
		while (
			textEnd < line.length &&
			line[textEnd] !== "{" &&
			line[textEnd] !== "("
		) {
			textEnd++;
		}

		if (textEnd > i) {
			parts.push({
				type: "text",
				content: line.slice(i, textEnd),
			});
			i = textEnd;
		} else {
			// Unmatched special char, treat as text
			parts.push({
				type: "text",
				content: line[i],
			});
			i++;
		}
	}

	return parts;
}

function findMatchingParen(str: string, openIdx: number): number {
	let depth = 1;
	for (let i = openIdx + 1; i < str.length; i++) {
		if (str[i] === "(") depth++;
		else if (str[i] === ")") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function renderParts(
	parts: ParsedPart[],
	symbolSize: "small" | "medium" | "large" | "text",
): React.ReactNode[] {
	return parts.map((part, i) => {
		if (part.type === "symbol") {
			return (
				<CardSymbol
					// biome-ignore lint/suspicious/noArrayIndexKey: symbols in oracle text are stable ordered list
					key={i}
					symbol={part.content}
					size={symbolSize}
					className="inline align-middle mx-0.5"
				/>
			);
		}
		if (part.type === "reminder") {
			return (
				// biome-ignore lint/suspicious/noArrayIndexKey: text fragments in oracle text are stable ordered list
				<span key={i} className="italic">
					({renderParts(part.parts, symbolSize)})
				</span>
			);
		}
		return (
			// biome-ignore lint/suspicious/noArrayIndexKey: text fragments in oracle text are stable ordered list
			<span key={i}>{part.content}</span>
		);
	});
}

export function OracleText({
	text,
	className,
	symbolSize = "small",
}: OracleTextProps) {
	const lines = text.split("\n");

	return (
		<span className={className}>
			{lines.map((line, lineIndex) => {
				const parts = parseLine(line);
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: oracle text lines are stable ordered list
					<span key={lineIndex}>
						{renderParts(parts, symbolSize)}
						{lineIndex < lines.length - 1 && <br />}
					</span>
				);
			})}
		</span>
	);
}
