import { describe, expect, it } from "vitest";
import {
	canFlip,
	getAllFaces,
	getCastableFaces,
	getFaceManaValue,
	getFlipBehavior,
	getPrimaryFace,
	hasBackImage,
	isMultiFaced,
	parseManaValue,
} from "../card-faces";
import type { Card, CardFace } from "../scryfall-types";

describe("parseManaValue", () => {
	describe("basic costs", () => {
		it("handles empty/undefined", () => {
			expect(parseManaValue(undefined)).toBe(0);
			expect(parseManaValue("")).toBe(0);
		});

		it("handles generic mana", () => {
			expect(parseManaValue("{1}")).toBe(1);
			expect(parseManaValue("{2}")).toBe(2);
			expect(parseManaValue("{10}")).toBe(10);
		});

		it("handles single colors", () => {
			expect(parseManaValue("{W}")).toBe(1);
			expect(parseManaValue("{U}")).toBe(1);
			expect(parseManaValue("{B}")).toBe(1);
			expect(parseManaValue("{R}")).toBe(1);
			expect(parseManaValue("{G}")).toBe(1);
		});

		it("handles colorless", () => {
			expect(parseManaValue("{C}")).toBe(1);
			expect(parseManaValue("{C}{C}")).toBe(2);
		});

		it("handles combined costs", () => {
			expect(parseManaValue("{2}{U}")).toBe(3);
			expect(parseManaValue("{1}{W}{W}")).toBe(3);
			expect(parseManaValue("{5}{B}{R}")).toBe(7);
			expect(parseManaValue("{W}{U}{B}{R}{G}")).toBe(5);
		});
	});

	describe("special costs", () => {
		it("handles X costs (count as 0)", () => {
			expect(parseManaValue("{X}")).toBe(0);
			expect(parseManaValue("{X}{G}{G}")).toBe(2);
			expect(parseManaValue("{X}{X}{R}")).toBe(1);
		});

		it("handles Y and Z costs", () => {
			expect(parseManaValue("{X}{Y}")).toBe(0);
			expect(parseManaValue("{X}{Y}{Z}")).toBe(0);
		});

		it("handles half mana (costs 0.5)", () => {
			expect(parseManaValue("{HW}")).toBe(0.5);
			expect(parseManaValue("{HR}")).toBe(0.5);
		});

		it("handles hybrid mana (costs 1)", () => {
			expect(parseManaValue("{W/U}")).toBe(1);
			expect(parseManaValue("{W/U}{W/U}")).toBe(2);
			expect(parseManaValue("{2}{W/B}{W/B}")).toBe(4);
		});

		it("handles phyrexian mana (costs 1)", () => {
			expect(parseManaValue("{W/P}")).toBe(1);
			expect(parseManaValue("{U/P}{U/P}")).toBe(2);
			expect(parseManaValue("{1}{G/P}")).toBe(2);
		});

		it("handles generic hybrid (2/W costs 2)", () => {
			expect(parseManaValue("{2/W}")).toBe(2);
			expect(parseManaValue("{2/U}{2/U}")).toBe(4);
			expect(parseManaValue("{2/W}{2/U}{2/B}{2/R}{2/G}")).toBe(10);
		});

		it("handles snow mana", () => {
			expect(parseManaValue("{S}")).toBe(1);
			expect(parseManaValue("{S}{S}{S}")).toBe(3);
			expect(parseManaValue("{2}{S}")).toBe(3);
		});
	});

	describe("real card costs", () => {
		const knownCosts: Array<[string, number]> = [
			["{0}", 0],
			["{3}", 3],
			["{1}{U}", 2],
			["{2}{U}{U}", 4],
			["{W}{W}{W}{W}", 4],
			["{X}{X}{G}", 1],
			["{2}{W/U}{W/U}", 4],
			["{B/P}{B/P}{B/P}{B/P}", 4],
		];

		for (const [cost, expected] of knownCosts) {
			it(`parses ${cost} as ${expected}`, () => {
				expect(parseManaValue(cost)).toBe(expected);
			});
		}
	});
});

describe("isMultiFaced", () => {
	it("returns false for single-faced card", () => {
		const card = { name: "Lightning Bolt" } as Card;
		expect(isMultiFaced(card)).toBe(false);
	});

	it("returns false for single face in array", () => {
		const card = {
			name: "Test",
			card_faces: [{ name: "Test", object: "card_face" }],
		} as Card;
		expect(isMultiFaced(card)).toBe(false);
	});

	it("returns true for two faces", () => {
		const card = {
			name: "Delver // Aberration",
			card_faces: [
				{ name: "Delver", object: "card_face" },
				{ name: "Aberration", object: "card_face" },
			],
		} as Card;
		expect(isMultiFaced(card)).toBe(true);
	});
});

describe("getPrimaryFace", () => {
	it("returns first face for multi-faced card", () => {
		const card = {
			name: "Valki // Tibalt",
			card_faces: [
				{ name: "Valki", mana_cost: "{1}{B}", object: "card_face" },
				{ name: "Tibalt", mana_cost: "{5}{B}{R}", object: "card_face" },
			],
		} as Card;
		const face = getPrimaryFace(card);
		expect(face.name).toBe("Valki");
		expect(face.mana_cost).toBe("{1}{B}");
	});

	it("returns synthetic face for single-faced card", () => {
		const card = {
			name: "Lightning Bolt",
			mana_cost: "{R}",
			type_line: "Instant",
		} as Card;
		const face = getPrimaryFace(card);
		expect(face.name).toBe("Lightning Bolt");
		expect(face.mana_cost).toBe("{R}");
		expect(face.type_line).toBe("Instant");
	});
});

