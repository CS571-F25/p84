import { type Token, tokenize } from "./lexer";
import { BOLD, type Facet, ITALIC, type ParseResult } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function parseMarkdown(input: string): ParseResult {
	const tokens = tokenize(input);
	const bytes = encoder.encode(input);

	// Find matching pairs for bold and italic markers
	const boldPairs = findPairs(tokens, "BOLD_MARKER");
	const italicPairs = findPairs(tokens, "ITALIC_MARKER");

	// Build output: collect text tokens and paired markers' content
	const outputBytes: number[] = [];
	const facets: Facet[] = [];

	// Track byte position mapping: original byte -> output byte
	// We need this to compute facet positions in the output
	let outputBytePos = 0;

	for (const token of tokens) {
		if (token.type === "TEXT") {
			// Copy text bytes to output
			for (let b = token.byteStart; b < token.byteEnd; b++) {
				outputBytes.push(bytes[b]);
			}
			outputBytePos += token.byteEnd - token.byteStart;
		} else if (token.type === "BOLD_MARKER") {
			const pair = boldPairs.get(token);
			if (pair) {
				if (pair.isOpen) {
					// Record where this span starts in output
					pair.outputByteStart = outputBytePos;
				} else {
					// Create facet for the span
					const openPair = pair.partner;
					if (
						openPair?.outputByteStart !== undefined &&
						outputBytePos > openPair.outputByteStart
					) {
						facets.push({
							index: {
								byteStart: openPair.outputByteStart,
								byteEnd: outputBytePos,
							},
							features: [BOLD],
						});
					}
				}
			} else {
				// Unpaired marker - emit as literal text
				for (let b = token.byteStart; b < token.byteEnd; b++) {
					outputBytes.push(bytes[b]);
				}
				outputBytePos += token.byteEnd - token.byteStart;
			}
		} else if (token.type === "ITALIC_MARKER") {
			const pair = italicPairs.get(token);
			if (pair) {
				if (pair.isOpen) {
					pair.outputByteStart = outputBytePos;
				} else {
					const openPair = pair.partner;
					if (
						openPair?.outputByteStart !== undefined &&
						outputBytePos > openPair.outputByteStart
					) {
						facets.push({
							index: {
								byteStart: openPair.outputByteStart,
								byteEnd: outputBytePos,
							},
							features: [ITALIC],
						});
					}
				}
			} else {
				// Unpaired marker - emit as literal text
				for (let b = token.byteStart; b < token.byteEnd; b++) {
					outputBytes.push(bytes[b]);
				}
				outputBytePos += token.byteEnd - token.byteStart;
			}
		}
	}

	const text = decoder.decode(new Uint8Array(outputBytes));
	return {
		text,
		facets: facets.sort((a, b) => a.index.byteStart - b.index.byteStart),
	};
}

interface PairInfo {
	isOpen: boolean;
	partner?: PairInfo;
	outputByteStart?: number;
}

function findPairs(
	tokens: Token[],
	markerType: "BOLD_MARKER" | "ITALIC_MARKER",
): Map<Token, PairInfo> {
	const pairs = new Map<Token, PairInfo>();
	const stack: { token: Token; info: PairInfo }[] = [];

	for (const token of tokens) {
		if (token.type === markerType) {
			const open = stack.pop();
			if (open) {
				// Close: pair with the most recent open
				const closeInfo: PairInfo = { isOpen: false, partner: open.info };
				open.info.partner = closeInfo;
				pairs.set(token, closeInfo);
			} else {
				// Open: push onto stack
				const openInfo: PairInfo = { isOpen: true };
				stack.push({ token, info: openInfo });
				pairs.set(token, openInfo);
			}
		}
	}

	// Remove unpaired opens from the map
	for (const { token, info } of stack) {
		if (!info.partner) {
			pairs.delete(token);
		}
	}

	return pairs;
}
