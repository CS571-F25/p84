/**
 * Recursive descent parser for Scryfall search syntax
 *
 * Grammar:
 *   query     = or_expr
 *   or_expr   = and_expr ("OR" and_expr)*
 *   and_expr  = unary_expr+
 *   unary_expr = "-" unary_expr | primary
 *   primary   = "(" or_expr ")" | field_expr | name_expr
 *   field_expr = WORD operator value
 *   name_expr = EXACT_NAME | WORD | QUOTED | REGEX
 */

import { getRegexPattern, tokenize } from "./lexer";
import {
	type AndNode,
	type ComparisonOp,
	type ExactNameNode,
	err,
	FIELD_ALIASES,
	type FieldName,
	type FieldNode,
	type FieldValue,
	type NameNode,
	type NotNode,
	type OrNode,
	ok,
	type ParseError,
	type Result,
	type SearchNode,
	type Span,
	type Token,
	type TokenType,
} from "./types";

/**
 * Parser class encapsulates parsing state
 */
class Parser {
	private tokens: Token[];
	private pos: number = 0;
	private input: string;

	constructor(tokens: Token[], input: string) {
		this.tokens = tokens;
		this.input = input;
	}

	private peek(): Token {
		return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
	}

	private previous(): Token {
		return this.tokens[this.pos - 1];
	}

	private isAtEnd(): boolean {
		return this.peek().type === "EOF";
	}

	private check(type: TokenType): boolean {
		return this.peek().type === type;
	}

	private advance(): Token {
		if (!this.isAtEnd()) {
			this.pos++;
		}
		return this.previous();
	}

	/**
	 * Match token type and advance if found.
	 * WARNING: This consumes the token. For speculative parsing,
	 * save pos before and restore on failure.
	 */
	private match(...types: TokenType[]): boolean {
		for (const type of types) {
			if (this.check(type)) {
				this.advance();
				return true;
			}
		}
		return false;
	}

	private makeError(message: string, span?: Span): ParseError {
		return {
			message,
			span: span ?? this.peek().span,
			input: this.input,
		};
	}

	/**
	 * Parse the token stream into an AST
	 */
	parse(): Result<SearchNode> {
		if (this.isAtEnd()) {
			return err(this.makeError("Empty query"));
		}

		const result = this.parseOrExpr();
		if (!result.ok) return result;

		if (!this.isAtEnd()) {
			return err(this.makeError(`Unexpected token: ${this.peek().value}`));
		}

		return result;
	}

	/**
	 * or_expr = and_expr ("OR" and_expr)*
	 */
	private parseOrExpr(): Result<SearchNode> {
		const firstResult = this.parseAndExpr();
		if (!firstResult.ok) return firstResult;

		const children: SearchNode[] = [firstResult.value];
		const startSpan = firstResult.value.span;

		while (this.match("OR")) {
			const nextResult = this.parseAndExpr();
			if (!nextResult.ok) return nextResult;
			children.push(nextResult.value);
		}

		if (children.length === 1) {
			return ok(children[0]);
		}

		const endSpan = children[children.length - 1].span;
		const node: OrNode = {
			type: "OR",
			children,
			span: { start: startSpan.start, end: endSpan.end },
		};
		return ok(node);
	}

	/**
	 * and_expr = unary_expr+
	 */
	private parseAndExpr(): Result<SearchNode> {
		const children: SearchNode[] = [];

		while (!this.isAtEnd() && !this.check("OR") && !this.check("RPAREN")) {
			const result = this.parseUnaryExpr();
			if (!result.ok) return result;
			children.push(result.value);
		}

		if (children.length === 0) {
			return err(this.makeError("Expected expression"));
		}

		if (children.length === 1) {
			return ok(children[0]);
		}

		const node: AndNode = {
			type: "AND",
			children,
			span: {
				start: children[0].span.start,
				end: children[children.length - 1].span.end,
			},
		};
		return ok(node);
	}

