/**
 * Scryfall search syntax parser and matcher
 *
 * Usage:
 *   import { search } from "@/lib/search";
 *
 *   const result = search("t:creature cmc<=3 id<=bg");
 *   if (result.ok) {
 *     const matches = cards.filter(result.value.match);
 *   }
 */

import type { Card } from "../scryfall-types";
import { type CardPredicate, compile } from "./matcher";
import { parse } from "./parser";
import type { CompileError, ParseError, Result, SearchNode } from "./types";

/**
 * Compiled search query
 */
export interface CompiledSearch {
	/** Test if a card matches the query */
	match: CardPredicate;
	/** The parsed AST */
	ast: SearchNode;
}

/**
 * Search error - either a parse error or a compile error
 */
export type SearchError = ParseError | CompileError;

/**
 * Parse and compile a Scryfall search query
 *
 * Returns a Result with either a compiled search or a parse/compile error.
 */
export function search(query: string): Result<CompiledSearch, SearchError> {
	const parseResult = parse(query);

	if (!parseResult.ok) {
		return parseResult;
	}

	const ast = parseResult.value;
	const compileResult = compile(ast);

	if (!compileResult.ok) {
		return compileResult;
	}

	return {
		ok: true,
		value: { match: compileResult.value, ast },
	};
}

/**
 * Filter an array of cards using a Scryfall search query
 *
 * Returns matching cards, or empty array if query is invalid.
 */
export function filterCards(
	cards: Card[],
	query: string,
	maxResults?: number,
): Card[] {
	const result = search(query);

	if (!result.ok) {
		return [];
	}

	const matches: Card[] = [];
	for (const card of cards) {
		if (result.value.match(card)) {
			matches.push(card);
			if (maxResults && matches.length >= maxResults) {
				break;
			}
		}
	}

	return matches;
}

/**
 * Check if any node in the AST matches the predicate (like Array.some for AST)
 */
export function someNode(
	node: SearchNode,
	predicate: (node: SearchNode) => boolean,
): boolean {
	if (predicate(node)) return true;

	switch (node.type) {
		case "AND":
		case "OR":
			return node.children.some((child) => someNode(child, predicate));
		case "NOT":
			return someNode(node.child, predicate);
		default:
			return false;
	}
}

// Re-export types
export type { SearchNode, Result, ParseError, CompileError, CardPredicate };
export type { CompiledSearch as SearchResult };

export { describeQuery } from "./describe";
export { IS_PREDICATE_NAMES } from "./fields";
export { tokenize } from "./lexer";
export { compile } from "./matcher";

// Operator detection and query description
export { hasSearchOperators } from "./operators";
// Re-export parsing functions for advanced use
export { parse } from "./parser";
