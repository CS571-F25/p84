/**
 * Lexer for Scryfall search syntax
 *
 * Converts input string to token stream.
 */

import {
	err,
	FIELD_ALIASES,
	ok,
	type ParseError,
	type Result,
	type Token,
	type TokenType,
} from "./types";

/**
 * Characters that end a word token
 */
const WORD_TERMINATORS = new Set([
	" ",
	"\t",
	"\n",
	"\r",
	"(",
	")",
	":",
	"=",
	"!",
	"<",
	">",
	'"',
]);

// Track what token types can precede a regex
const REGEX_STARTERS = new Set<TokenType>([
	"COLON",
	"EQUALS",
	"NOT_EQUALS",
	"LT",
	"GT",
	"LTE",
	"GTE",
	"LPAREN",
	"NOT",
	"OR",
]);

/**
 * Check if a word looks like a field name
 */
function isFieldName(word: string): boolean {
	return word.toLowerCase() in FIELD_ALIASES;
}

/**
 * Tokenize input string into token array
 */
export function tokenize(input: string): Result<Token[]> {
	const tokens: Token[] = [];
	let pos = 0;

	function peek(offset = 0): string {
		return input[pos + offset] ?? "";
	}

	function advance(): string {
		return input[pos++] ?? "";
	}

	function skipWhitespace(): void {
		while (pos < input.length && /\s/.test(peek())) {
			pos++;
		}
	}

	function makeToken(type: TokenType, value: string, start: number): Token {
		return { type, value, span: { start, end: pos } };
	}

	function makeError(message: string, start: number): ParseError {
		return { message, span: { start, end: pos }, input };
	}

	function readWord(): string {
		const start = pos;
		while (pos < input.length && !WORD_TERMINATORS.has(peek())) {
			// Handle ! at start of word specially (EXACT_NAME)
			if (peek() === "!" && pos === start) {
				break;
			}
			// Handle - at start of word specially (NOT)
			if (peek() === "-" && pos === start) {
				break;
			}
			pos++;
		}
		return input.slice(start, pos);
	}

	function readQuoted(): Result<string> {
		const start = pos;
		advance(); // consume opening "
		let value = "";

		while (pos < input.length && peek() !== '"') {
			if (peek() === "\\") {
				advance();
				if (pos < input.length) {
					value += advance();
				}
			} else {
				value += advance();
			}
		}

		if (peek() !== '"') {
			return err(makeError("Unterminated quoted string", start));
		}
		advance(); // consume closing "
		return ok(value);
	}

	function readRegex(): Result<{ source: string; pattern: RegExp }> {
		const start = pos;
		advance(); // consume opening /
		let source = "";

		while (pos < input.length && peek() !== "/") {
			if (peek() === "\\") {
				source += advance();
				if (pos < input.length) {
					source += advance();
				}
			} else {
				source += advance();
			}
		}

		if (peek() !== "/") {
			return err(makeError("Unterminated regex", start));
		}
		advance(); // consume closing /

		// Read optional flags
		let flags = "i"; // default case-insensitive
		while (pos < input.length && /[gimsuy]/.test(peek())) {
			const flag = advance();
			if (!flags.includes(flag)) {
				flags += flag;
			}
		}

		// Try to construct the regex
		try {
			const pattern = new RegExp(source, flags);
			return ok({ source, pattern });
		} catch (e) {
			const message =
				e instanceof Error ? e.message : "Invalid regular expression";
			return err(makeError(`Invalid regex: ${message}`, start));
		}
	}

	while (pos < input.length) {
		skipWhitespace();
		if (pos >= input.length) break;

		const start = pos;
		const char = peek();

		// Single-character tokens
		if (char === "(") {
			advance();
			tokens.push(makeToken("LPAREN", "(", start));
			continue;
		}

		if (char === ")") {
			advance();
			tokens.push(makeToken("RPAREN", ")", start));
			continue;
		}

		// Operators
		if (char === ":") {
			advance();
			tokens.push(makeToken("COLON", ":", start));
			continue;
		}

		if (char === "=") {
			advance();
			tokens.push(makeToken("EQUALS", "=", start));
			continue;
		}

		if (char === "!" && peek(1) === "=") {
			advance();
			advance();
			tokens.push(makeToken("NOT_EQUALS", "!=", start));
			continue;
		}

		if (char === "<") {
			advance();
			if (peek() === "=") {
				advance();
				tokens.push(makeToken("LTE", "<=", start));
			} else {
				tokens.push(makeToken("LT", "<", start));
			}
			continue;
		}

		if (char === ">") {
			advance();
			if (peek() === "=") {
				advance();
				tokens.push(makeToken("GTE", ">=", start));
			} else {
				tokens.push(makeToken("GT", ">", start));
			}
			continue;
		}

		// Quoted string
		if (char === '"') {
			const result = readQuoted();
			if (!result.ok) return result;
			tokens.push(makeToken("QUOTED", result.value, start));
			continue;
		}

		// Regex - only after operators/parens, not mid-word
		if (char === "/") {
			const lastToken = tokens[tokens.length - 1];
			const canStartRegex =
				tokens.length === 0 || REGEX_STARTERS.has(lastToken.type);

			if (canStartRegex) {
				const result = readRegex();
				if (!result.ok) return result;
				tokens.push(makeToken("REGEX", result.value.source, start));
				// Store the compiled pattern for later use
				const token = tokens[tokens.length - 1];
				(token as Token & { pattern?: RegExp }).pattern = result.value.pattern;
				continue;
			}
			// Otherwise fall through to word parsing - / will be part of word
		}

		// NOT operator (- at word boundary)
		if (char === "-") {
			advance();
			tokens.push(makeToken("NOT", "-", start));
			continue;
		}

		// Exact name match (! followed by name)
		if (char === "!") {
			advance();
			skipWhitespace();
			// Read until end or quote
			if (peek() === '"') {
				const result = readQuoted();
				if (!result.ok) return result;
				tokens.push(makeToken("EXACT_NAME", result.value, start));
			} else {
				// Read to end of line/input or next structural token
				let value = "";
				while (
					pos < input.length &&
					peek() !== "(" &&
					peek() !== ")" &&
					!/\s/.test(peek())
				) {
					value += advance();
				}
				// For exact match, spaces can be part of name until end
				if (value) {
					tokens.push(makeToken("EXACT_NAME", value, start));
				}
			}
			continue;
		}

		// Words (including field names, OR keyword)
		const word = readWord();
		if (word) {
			// Check for OR keyword
			if (word.toLowerCase() === "or") {
				tokens.push(makeToken("OR", word, start));
				continue;
			}

			// Check if this might be a field name followed by operator
			const nextChar = peek();
			if (
				isFieldName(word) &&
				(nextChar === ":" ||
					nextChar === "=" ||
					nextChar === "<" ||
					nextChar === ">")
			) {
				// It's a field name - emit as WORD, the parser will handle it
				tokens.push(makeToken("WORD", word, start));
			} else {
				tokens.push(makeToken("WORD", word, start));
			}
			continue;
		}

		// Unknown character - skip it
		advance();
	}

	tokens.push(makeToken("EOF", "", pos));
	return ok(tokens);
}

/**
 * Get token with compiled regex pattern if it's a REGEX token
 */
export function getRegexPattern(token: Token): RegExp | undefined {
	return (token as Token & { pattern?: RegExp }).pattern;
}
