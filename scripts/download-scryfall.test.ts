import { describe, expect, it } from "vitest";
import type { Card } from "../src/lib/scryfall-types.ts";
import { asOracleId, asScryfallId } from "../src/lib/scryfall-types.ts";
import { compareCards, isDefaultPrinting } from "./download-scryfall.ts";

type TestCard = Card & { security_stamp?: string; [key: string]: unknown };

function createCard(overrides: Partial<TestCard>): TestCard {
	return {
		id: asScryfallId("00000000-0000-0000-0000-000000000000"),
		oracle_id: asOracleId("00000000-0000-0000-0000-000000000000"),
		name: "Test Card",
		lang: "en",
		frame: "2015",
		border_color: "black",
		released_at: "2020-01-01",
		...overrides,
	};
}

describe("isDefaultPrinting", () => {
	it("accepts traditional frames", () => {
		expect(isDefaultPrinting(createCard({ frame: "1993" }))).toBe(true);
		expect(isDefaultPrinting(createCard({ frame: "1997" }))).toBe(true);
		expect(isDefaultPrinting(createCard({ frame: "2003" }))).toBe(true);
		expect(isDefaultPrinting(createCard({ frame: "2015" }))).toBe(true);
	});

	it("rejects non-traditional frames", () => {
		expect(isDefaultPrinting(createCard({ frame: "future" }))).toBe(false);
	});

	it("accepts valid borders", () => {
		expect(isDefaultPrinting(createCard({ border_color: "black" }))).toBe(true);
		expect(isDefaultPrinting(createCard({ border_color: "white" }))).toBe(true);
		expect(isDefaultPrinting(createCard({ border_color: "silver" }))).toBe(
			true,
		);
	});

	it("rejects borderless", () => {
		expect(isDefaultPrinting(createCard({ border_color: "borderless" }))).toBe(
			false,
		);
	});

	it("rejects special frame effects", () => {
		expect(
			isDefaultPrinting(createCard({ frame_effects: ["extendedart"] })),
		).toBe(false);
		expect(isDefaultPrinting(createCard({ frame_effects: ["showcase"] }))).toBe(
			false,
		);
		expect(isDefaultPrinting(createCard({ frame_effects: ["inverted"] }))).toBe(
			false,
		);
	});

	it("rejects full art", () => {
		expect(isDefaultPrinting(createCard({ full_art: true }))).toBe(false);
	});

	it("accepts valid finishes", () => {
		expect(isDefaultPrinting(createCard({ finishes: ["nonfoil"] }))).toBe(true);
		expect(isDefaultPrinting(createCard({ finishes: ["foil"] }))).toBe(true);
		expect(
			isDefaultPrinting(createCard({ finishes: ["nonfoil", "foil"] })),
		).toBe(true);
	});

	it("rejects cards with only special finishes", () => {
		expect(isDefaultPrinting(createCard({ finishes: ["etched"] }))).toBe(false);
	});

	it("rejects special promo types (serialized, doublerainbow, etc)", () => {
		expect(isDefaultPrinting(createCard({ promo_types: ["serialized"] }))).toBe(
			false,
		);
		expect(
			isDefaultPrinting(
				createCard({ promo_types: ["serialized", "doublerainbow"] }),
			),
		).toBe(false);
		expect(isDefaultPrinting(createCard({ promo_types: ["gilded"] }))).toBe(
			false,
		);
		expect(
			isDefaultPrinting(createCard({ promo_types: ["confettifoil"] })),
		).toBe(false);
		expect(isDefaultPrinting(createCard({ promo_types: ["galaxyfoil"] }))).toBe(
			false,
		);
		expect(isDefaultPrinting(createCard({ promo_types: ["textured"] }))).toBe(
			false,
		);
	});

	it("allows neutral promo types (prerelease, buyabox)", () => {
		expect(isDefaultPrinting(createCard({ promo_types: ["prerelease"] }))).toBe(
			true,
		);
		expect(isDefaultPrinting(createCard({ promo_types: ["buyabox"] }))).toBe(
			true,
		);
	});
});