	/**
	 * unary_expr = "-" unary_expr | primary
	 */
	private parseUnaryExpr(): Result<SearchNode> {
		if (this.match("NOT")) {
			const notToken = this.previous();
			const result = this.parseUnaryExpr();
			if (!result.ok) return result;

			const node: NotNode = {
				type: "NOT",
				child: result.value,
				span: { start: notToken.span.start, end: result.value.span.end },
			};
			return ok(node);
		}

		return this.parsePrimary();
	}

	/**
	 * primary = "(" or_expr ")" | field_expr | name_expr
	 */
	private parsePrimary(): Result<SearchNode> {
		// Grouped expression
		if (this.match("LPAREN")) {
			const openParen = this.previous();
			const result = this.parseOrExpr();
			if (!result.ok) return result;

			if (!this.match("RPAREN")) {
				return err(
					this.makeError("Expected closing parenthesis", openParen.span),
				);
			}

			// Update span to include parens
			result.value.span = {
				start: openParen.span.start,
				end: this.previous().span.end,
			};
			return ok(result.value);
		}

		// Try field expression first (with backtracking)
		const savepoint = this.pos;
		const fieldResult = this.tryParseFieldExpr();
		if (fieldResult) {
			return fieldResult;
		}
		this.pos = savepoint; // Restore on failure

		// Name expression
		return this.parseNameExpr();
	}

	/**
	 * Check if token type is a comparison operator
	 */
	private isOperator(type: TokenType): boolean {
		return (
			type === "COLON" ||
			type === "EQUALS" ||
			type === "NOT_EQUALS" ||
			type === "LT" ||
			type === "GT" ||
			type === "LTE" ||
			type === "GTE"
		);
	}

	/**
	 * Try to parse a field expression, returning null if not a field expr.
	 * Caller must save/restore pos on null return.
	 */
	private tryParseFieldExpr(): Result<FieldNode> | null {
		if (!this.check("WORD")) {
			return null;
		}

		const fieldToken = this.peek();
		const fieldName = FIELD_ALIASES[fieldToken.value.toLowerCase()];

		if (!fieldName) {
			return null;
		}

		// Check if followed by operator (lookahead)
		const nextToken = this.tokens[this.pos + 1];
		if (!nextToken || !this.isOperator(nextToken.type)) {
			return null;
		}

		// Commit to parsing field expression
		this.advance(); // consume field name
		const opToken = this.advance(); // consume operator
		const operator = this.tokenToOperator(opToken.type);

		const valueResult = this.parseFieldValue(fieldName);
		if (!valueResult.ok) {
			// Return the error - caller will restore pos
			return valueResult as Result<FieldNode>;
		}

		const node: FieldNode = {
			type: "FIELD",
			field: fieldName,
			operator,
			value: valueResult.value,
			span: {
				start: fieldToken.span.start,
				end: this.previous().span.end,
			},
		};
		return ok(node);
	}

	/**
	 * Convert token type to comparison operator
	 */
	private tokenToOperator(type: TokenType): ComparisonOp {
		switch (type) {
			case "COLON":
				return ":";
			case "EQUALS":
				return "=";
			case "NOT_EQUALS":
				return "!=";
			case "LT":
				return "<";
			case "GT":
				return ">";
			case "LTE":
				return "<=";
			case "GTE":
				return ">=";
			default:
				return ":";
		}
	}

