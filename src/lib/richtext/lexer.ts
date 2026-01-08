const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ASTERISK = 0x2a; // '*'

export type TokenType = "BOLD_MARKER" | "ITALIC_MARKER" | "TEXT";

export interface Token {
	type: TokenType;
	byteStart: number;
	byteEnd: number;
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

		// Regular byte - accumulate into text
		if (textStart === null) {
			textStart = i;
		}
		i += 1;
	}

	flushText();
	return tokens;
}

export function getTokenText(input: string, token: Token): string {
	const bytes = encoder.encode(input);
	return decoder.decode(bytes.slice(token.byteStart, token.byteEnd));
}
