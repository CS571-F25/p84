import { describe, expect, it } from "vitest";
import { extractInlineSection, parseSectionMarker } from "../sections";

describe("parseSectionMarker", () => {
	describe("Arena-style section headers", () => {
		it("recognizes 'Deck' as mainboard", () => {
			expect(parseSectionMarker("Deck")).toEqual({
				section: "mainboard",
				consumeLine: true,
			});
		});

		it("recognizes 'Sideboard' as sideboard", () => {
			expect(parseSectionMarker("Sideboard")).toEqual({
				section: "sideboard",
				consumeLine: true,
			});
		});

		it("recognizes 'Commander' as commander", () => {
			expect(parseSectionMarker("Commander")).toEqual({
				section: "commander",
				consumeLine: true,
			});
		});

		it("is case-insensitive", () => {
			expect(parseSectionMarker("SIDEBOARD")).toEqual({
				section: "sideboard",
				consumeLine: true,
			});
			expect(parseSectionMarker("deck")).toEqual({
				section: "mainboard",
				consumeLine: true,
			});
		});

		it("handles whitespace", () => {
			expect(parseSectionMarker("  Sideboard  ")).toEqual({
				section: "sideboard",
				consumeLine: true,
			});
		});
	});

	describe("Deckstats //Section comments", () => {
		it("recognizes //Main as mainboard", () => {
			expect(parseSectionMarker("//Main")).toEqual({
				section: "mainboard",
				consumeLine: true,
			});
		});

		it("recognizes //Mainboard as mainboard", () => {
			expect(parseSectionMarker("//Mainboard")).toEqual({
				section: "mainboard",
				consumeLine: true,
			});
		});

		it("recognizes //Sideboard as sideboard", () => {
			expect(parseSectionMarker("//Sideboard")).toEqual({
				section: "sideboard",
				consumeLine: true,
			});
		});

		it("recognizes //Maybeboard as maybeboard", () => {
			expect(parseSectionMarker("//Maybeboard")).toEqual({
				section: "maybeboard",
				consumeLine: true,
			});
		});

		it("treats other // comments as mainboard (custom categories)", () => {
			// Custom categories like //burn, //draw should stay in mainboard
			expect(parseSectionMarker("//burn")).toEqual({
				section: "mainboard",
				consumeLine: true,
			});
		});
	});

	describe("TappedOut About/Name header", () => {
		it("recognizes 'About' line as consumable", () => {
			// TappedOut arena export starts with "About" line
			const result = parseSectionMarker("About");
			expect(result?.consumeLine).toBe(true);
		});
	});

	describe("non-section lines", () => {
		it("returns null for card lines", () => {
			expect(parseSectionMarker("4 Lightning Bolt")).toBeNull();
		});

		it("returns null for card lines with set codes", () => {
			expect(parseSectionMarker("4 Lightning Bolt (2XM) 141")).toBeNull();
		});

		it("returns null for empty lines", () => {
			expect(parseSectionMarker("")).toBeNull();
		});

		it("returns null for XMage NAME: lines", () => {
			// NAME: is metadata, not a section marker
			expect(parseSectionMarker("NAME:[MOD] UW Miracles")).toBeNull();
		});

		it("returns null for XMage LAYOUT lines", () => {
			expect(parseSectionMarker("LAYOUT MAIN:(1,6)")).toBeNull();
		});
	});
});

describe("extractInlineSection", () => {
	describe("Archidekt inline markers", () => {
		it("extracts [Sideboard] marker", () => {
			const result = extractInlineSection(
				"1x Sol Ring (cmm) 647 [Sideboard] ^Have^",
			);
			expect(result.section).toBe("sideboard");
			expect(result.cardLine).toBe("1x Sol Ring (cmm) 647  ^Have^");
		});

		it("extracts [Commander{top}] marker", () => {
			const result = extractInlineSection(
				"1x Tifa Lockhart (fin) 567 *F* [Commander{top}] ^Have^",
			);
			expect(result.section).toBe("commander");
			expect(result.cardLine).toBe("1x Tifa Lockhart (fin) 567 *F*  ^Have^");
		});

		it("extracts [Maybeboard{noDeck}{noPrice}] marker", () => {
			const result = extractInlineSection(
				"1x Alpha Authority (gtc) 114 [Maybeboard{noDeck}{noPrice}]",
			);
			expect(result.section).toBe("maybeboard");
			expect(result.cardLine).toBe("1x Alpha Authority (gtc) 114 ");
		});

		it("handles multiple category markers (takes first section)", () => {
			// Archidekt can have multiple categories like [Maybeboard{...},Enchantment]
			const result = extractInlineSection(
				"1x Card (set) 1 [Maybeboard{noDeck},Sideboard,Creature]",
			);
			expect(result.section).toBe("maybeboard");
		});
	});

	describe("Deckstats # !Commander marker", () => {
		it("extracts # !Commander marker", () => {
			const result = extractInlineSection("1 Black Waltz No. 3 # !Commander");
			expect(result.section).toBe("commander");
			expect(result.cardLine).toBe("1 Black Waltz No. 3");
		});
	});

	describe("XMage SB: prefix", () => {
		it("extracts SB: prefix", () => {
			const result = extractInlineSection("SB: 2 [EMA:142] Pyroblast");
			expect(result.section).toBe("sideboard");
			expect(result.cardLine).toBe("2 [EMA:142] Pyroblast");
		});

		it("handles SB: with extra whitespace", () => {
			const result = extractInlineSection("SB:  3 Counterspell");
			expect(result.section).toBe("sideboard");
			expect(result.cardLine).toBe("3 Counterspell");
		});
	});

	describe("lines without inline sections", () => {
		it("returns original line when no inline section", () => {
			const result = extractInlineSection("4 Lightning Bolt (2XM) 141");
			expect(result.section).toBeUndefined();
			expect(result.cardLine).toBe("4 Lightning Bolt (2XM) 141");
		});

		it("does not confuse [SET] with [Sideboard]", () => {
			// MTGGoldfish format: [SET] after name
			const result = extractInlineSection("4 Lightning Bolt [2XM]");
			expect(result.section).toBeUndefined();
			expect(result.cardLine).toBe("4 Lightning Bolt [2XM]");
		});
	});
});
