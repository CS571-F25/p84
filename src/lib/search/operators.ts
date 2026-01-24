/**
 * Regex-based detection for search operator syntax.
 *
 * This is used BEFORE parsing to determine if a query should use
 * fuzzy name search or the full syntax parser. The goal is to be
 * conservative: only return true when there's clear intent to use
 * syntax operators.
 *
 * This avoids the "or dragon" problem where a typo for "ur dragon"
 * would be misinterpreted as an OR expression if we parsed first.
 */

import { FIELD_ALIASES } from "./types";

const FIELD_NAMES = Object.keys(FIELD_ALIASES);

const FIELD_PATTERN = new RegExp(
	`\\b(${FIELD_NAMES.join("|")})(:|=|!=|<=|>=|<|>)`,
	"i",
);

const EXPLICIT_AND = /\bAND\b/;
const EXPLICIT_OR = /\bOR\b/;
const EXACT_MATCH = /(^|[\s(])!/;
const NEGATION = /(^|[\s(])-\w/;
const QUOTES = /"/;
const PARENS = /[()]/;
const REGEX_LITERAL = /(?:^|\s)\/.+\//;

/**
 * Check if a query string contains search operators that indicate
 * it should be parsed with the syntax parser rather than fuzzy matched.
 *
 * Returns true for queries like:
 * - "t:creature" (field operator)
 * - "bolt AND shock" (explicit AND - case sensitive)
 * - "!Lightning Bolt" (exact match)
 * - "-blue" (negation)
 * - '"Lightning Bolt"' (quoted)
 * - "(red OR blue)" (grouping)
 * - "/goblin.*king/" (regex pattern)
 *
 * Returns false for simple name searches like:
 * - "lightning bolt"
 * - "or dragon" (lowercase "or" is NOT treated as operator)
 */
export function hasSearchOperators(query: string): boolean {
	return (
		FIELD_PATTERN.test(query) ||
		EXPLICIT_AND.test(query) ||
		EXPLICIT_OR.test(query) ||
		EXACT_MATCH.test(query) ||
		NEGATION.test(query) ||
		QUOTES.test(query) ||
		PARENS.test(query) ||
		REGEX_LITERAL.test(query)
	);
}