	/**
	 * Parse field value based on field type
	 */
	private parseFieldValue(field: FieldName): Result<FieldValue> {
		// Regex value
		if (this.match("REGEX")) {
			const pattern = getRegexPattern(this.previous());
			if (!pattern) {
				return err(
					this.makeError("Invalid regex pattern", this.previous().span),
				);
			}
			return ok({
				kind: "regex",
				pattern,
				source: this.previous().value,
			});
		}

		// Quoted string
		if (this.match("QUOTED")) {
			return ok({ kind: "string", value: this.previous().value });
		}

		// Negative number: NOT followed by WORD that looks numeric
		if (
			this.check("NOT") &&
			this.isNumericField(field) &&
			this.pos + 1 < this.tokens.length &&
			this.tokens[this.pos + 1].type === "WORD"
		) {
			const nextValue = this.tokens[this.pos + 1].value;
			const num = parseFloat(nextValue);
			if (!Number.isNaN(num)) {
				this.advance(); // consume NOT
				this.advance(); // consume WORD
				return ok({ kind: "number", value: -num });
			}
		}

		// Word value
		if (this.match("WORD")) {
			const value = this.previous().value;

			// For color fields, parse as colors - but color/identity can also take numeric values
			// for counting colors (c>1 or id>1 = "more than 1 color")
			if (field === "color" || field === "identity") {
				// Check if value is purely numeric (for count queries like c>1, id>1)
				if (/^\d+$/.test(value)) {
					const num = parseInt(value, 10);
					return ok({ kind: "number", value: num });
				}
				return ok({
					kind: "colors",
					colors: this.parseColors(value),
				});
			}

			// For numeric fields, try to parse as number
			if (this.isNumericField(field)) {
				const num = parseFloat(value);
				if (!Number.isNaN(num)) {
					return ok({ kind: "number", value: num });
				}
				// Could be * for power/toughness
				if (value === "*") {
					return ok({ kind: "string", value: "*" });
				}
			}

			return ok({ kind: "string", value });
		}

		return err(this.makeError("Expected field value"));
	}

	/**
	 * Check if field expects numeric values
	 */
	private isNumericField(field: FieldName): boolean {
		return (
			field === "manavalue" ||
			field === "power" ||
			field === "toughness" ||
			field === "loyalty" ||
			field === "defense" ||
			field === "year"
		);
	}

	/**
	 * Parse color string into color set
	 */
	private parseColors(input: string): Set<string> {
		const colors = new Set<string>();
		const upper = input.toUpperCase();

		for (const char of upper) {
			if ("WUBRGC".includes(char)) {
				colors.add(char);
			}
		}

		// Handle full names and aliases
		const lower = input.toLowerCase();
		if (lower.includes("white")) colors.add("W");
		if (lower.includes("blue")) colors.add("U");
		if (lower.includes("black")) colors.add("B");
		if (lower.includes("red")) colors.add("R");
		if (lower.includes("green")) colors.add("G");
		if (lower.includes("colorless")) colors.add("C");

		return colors;
	}

	/**
	 * name_expr = EXACT_NAME | WORD | QUOTED | REGEX
	 */
	private parseNameExpr(): Result<SearchNode> {
		const token = this.peek();

		// Exact name match
		if (this.match("EXACT_NAME")) {
			const node: ExactNameNode = {
				type: "EXACT_NAME",
				value: this.previous().value,
				span: this.previous().span,
			};
			return ok(node);
		}

		// Regex match
		if (this.match("REGEX")) {
			const prevToken = this.previous();
			const pattern = getRegexPattern(prevToken);
			const node: NameNode = {
				type: "NAME",
				value: prevToken.value,
				pattern: pattern ?? null,
				span: prevToken.span,
			};
			return ok(node);
		}

		// Quoted string match
		if (this.match("QUOTED")) {
			const node: NameNode = {
				type: "NAME",
				value: this.previous().value,
				pattern: null,
				span: this.previous().span,
			};
			return ok(node);
		}

		// Word match
		if (this.match("WORD")) {
			const node: NameNode = {
				type: "NAME",
				value: this.previous().value,
				pattern: null,
				span: this.previous().span,
			};
			return ok(node);
		}

		return err(this.makeError(`Unexpected token: ${token.value}`));
	}
}

/**
 * Parse a search query string into an AST
 */
export function parse(input: string): Result<SearchNode> {
	const tokenResult = tokenize(input);
	if (!tokenResult.ok) return tokenResult;

	const parser = new Parser(tokenResult.value, input);
	return parser.parse();
}
