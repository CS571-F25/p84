/**
 * Type definitions for Scryfall search syntax parser
 */

/**
 * Span tracks position in input for error reporting
 */
export interface Span {
	start: number;
	end: number;
}

/**
 * Token types produced by the lexer
 */
export type TokenType =
	// Structural
	| "LPAREN"
	| "RPAREN"
	| "OR"
	| "NOT"
	// Operators
	| "COLON"
	| "EQUALS"
	| "NOT_EQUALS"
	| "LT"
	| "GT"
	| "LTE"
	| "GTE"
	// Values
	| "WORD"
	| "QUOTED"
	| "REGEX"
	| "EXACT_NAME"
	// End
	| "EOF";

/**
 * Token with position tracking
 */
export interface Token {
	type: TokenType;
	value: string;
	span: Span;
}

/**
 * Comparison operators
 */
export type ComparisonOp = ":" | "=" | "!=" | "<" | ">" | "<=" | ">=";

/**
 * Field value variants
 */
export type FieldValue =
	| { kind: "string"; value: string }
	| { kind: "number"; value: number }
	| { kind: "regex"; pattern: RegExp; source: string }
	| { kind: "colors"; colors: Set<string> };

/**
 * Known field names (canonical forms)
 */
export type FieldName =
	// Text fields
	| "name"
	| "type"
	| "oracle"
	// Color fields
	| "color"
	| "identity"
	// Mana
	| "mana"
	| "manavalue"
	// Stats
	| "power"
	| "toughness"
	| "loyalty"
	| "defense"
	// Keywords
	| "keyword"
	// Set/printing
	| "set"
	| "settype"
	| "layout"
	| "frame"
	| "border"
	| "number"
	| "rarity"
	| "artist"
	// Legality
	| "format"
	| "banned"
	| "restricted"
	// Misc
	| "game"
	| "in"
	| "produces"
	| "year"
	| "date"
	| "lang"
	// Boolean
	| "is"
	| "not";

/**
 * Fields where ':' means exact match (is) rather than substring (includes).
 * These are discrete/enumerated values, not free-form text.
 */
export const DISCRETE_FIELDS: ReadonlySet<FieldName> = new Set([
	"set",
	"settype",
	"layout",
	"frame",
	"border",
	"rarity",
	"game",
	"in",
	"lang",
	"format",
	"banned",
	"restricted",
]);

/**
 * Map of field aliases to canonical names
 */
export const FIELD_ALIASES: Record<string, FieldName> = {
	// Text
	name: "name",
	n: "name",
	t: "type",
	type: "type",
	o: "oracle",
	oracle: "oracle",
	// Colors
	c: "color",
	color: "color",
	id: "identity",
	identity: "identity",
	// Mana
	m: "mana",
	mana: "mana",
	mv: "manavalue",
	manavalue: "manavalue",
	cmc: "manavalue",
	// Stats
	pow: "power",
	power: "power",
	tou: "toughness",
	toughness: "toughness",
	loy: "loyalty",
	loyalty: "loyalty",
	def: "defense",
	defense: "defense",
	// Keywords
	kw: "keyword",
	keyword: "keyword",
	// Set/printing
	s: "set",
	e: "set",
	set: "set",
	edition: "set",
	st: "settype",
	settype: "settype",
	layout: "layout",
	frame: "frame",
	border: "border",
	cn: "number",
	number: "number",
	r: "rarity",
	rarity: "rarity",
	a: "artist",
	artist: "artist",
	// Legality
	f: "format",
	format: "format",
	banned: "banned",
	restricted: "restricted",
	// Misc
	game: "game",
	in: "in",
	produces: "produces",
	year: "year",
	date: "date",
	lang: "lang",
	language: "lang",
	// Boolean
	is: "is",
	not: "not",
};

/**
 * Base interface for AST nodes with span
 */
interface BaseNode {
	span: Span;
}

/**
 * AND node - all children must match (implicit between terms)
 */
export interface AndNode extends BaseNode {
	type: "AND";
	children: SearchNode[];
}

/**
 * OR node - any child must match
 */
export interface OrNode extends BaseNode {
	type: "OR";
	children: SearchNode[];
}

/**
 * NOT node - child must not match
 */
export interface NotNode extends BaseNode {
	type: "NOT";
	child: SearchNode;
}

/**
 * Field comparison node (t:creature, cmc>3, etc.)
 */
export interface FieldNode extends BaseNode {
	type: "FIELD";
	field: FieldName;
	operator: ComparisonOp;
	value: FieldValue;
}

/**
 * Bare name search - string or regex match against card name
 */
export interface NameNode extends BaseNode {
	type: "NAME";
	value: string;
	pattern: RegExp | null;
}

/**
 * Exact name match (!Lightning Bolt)
 */
export interface ExactNameNode extends BaseNode {
	type: "EXACT_NAME";
	value: string;
}

/**
 * Union of all AST node types
 */
export type SearchNode =
	| AndNode
	| OrNode
	| NotNode
	| FieldNode
	| NameNode
	| ExactNameNode;

/**
 * Parse error with location info
 */
export interface ParseError {
	message: string;
	span: Span;
	input: string;
}

/**
 * Result type for fallible operations
 */
export type Result<T, E = ParseError> =
	| { ok: true; value: T }
	| { ok: false; error: E };

/**
 * Helper to create success result
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Helper to create error result
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}