describe("compareCards canonical printing selection", () => {
	it("prefers english over other languages", () => {
		const english = createCard({ lang: "en" });
		const japanese = createCard({ lang: "ja" });
		expect(compareCards(english, japanese)).toBe(-1);
		expect(compareCards(japanese, english)).toBe(1);
	});

	it("prefers is:default over non-default", () => {
		const defaultCard = createCard({
			frame: "2015",
			border_color: "black",
		});
		const showcase = createCard({
			frame: "2015",
			border_color: "black",
			frame_effects: ["showcase"],
		});
		expect(compareCards(defaultCard, showcase)).toBe(-1);
		expect(compareCards(showcase, defaultCard)).toBe(1);
	});

	it("prefers newer within same default status and paper/highres", () => {
		const newer = createCard({
			released_at: "2024-01-01",
			games: ["paper"],
			highres_image: true,
		});
		const older = createCard({
			released_at: "2020-01-01",
			games: ["paper"],
			highres_image: true,
		});
		expect(compareCards(newer, older)).toBe(-1);
		expect(compareCards(older, newer)).toBe(1);
	});

	it("prefers newest default over newest non-default", () => {
		const oldDefault = createCard({
			released_at: "2020-01-01",
			frame: "2015",
			border_color: "black",
		});
		const newShowcase = createCard({
			released_at: "2024-01-01",
			frame: "2015",
			border_color: "black",
			frame_effects: ["showcase"],
		});
		expect(compareCards(oldDefault, newShowcase)).toBe(-1);
	});

	it("does not discriminate against UB for is:default status", () => {
		const ubDefault = createCard({
			promo_types: ["universesbeyond"],
			frame: "2015",
			border_color: "black",
		});
		expect(isDefaultPrinting(ubDefault)).toBe(true);
	});

	it("prefers non-UB over UB (by promo_types)", () => {
		const nonUB = createCard({
			released_at: "2024-01-01",
			games: ["paper"],
		});
		const ub = createCard({
			released_at: "2024-01-01",
			games: ["paper"],
			promo_types: ["universesbeyond"],
		});
		expect(compareCards(nonUB, ub)).toBe(-1);
		expect(compareCards(ub, nonUB)).toBe(1);
	});

	it("prefers non-UB over UB (by security_stamp triangle)", () => {
		const nonUB = createCard({
			released_at: "2024-01-01",
			games: ["paper"],
		});
		const ub = createCard({
			released_at: "2024-01-01",
			games: ["paper"],
			security_stamp: "triangle",
		});
		expect(compareCards(nonUB, ub)).toBe(-1);
		expect(compareCards(ub, nonUB)).toBe(1);
	});

	it("deprioritizes The List (plst) printings", () => {
		const normal = createCard({
			set: "ddj",
			released_at: "2012-01-01",
			games: ["paper"],
		});
		const theList = createCard({
			set: "plst",
			released_at: "2024-01-01",
			games: ["paper"],
		});
		expect(compareCards(normal, theList)).toBe(-1);
		expect(compareCards(theList, normal)).toBe(1);
	});

	it("deprioritizes Secret Lair (sld) printings", () => {
		const normal = createCard({
			set: "m21",
			released_at: "2020-01-01",
			games: ["paper"],
		});
		const secretLair = createCard({
			set: "sld",
			released_at: "2024-01-01",
			games: ["paper"],
		});
		expect(compareCards(normal, secretLair)).toBe(-1);
		expect(compareCards(secretLair, normal)).toBe(1);
	});

	it("deprioritizes arena-only (paper and mtgo are fine)", () => {
		const paper = createCard({
			released_at: "2020-01-01",
			games: ["paper"],
		});
		const mtgo = createCard({
			released_at: "2020-01-01",
			games: ["mtgo"],
		});
		const arenaOnly = createCard({
			released_at: "2024-01-01",
			games: ["arena"],
		});
		// Both paper and MTGO beat arena-only
		expect(compareCards(paper, arenaOnly)).toBe(-1);
		expect(compareCards(mtgo, arenaOnly)).toBe(-1);
		expect(compareCards(arenaOnly, paper)).toBe(1);
		// Paper wins over MTGO as final tiebreaker
		expect(compareCards(paper, mtgo)).toBe(-1);
		expect(compareCards(mtgo, paper)).toBe(1);
	});

	it("prefers highres images over newer date", () => {
		const olderHighres = createCard({
			released_at: "2020-01-01",
			highres_image: true,
		});
		const newerLowres = createCard({
			released_at: "2024-01-01",
			highres_image: false,
		});
		expect(compareCards(olderHighres, newerLowres)).toBe(-1);
		expect(compareCards(newerLowres, olderHighres)).toBe(1);
	});

	it("prefers highres images when both are same date", () => {
		const highres = createCard({
			released_at: "2024-01-01",
			highres_image: true,
		});
		const lowres = createCard({
			released_at: "2024-01-01",
			highres_image: false,
		});
		expect(compareCards(highres, lowres)).toBe(-1);
	});

	it("prefers non-variants", () => {
		const normal = createCard({
			released_at: "2024-01-01",
			variation: false,
		});
		const variant = createCard({
			released_at: "2024-01-01",
			variation: true,
		});
		expect(compareCards(normal, variant)).toBe(-1);
	});

	it("prefers paper over arena-only even if arena is newer (regression test)", () => {
		// Arena-only printings should lose to paper/mtgo
		const newerArena = createCard({
			id: asScryfallId("5e3f2736-9d13-44e3-a4bf-4f64314e5848"),
			name: "Test Card",
			set: "aa3",
			released_at: "2025-01-01",
			games: ["arena"],
			frame: "2015",
			border_color: "black",
		});
		const olderPaper = createCard({
			id: asScryfallId("7da8e543-c9ef-4f2d-99e4-ef6ba496ae75"),
			name: "Test Card",
			set: "afr",
			released_at: "2021-07-23",
			games: ["arena", "paper", "mtgo"],
			frame: "2015",
			border_color: "black",
		});

		expect(compareCards(olderPaper, newerArena)).toBe(-1);
	});

	it("prefers normal card over serialized promo (regression test)", () => {
		// Real-world bug: Goblin Charbelcher was choosing serialized doublerainbow over normal
		const serialized = createCard({
			id: asScryfallId("6e726e71-b9cc-421a-9f0d-22e321e88610"),
			name: "Goblin Charbelcher",
			set: "brr",
			released_at: "2022-11-18",
			games: ["paper"],
			frame: "1997",
			border_color: "black",
			promo_types: ["serialized", "doublerainbow"],
			finishes: ["foil"],
		});
		const normal = createCard({
			id: asScryfallId("7f945594-2f11-471c-b992-1b70d82c8164"),
			name: "Goblin Charbelcher",
			set: "brr",
			released_at: "2022-11-18",
			games: ["paper", "mtgo", "arena"],
			frame: "1997",
			border_color: "black",
			promo_types: [],
			finishes: ["nonfoil", "foil"],
		});

		// Serialized should NOT be is:default
		expect(isDefaultPrinting(serialized)).toBe(false);
		expect(isDefaultPrinting(normal)).toBe(true);

		// Normal should win
		expect(compareCards(normal, serialized)).toBe(-1);
	});

	it("correctly prioritizes: english > is:default > paper > highres > non-UB > frame > newer", () => {
		const cards = [
			createCard({
				id: asScryfallId("00000000-0000-0000-0000-000000000001"),
				lang: "en",
				frame: "2015",
				border_color: "black",
				games: ["paper"],
				highres_image: false,
				released_at: "2024-01-01",
			}),
			createCard({
				id: asScryfallId("00000000-0000-0000-0000-000000000002"),
				lang: "en",
				frame: "2015",
				border_color: "black",
				games: ["arena"],
				highres_image: true,
				released_at: "2025-01-01",
			}),
			createCard({
				id: asScryfallId("00000000-0000-0000-0000-000000000003"),
				lang: "en",
				frame: "2015",
				border_color: "black",
				games: ["paper"],
				highres_image: true,
				released_at: "2020-01-01",
			}),
			createCard({
				id: asScryfallId("00000000-0000-0000-0000-000000000004"),
				lang: "en",
				frame: "2015",
				border_color: "borderless",
				games: ["paper"],
				highres_image: true,
				released_at: "2025-01-01",
			}),
			createCard({
				id: asScryfallId("00000000-0000-0000-0000-000000000005"),
				lang: "ja",
				frame: "2015",
				border_color: "black",
				games: ["paper"],
				highres_image: true,
				released_at: "2025-01-01",
			}),
		];

		const sorted = [...cards].sort(compareCards);
		// Priority: english > is:default > paper > highres > non-UB > black border > modern frame > newer
		expect(sorted[0].id).toBe(cards[2].id); // en, default, paper, highres, 2020 (best)
		expect(sorted[1].id).toBe(cards[0].id); // en, default, paper, lowres, 2024 (paper > digital even with lowres)
		expect(sorted[2].id).toBe(cards[1].id); // en, default, digital, highres, 2025
		expect(sorted[3].id).toBe(cards[3].id); // en, non-default (borderless), paper, highres, 2025
		expect(sorted[4].id).toBe(cards[4].id); // ja, default, paper, highres, 2025
	});
});
