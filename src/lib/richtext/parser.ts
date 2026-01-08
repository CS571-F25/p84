import {
	type CodeBlockToken,
	isCodeBlockToken,
	isLinkToken,
	isMentionToken,
	type LinkToken,
	type MentionToken,
	type Token,
	tokenize,
} from "./lexer";
import {
	BOLD,
	CODE,
	CODE_BLOCK,
	type Facet,
	type FormatFeature,
	ITALIC,
	link,
	mention,
	type ParseResult,
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function parseMarkdown(input: string): ParseResult {
	const tokens = tokenize(input);
	const bytes = encoder.encode(input);

	// Find matching pairs for bold, italic, and code markers
	const boldPairs = findPairs(tokens, "BOLD_MARKER");
	const italicPairs = findPairs(tokens, "ITALIC_MARKER");
	const codePairs = findPairs(tokens, "CODE_MARKER");

	// Build output: collect text tokens and paired markers' content
	const outputBytes: number[] = [];
	const facets: Facet[] = [];

	// Track byte position mapping: original byte -> output byte
	let outputBytePos = 0;

	const emitBytes = (start: number, end: number) => {
		for (let b = start; b < end; b++) {
			outputBytes.push(bytes[b]);
		}
		outputBytePos += end - start;
	};

	const handlePairedMarker = (
		token: Token,
		pairs: Map<Token, PairInfo>,
		feature: FormatFeature,
	) => {
		const pair = pairs.get(token);
		if (pair) {
			if (pair.isOpen) {
				pair.outputByteStart = outputBytePos;
			} else {
				const openPair = pair.partner;
				if (
					openPair?.outputByteStart !== undefined &&
					outputBytePos > openPair.outputByteStart
				) {
					// Non-empty span: create facet
					facets.push({
						index: {
							byteStart: openPair.outputByteStart,
							byteEnd: outputBytePos,
						},
						features: [feature],
					});
				} else if (openPair?.openToken) {
					// Empty span: emit both markers as literal text
					emitBytes(openPair.openToken.byteStart, openPair.openToken.byteEnd);
					emitBytes(token.byteStart, token.byteEnd);
				}
			}
		} else {
			// Unpaired marker - emit as literal text
			emitBytes(token.byteStart, token.byteEnd);
		}
	};

	for (const token of tokens) {
		if (token.type === "TEXT") {
			emitBytes(token.byteStart, token.byteEnd);
		} else if (token.type === "BOLD_MARKER") {
			handlePairedMarker(token, boldPairs, BOLD);
		} else if (token.type === "ITALIC_MARKER") {
			handlePairedMarker(token, italicPairs, ITALIC);
		} else if (token.type === "CODE_MARKER") {
			handlePairedMarker(token, codePairs, CODE);
		} else if (token.type === "CODE_BLOCK" && isCodeBlockToken(token)) {
			const codeBlock = token as CodeBlockToken;
			const contentStart = outputBytePos;

			// Copy content bytes
			for (let b = codeBlock.contentStart; b < codeBlock.contentEnd; b++) {
				outputBytes.push(bytes[b]);
			}
			outputBytePos += codeBlock.contentEnd - codeBlock.contentStart;

			facets.push({
				index: { byteStart: contentStart, byteEnd: outputBytePos },
				features: [CODE_BLOCK],
			});
		} else if (token.type === "LINK" && isLinkToken(token)) {
			const linkToken = token as LinkToken;
			const textStart = outputBytePos;

			// Copy link text bytes
			for (let b = linkToken.textStart; b < linkToken.textEnd; b++) {
				outputBytes.push(bytes[b]);
			}
			outputBytePos += linkToken.textEnd - linkToken.textStart;

			// Extract URI
			const uri = decoder.decode(
				bytes.slice(linkToken.uriStart, linkToken.uriEnd),
			);

			facets.push({
				index: { byteStart: textStart, byteEnd: outputBytePos },
				features: [link(uri)],
			});
		} else if (token.type === "MENTION" && isMentionToken(token)) {
			const mentionToken = token as MentionToken;
			const mentionStart = outputBytePos;

			// Copy full @handle to output
			for (let b = token.byteStart; b < token.byteEnd; b++) {
				outputBytes.push(bytes[b]);
			}
			outputBytePos += token.byteEnd - token.byteStart;

			// Extract handle (without @)
			const handle = decoder.decode(
				bytes.slice(mentionToken.handleStart, mentionToken.handleEnd),
			);

			facets.push({
				index: { byteStart: mentionStart, byteEnd: outputBytePos },
				features: [mention(handle)],
			});
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
	openToken?: Token;
	outputByteStart?: number;
}

function findPairs(
	tokens: Token[],
	markerType: "BOLD_MARKER" | "ITALIC_MARKER" | "CODE_MARKER",
): Map<Token, PairInfo> {
	const pairs = new Map<Token, PairInfo>();
	const stack: { token: Token; info: PairInfo }[] = [];

	for (const token of tokens) {
		if (token.type === markerType) {
			const open = stack.pop();
			if (open) {
				const closeInfo: PairInfo = {
					isOpen: false,
					partner: open.info,
					openToken: open.token,
				};
				open.info.partner = closeInfo;
				pairs.set(token, closeInfo);
			} else {
				const openInfo: PairInfo = { isOpen: true, openToken: token };
				stack.push({ token, info: openInfo });
				pairs.set(token, openInfo);
			}
		}
	}

	for (const { token, info } of stack) {
		if (!info.partner) {
			pairs.delete(token);
		}
	}

	return pairs;
}