describe("getCastableFaces", () => {
	it("returns both faces for modal_dfc", () => {
		const card = {
			name: "Valki // Tibalt",
			layout: "modal_dfc",
			card_faces: [
				{ name: "Valki", object: "card_face" },
				{ name: "Tibalt", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(2);
		expect(faces[0].name).toBe("Valki");
		expect(faces[1].name).toBe("Tibalt");
	});

	it("returns both faces for split", () => {
		const card = {
			name: "Fire // Ice",
			layout: "split",
			card_faces: [
				{ name: "Fire", object: "card_face" },
				{ name: "Ice", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(2);
	});

	it("returns both faces for adventure", () => {
		const card = {
			name: "Bonecrusher Giant",
			layout: "adventure",
			card_faces: [
				{ name: "Bonecrusher Giant", object: "card_face" },
				{ name: "Stomp", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(2);
	});

	it("returns only front face for transform", () => {
		const card = {
			name: "Delver of Secrets",
			layout: "transform",
			card_faces: [
				{ name: "Delver of Secrets", object: "card_face" },
				{ name: "Insectile Aberration", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(1);
		expect(faces[0].name).toBe("Delver of Secrets");
	});

	it("returns only front face for flip", () => {
		const card = {
			name: "Erayo, Soratami Ascendant",
			layout: "flip",
			card_faces: [
				{ name: "Erayo, Soratami Ascendant", object: "card_face" },
				{ name: "Erayo's Essence", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(1);
	});

	it("returns only front face for meld", () => {
		const card = {
			name: "Gisela, the Broken Blade",
			layout: "meld",
			card_faces: [
				{ name: "Gisela, the Broken Blade", object: "card_face" },
				{ name: "Brisela", object: "card_face" },
			],
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(1);
	});

	it("returns synthetic face for normal card", () => {
		const card = {
			name: "Lightning Bolt",
			layout: "normal",
			mana_cost: "{R}",
		} as Card;
		const faces = getCastableFaces(card);
		expect(faces).toHaveLength(1);
		expect(faces[0].name).toBe("Lightning Bolt");
	});
});

describe("getFlipBehavior", () => {
	it("returns transform for DFCs", () => {
		expect(getFlipBehavior("transform")).toBe("transform");
		expect(getFlipBehavior("modal_dfc")).toBe("transform");
		expect(getFlipBehavior("meld")).toBe("transform");
		expect(getFlipBehavior("reversible_card")).toBe("transform");
	});

	it("returns rotate90 for split", () => {
		expect(getFlipBehavior("split")).toBe("rotate90");
	});

	it("returns rotate180 for flip", () => {
		expect(getFlipBehavior("flip")).toBe("rotate180");
	});

	it("returns none for normal cards", () => {
		expect(getFlipBehavior("normal")).toBe("none");
		expect(getFlipBehavior("adventure")).toBe("none");
		expect(getFlipBehavior("saga")).toBe("none");
		expect(getFlipBehavior(undefined)).toBe("none");
	});
});

describe("canFlip", () => {
	it("returns true for flippable layouts", () => {
		expect(canFlip({ layout: "transform" } as Card)).toBe(true);
		expect(canFlip({ layout: "modal_dfc" } as Card)).toBe(true);
		expect(canFlip({ layout: "split" } as Card)).toBe(true);
		expect(canFlip({ layout: "flip" } as Card)).toBe(true);
	});

	it("returns false for non-flippable layouts", () => {
		expect(canFlip({ layout: "normal" } as Card)).toBe(false);
		expect(canFlip({ layout: "adventure" } as Card)).toBe(false);
		expect(canFlip({} as Card)).toBe(false);
	});
});

describe("hasBackImage", () => {
	it("returns true for DFC layouts", () => {
		expect(hasBackImage("transform")).toBe(true);
		expect(hasBackImage("modal_dfc")).toBe(true);
		expect(hasBackImage("meld")).toBe(true);
		expect(hasBackImage("reversible_card")).toBe(true);
	});

	it("returns false for single-image layouts", () => {
		expect(hasBackImage("normal")).toBe(false);
		expect(hasBackImage("split")).toBe(false);
		expect(hasBackImage("flip")).toBe(false);
		expect(hasBackImage("adventure")).toBe(false);
		expect(hasBackImage(undefined)).toBe(false);
	});
});

describe("getFaceManaValue", () => {
	it("uses card.cmc for primary face", () => {
		const card = { cmc: 5 } as Card;
		const face = { mana_cost: "{3}{U}{U}" } as CardFace;
		expect(getFaceManaValue(face, card, 0)).toBe(5);
	});

	it("parses mana_cost for secondary faces", () => {
		const card = { cmc: 2 } as Card;
		const face = { mana_cost: "{5}{B}{R}" } as CardFace;
		expect(getFaceManaValue(face, card, 1)).toBe(7);
	});

	it("parses mana_cost when card.cmc is undefined", () => {
		const card = {} as Card;
		const face = { mana_cost: "{2}{G}" } as CardFace;
		expect(getFaceManaValue(face, card, 0)).toBe(3);
	});
});
