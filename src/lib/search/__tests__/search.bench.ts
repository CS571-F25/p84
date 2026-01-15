/**
 * Benchmarks for search parsing
 *
 * Run with: npm run bench
 *
 * Tests the hot path for interactive search-as-you-type.
 */

import { bench, describe } from "vitest";
import { describeQuery, search } from "../index";
import { tokenize } from "../lexer";
import { parse } from "../parser";
import type { SearchNode } from "../types";

// Sample queries of varying complexity
const QUERIES = {
	simple: "lightning bolt",
	field: "t:creature",
	comparison: "mv<=3",
	multiField: "t:creature mv<=3 c:red",
	quoted: '"lightning bolt"',
	exact: '!"Lightning Bolt"',
	boolean: "t:creature OR t:instant",
	complex: 't:creature mv<=3 (c:red OR c:blue) -t:legendary o:"deal damage"',
	regex: "o:/deals? \\d+ damage/",
	realWorld: "t:creature mv<=2 id<=ug o:counter",
};

describe("tokenize (lexer)", () => {
	bench("simple name", () => {
		tokenize(QUERIES.simple);
	});

	bench("single field", () => {
		tokenize(QUERIES.field);
	});

	bench("multi-field query", () => {
		tokenize(QUERIES.multiField);
	});

	bench("complex boolean", () => {
		tokenize(QUERIES.complex);
	});

	bench("regex pattern", () => {
		tokenize(QUERIES.regex);
	});
});

describe("parse (lexer + parser)", () => {
	bench("simple name", () => {
		parse(QUERIES.simple);
	});

	bench("single field", () => {
		parse(QUERIES.field);
	});

	bench("multi-field query", () => {
		parse(QUERIES.multiField);
	});

	bench("complex boolean", () => {
		parse(QUERIES.complex);
	});

	bench("real-world query", () => {
		parse(QUERIES.realWorld);
	});
});

describe("search (full pipeline)", () => {
	bench("simple name", () => {
		search(QUERIES.simple);
	});

	bench("single field", () => {
		search(QUERIES.field);
	});

	bench("multi-field query", () => {
		search(QUERIES.multiField);
	});

	bench("complex boolean", () => {
		search(QUERIES.complex);
	});

	bench("real-world query", () => {
		search(QUERIES.realWorld);
	});
});

// Pre-parse ASTs for describe benchmarks
function getAst(query: string): SearchNode {
	const result = parse(query);
	if (!result.ok) throw new Error(`Failed to parse: ${query}`);
	return result.value;
}

const ASTS = {
	simple: getAst(QUERIES.simple),
	field: getAst(QUERIES.field),
	multiField: getAst(QUERIES.multiField),
	complex: getAst(QUERIES.complex),
	realWorld: getAst(QUERIES.realWorld),
};

describe("describeQuery (AST to text)", () => {
	bench("simple name", () => {
		describeQuery(ASTS.simple);
	});

	bench("single field", () => {
		describeQuery(ASTS.field);
	});

	bench("multi-field query", () => {
		describeQuery(ASTS.multiField);
	});

	bench("complex boolean", () => {
		describeQuery(ASTS.complex);
	});

	bench("real-world query", () => {
		describeQuery(ASTS.realWorld);
	});
});
