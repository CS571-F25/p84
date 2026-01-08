const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ASTERISK = 0x2a; // '*'
const BACKTICK = 0x60; // '`'
const AT = 0x40; // '@'
const LBRACKET = 0x5b; // '['
const RBRACKET = 0x5d; // ']'
const LPAREN = 0x28; // '('
const RPAREN = 0x29; // ')'
const NEWLINE = 0x0a; // '\n'
const PERIOD = 0x2e; // '.'
const HYPHEN = 0x2d; // '-'

export type TokenType =
	| "BOLD_MARKER"
	| "ITALIC_MARKER"
	| "CODE_MARKER"
	| "CODE_BLOCK"
	| "LINK"
	| "MENTION"
	| "TEXT";

export interface Token {
	type: TokenType;
	byteStart: number;
	byteEnd: number;
}

export interface LinkToken extends Token {
	type: "LINK";
	textStart: number;
	textEnd: number;
	uriStart: number;
	uriEnd: number;
}

export interface MentionToken extends Token {
	type: "MENTION";
	handleStart: number;
	handleEnd: number;
}

export interface CodeBlockToken extends Token {
	type: "CODE_BLOCK";
	contentStart: number;
	contentEnd: number;
}

export function isLinkToken(token: Token): token is LinkToken {
	return token.type === "LINK";
}

export function isMentionToken(token: Token): token is MentionToken {
	return token.type === "MENTION";
}

export function isCodeBlockToken(token: Token): token is CodeBlockToken {
	return token.type === "CODE_BLOCK";
}

export function tokenize(input: string): Token[] {
	const bytes = encoder.encode(input);
	const tokens: Token[] = [];
	let i = 0;
	let textStart: number | null = null;

	const flushText = () => {
		if (textStart !== null && textStart < i) {
			tokens.push({
				type: "TEXT",
				byteStart: textStart,
				byteEnd: i,
			});
			textStart = null;
		}
	};

	while (i < bytes.length) {
		// Check for ``` (code block) - must be at start of line or start of input
		if (
			bytes[i] === BACKTICK &&
			bytes[i + 1] === BACKTICK &&
			bytes[i + 2] === BACKTICK
		) {
			const isStartOfLine = i === 0 || bytes[i - 1] === NEWLINE;
			if (isStartOfLine) {
				// Find end of opening line (skip optional language identifier)
				let contentStart = i + 3;
				while (contentStart < bytes.length && bytes[contentStart] !== NEWLINE) {
					contentStart++;
				}
				if (contentStart < bytes.length) {
					contentStart++; // skip the newline
				}

				// Find closing ```
				let contentEnd = contentStart;
				let found = false;
				while (contentEnd < bytes.length) {
					if (
						bytes[contentEnd] === NEWLINE &&
						bytes[contentEnd + 1] === BACKTICK &&
						bytes[contentEnd + 2] === BACKTICK &&
						bytes[contentEnd + 3] === BACKTICK
					) {
						found = true;
						break;
					}
					contentEnd++;
				}

				if (found) {
					flushText();
					const blockEnd = contentEnd + 4; // newline + ```
					tokens.push({
						type: "CODE_BLOCK",
						byteStart: i,
						byteEnd: blockEnd,
						contentStart,
						contentEnd,
					} as CodeBlockToken);
					i = blockEnd;
					continue;
				}
			}
		}

		// Check for ** (bold marker)
		if (bytes[i] === ASTERISK && bytes[i + 1] === ASTERISK) {
			flushText();
			tokens.push({ type: "BOLD_MARKER", byteStart: i, byteEnd: i + 2 });
			i += 2;
			continue;
		}

		// Check for * (italic marker)
		if (bytes[i] === ASTERISK) {
			flushText();
			tokens.push({ type: "ITALIC_MARKER", byteStart: i, byteEnd: i + 1 });
			i += 1;
			continue;
		}

		// Check for ` (inline code marker)
		if (bytes[i] === BACKTICK) {
			flushText();
			tokens.push({ type: "CODE_MARKER", byteStart: i, byteEnd: i + 1 });
			i += 1;
			continue;
		}

		// Check for [text](url) (link)
		if (bytes[i] === LBRACKET) {
			const linkResult = tryParseLink(bytes, i);
			if (linkResult) {
				flushText();
				tokens.push(linkResult);
				i = linkResult.byteEnd;
				continue;
			}
		}

		// Check for @handle (mention)
		if (bytes[i] === AT) {
			const mentionResult = tryParseMention(bytes, i);
			if (mentionResult) {
				flushText();
				tokens.push(mentionResult);
				i = mentionResult.byteEnd;
				continue;
			}
		}

		// Regular byte - accumulate into text
		if (textStart === null) {
			textStart = i;
		}
		i += 1;
	}

	flushText();
	return tokens;
}

function tryParseLink(bytes: Uint8Array, start: number): LinkToken | null {
	// [text](url)
	let i = start + 1; // skip [
	const textStart = i;

	// Find ]
	while (i < bytes.length && bytes[i] !== RBRACKET && bytes[i] !== NEWLINE) {
		i++;
	}
	if (i >= bytes.length || bytes[i] !== RBRACKET) return null;
	const textEnd = i;
	i++; // skip ]

	// Must be followed by (
	if (bytes[i] !== LPAREN) return null;
	i++; // skip (
	const uriStart = i;

	// Find )
	while (i < bytes.length && bytes[i] !== RPAREN && bytes[i] !== NEWLINE) {
		i++;
	}
	if (i >= bytes.length || bytes[i] !== RPAREN) return null;
	const uriEnd = i;
	i++; // skip )

	// Must have non-empty text and uri
	if (textEnd <= textStart || uriEnd <= uriStart) return null;

	return {
		type: "LINK",
		byteStart: start,
		byteEnd: i,
		textStart,
		textEnd,
		uriStart,
		uriEnd,
	};
}

function isHandleChar(b: number): boolean {
	// a-z, A-Z, 0-9, -, .
	return (
		(b >= 0x61 && b <= 0x7a) ||
		(b >= 0x41 && b <= 0x5a) ||
		(b >= 0x30 && b <= 0x39) ||
		b === HYPHEN ||
		b === PERIOD
	);
}

function tryParseMention(
	bytes: Uint8Array,
	start: number,
): MentionToken | null {
	// @handle - ATProto handles: a-z, 0-9, -, . with at least one dot
	let i = start + 1; // skip @
	const handleStart = i;
	let dotCount = 0;

	while (i < bytes.length && isHandleChar(bytes[i])) {
		if (bytes[i] === PERIOD) {
			// Can't have consecutive dots or start with dot
			if (i === handleStart || bytes[i - 1] === PERIOD) {
				return null;
			}
			dotCount++;
		}
		i++;
	}

	const handleEnd = i;

	// Must have at least one dot (two segments)
	if (dotCount < 1) return null;

	// Can't end with dot or hyphen
	const lastChar = bytes[handleEnd - 1];
	if (lastChar === PERIOD || lastChar === HYPHEN) return null;

	if (handleEnd <= handleStart) return null;

	return {
		type: "MENTION",
		byteStart: start,
		byteEnd: handleEnd,
		handleStart,
		handleEnd,
	};
}

export function getTokenText(input: string, token: Token): string {
	const bytes = encoder.encode(input);
	return decoder.decode(bytes.slice(token.byteStart, token.byteEnd));
}
