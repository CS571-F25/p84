import { describe, expect, it } from "vitest";
import {
	compareColors,
	isStrictSubset,
	isStrictSuperset,
	isSubset,
	isSuperset,
	parseColors,
	setsEqual,
} from "../colors";

describe("set operations", () => {
	describe("isSubset", () => {
		it("empty set is subset of everything", () => {
			expect(isSubset(new Set(), new Set(["A", "B"]))).toBe(true);
		});

		it("set is subset of itself", () => {
			expect(isSubset(new Set(["A", "B"]), new Set(["A", "B"]))).toBe(true);
		});

		it("smaller set is subset of larger", () => {
			expect(isSubset(new Set(["A"]), new Set(["A", "B"]))).toBe(true);
		});

		it("larger set is not subset of smaller", () => {
			expect(isSubset(new Set(["A", "B"]), new Set(["A"]))).toBe(false);
		});

		it("disjoint sets are not subsets", () => {
			expect(isSubset(new Set(["A"]), new Set(["B"]))).toBe(false);
		});
	});

	describe("isSuperset", () => {
		it("everything is superset of empty set", () => {
			expect(isSuperset(new Set(["A", "B"]), new Set())).toBe(true);
		});

		it("set is superset of itself", () => {
			expect(isSuperset(new Set(["A", "B"]), new Set(["A", "B"]))).toBe(true);
		});

		it("larger set is superset of smaller", () => {
			expect(isSuperset(new Set(["A", "B"]), new Set(["A"]))).toBe(true);
		});
	});

	describe("setsEqual", () => {
		it("empty sets are equal", () => {
			expect(setsEqual(new Set(), new Set())).toBe(true);
		});

		it("same elements are equal", () => {
			expect(setsEqual(new Set(["A", "B"]), new Set(["B", "A"]))).toBe(true);
		});

		it("different sizes are not equal", () => {
			expect(setsEqual(new Set(["A"]), new Set(["A", "B"]))).toBe(false);
		});
	});

	describe("isStrictSubset", () => {
		it("set is not strict subset of itself", () => {
			expect(isStrictSubset(new Set(["A"]), new Set(["A"]))).toBe(false);
		});

		it("smaller set is strict subset", () => {
			expect(isStrictSubset(new Set(["A"]), new Set(["A", "B"]))).toBe(true);
		});
	});

	describe("isStrictSuperset", () => {
		it("set is not strict superset of itself", () => {
			expect(isStrictSuperset(new Set(["A"]), new Set(["A"]))).toBe(false);
		});

		it("larger set is strict superset", () => {
			expect(isStrictSuperset(new Set(["A", "B"]), new Set(["A"]))).toBe(true);
		});
	});
});

describe("parseColors", () => {
	it("parses single letters", () => {
		expect(parseColors("W")).toEqual(new Set(["W"]));
		expect(parseColors("u")).toEqual(new Set(["U"]));
		expect(parseColors("C")).toEqual(new Set(["C"]));
	});

	it("parses combined colors", () => {
		expect(parseColors("wubrg")).toEqual(new Set(["W", "U", "B", "R", "G"]));
		expect(parseColors("bg")).toEqual(new Set(["B", "G"]));
		expect(parseColors("UR")).toEqual(new Set(["U", "R"]));
	});

	it("parses full names", () => {
		expect(parseColors("white")).toEqual(new Set(["W"]));
		expect(parseColors("blue")).toEqual(new Set(["U"]));
		expect(parseColors("black")).toEqual(new Set(["B"]));
		expect(parseColors("red")).toEqual(new Set(["R"]));
		expect(parseColors("green")).toEqual(new Set(["G"]));
		expect(parseColors("colorless")).toEqual(new Set(["C"]));
	});

	it("ignores invalid characters", () => {
		expect(parseColors("wx")).toEqual(new Set(["W"]));
		expect(parseColors("123")).toEqual(new Set());
	});
});

describe("compareColors", () => {
	describe("commander deckbuilding (id<=)", () => {
		it("colorless card fits in any deck", () => {
			expect(compareColors([], new Set(["B", "G"]), "<=")).toBe(true);
		});

		it("mono-color fits in matching deck", () => {
			expect(compareColors(["G"], new Set(["B", "G"]), "<=")).toBe(true);
		});

		it("exact match fits", () => {
			expect(compareColors(["B", "G"], new Set(["B", "G"]), "<=")).toBe(true);
		});

		it("off-color doesn't fit", () => {
			expect(compareColors(["R"], new Set(["B", "G"]), "<=")).toBe(false);
		});

		it("more colors doesn't fit", () => {
			expect(compareColors(["B", "G", "U"], new Set(["B", "G"]), "<=")).toBe(
				false,
			);
		});
	});

	describe("superset (: and >=)", () => {
		it(": matches superset", () => {
			expect(compareColors(["U", "R", "G"], new Set(["U", "R"]), ":")).toBe(
				true,
			);
		});

		it(">= matches superset", () => {
			expect(compareColors(["U", "R", "G"], new Set(["U", "R"]), ">=")).toBe(
				true,
			);
		});

		it("exact match is superset", () => {
			expect(compareColors(["U", "R"], new Set(["U", "R"]), ":")).toBe(true);
		});

		it("subset doesn't match superset", () => {
			expect(compareColors(["U"], new Set(["U", "R"]), ":")).toBe(false);
		});
	});

	describe("exact match (=)", () => {
		it("matches exact colors", () => {
			expect(compareColors(["U", "R"], new Set(["U", "R"]), "=")).toBe(true);
		});

		it("doesn't match with extra color", () => {
			expect(compareColors(["U", "R", "G"], new Set(["U", "R"]), "=")).toBe(
				false,
			);
		});

		it("doesn't match with missing color", () => {
			expect(compareColors(["U"], new Set(["U", "R"]), "=")).toBe(false);
		});
	});

	describe("not equal (!=)", () => {
		it("matches different colors", () => {
			expect(compareColors(["U"], new Set(["U", "R"]), "!=")).toBe(true);
		});

		it("doesn't match exact colors", () => {
			expect(compareColors(["U", "R"], new Set(["U", "R"]), "!=")).toBe(false);
		});
	});

	describe("strict subset (<)", () => {
		it("matches strict subset", () => {
			expect(compareColors(["U"], new Set(["U", "R"]), "<")).toBe(true);
		});

		it("doesn't match equal sets", () => {
			expect(compareColors(["U", "R"], new Set(["U", "R"]), "<")).toBe(false);
		});
	});

	describe("strict superset (>)", () => {
		it("matches strict superset", () => {
			expect(compareColors(["U", "R", "G"], new Set(["U", "R"]), ">")).toBe(
				true,
			);
		});

		it("doesn't match equal sets", () => {
			expect(compareColors(["U", "R"], new Set(["U", "R"]), ">")).toBe(false);
		});
	});

	describe("undefined card colors", () => {
		it("treats undefined as empty", () => {
			expect(compareColors(undefined, new Set(["U"]), "<=")).toBe(true);
			expect(compareColors(undefined, new Set(), "=")).toBe(true);
		});
	});
});
