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
import type { ParseError, Result, SearchNode } from "./types";

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
 * Parse and compile a Scryfall search query
 *
 * Returns a Result with either a compiled search or a parse error.
 */
export function search(query: string): Result<CompiledSearch> {
	const parseResult = parse(query);

	if (!parseResult.ok) {
		return parseResult;
	}

	const ast = parseResult.value;
	const match = compile(ast);

	return {
		ok: true,
		value: { match, ast },
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

// Re-export types
export type { SearchNode, Result, ParseError, CardPredicate };
export type { CompiledSearch as SearchResult };

export { tokenize } from "./lexer";
export { compile } from "./matcher";
// Re-export parsing functions for advanced use
export { parse } from "./parser";
