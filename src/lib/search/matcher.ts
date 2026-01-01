/**
 * AST to predicate compiler for Scryfall search
 *
 * Compiles a SearchNode AST into a function that tests cards.
 */

import { type CardPredicate, compileField } from "./fields";
import type { SearchNode } from "./types";

// Re-export CardPredicate for convenience
export type { CardPredicate };

/**
 * Compile an AST node into a card predicate function
 */
export function compile(node: SearchNode): CardPredicate {
	switch (node.type) {
		case "AND":
			return compileAnd(node.children);

		case "OR":
			return compileOr(node.children);

		case "NOT":
			return compileNot(node.child);

		case "FIELD":
			return compileField(node.field, node.operator, node.value);

		case "NAME":
			return compileName(node.value, node.pattern);

		case "EXACT_NAME":
			return compileExactName(node.value);
	}
}

/**
 * Compile AND node - all children must match
 */
function compileAnd(children: SearchNode[]): CardPredicate {
	const predicates = children.map(compile);
	return (card) => predicates.every((p) => p(card));
}

/**
 * Compile OR node - any child must match
 */
function compileOr(children: SearchNode[]): CardPredicate {
	const predicates = children.map(compile);
	return (card) => predicates.some((p) => p(card));
}

/**
 * Compile NOT node - child must not match
 */
function compileNot(child: SearchNode): CardPredicate {
	const predicate = compile(child);
	return (card) => !predicate(card);
}

/**
 * Compile name search - substring or regex match
 */
function compileName(value: string, pattern: RegExp | null): CardPredicate {
	if (pattern) {
		return (card) => {
			// Match against main name
			if (pattern.test(card.name)) return true;

			// Match against card face names for multi-face cards
			if (card.card_faces) {
				for (const face of card.card_faces) {
					if (pattern.test(face.name)) return true;
				}
			}

			return false;
		};
	}

	// Substring match (case-insensitive)
	const lower = value.toLowerCase();
	return (card) => {
		// Match against main name
		if (card.name.toLowerCase().includes(lower)) return true;

		// Match against card face names for multi-face cards
		if (card.card_faces) {
			for (const face of card.card_faces) {
				if (face.name.toLowerCase().includes(lower)) return true;
			}
		}

		return false;
	};
}

/**
 * Compile exact name match
 */
function compileExactName(value: string): CardPredicate {
	const lower = value.toLowerCase();
	return (card) => {
		// Match against main name exactly
		if (card.name.toLowerCase() === lower) return true;

		// Match against card face names for multi-face cards
		if (card.card_faces) {
			for (const face of card.card_faces) {
				if (face.name.toLowerCase() === lower) return true;
			}
		}

		return false;
	};
}
