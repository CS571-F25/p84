import { describe, expect, it } from "vitest";
import { getColorIdentityLabel } from "../deck-grouping";

describe("getColorIdentityLabel", () => {
	describe("mono-color", () => {
		it("returns color name for mono-white", () => {
			expect(getColorIdentityLabel(["W"])).toBe("White");
		});

		it("returns color name for mono-blue", () => {
			expect(getColorIdentityLabel(["U"])).toBe("Blue");
		});

		it("returns color name for mono-black", () => {
			expect(getColorIdentityLabel(["B"])).toBe("Black");
		});

		it("returns color name for mono-red", () => {
			expect(getColorIdentityLabel(["R"])).toBe("Red");
		});

		it("returns color name for mono-green", () => {
			expect(getColorIdentityLabel(["G"])).toBe("Green");
		});
	});

	describe("colorless", () => {
		it("returns Colorless for empty array", () => {
			expect(getColorIdentityLabel([])).toBe("Colorless");
		});

		it("returns Colorless for undefined", () => {
			expect(getColorIdentityLabel(undefined)).toBe("Colorless");
		});
	});

	describe("guilds (2-color)", () => {
		it("handles Azorius (WU)", () => {
			expect(getColorIdentityLabel(["W", "U"])).toBe("Azorius (WU)");
			expect(getColorIdentityLabel(["U", "W"])).toBe("Azorius (WU)");
		});

		it("handles Orzhov (WB)", () => {
			expect(getColorIdentityLabel(["W", "B"])).toBe("Orzhov (WB)");
			expect(getColorIdentityLabel(["B", "W"])).toBe("Orzhov (WB)");
		});

		it("handles Boros (WR)", () => {
			expect(getColorIdentityLabel(["W", "R"])).toBe("Boros (WR)");
			expect(getColorIdentityLabel(["R", "W"])).toBe("Boros (WR)");
		});

		it("handles Selesnya (WG)", () => {
			expect(getColorIdentityLabel(["W", "G"])).toBe("Selesnya (WG)");
			expect(getColorIdentityLabel(["G", "W"])).toBe("Selesnya (WG)");
		});

		it("handles Dimir (UB)", () => {
			expect(getColorIdentityLabel(["U", "B"])).toBe("Dimir (UB)");
			expect(getColorIdentityLabel(["B", "U"])).toBe("Dimir (UB)");
		});

		it("handles Izzet (UR)", () => {
			expect(getColorIdentityLabel(["U", "R"])).toBe("Izzet (UR)");
			expect(getColorIdentityLabel(["R", "U"])).toBe("Izzet (UR)");
		});

		it("handles Simic (UG)", () => {
			expect(getColorIdentityLabel(["U", "G"])).toBe("Simic (UG)");
			expect(getColorIdentityLabel(["G", "U"])).toBe("Simic (UG)");
		});

		it("handles Rakdos (BR)", () => {
			expect(getColorIdentityLabel(["B", "R"])).toBe("Rakdos (BR)");
			expect(getColorIdentityLabel(["R", "B"])).toBe("Rakdos (BR)");
		});

		it("handles Golgari (BG)", () => {
			expect(getColorIdentityLabel(["B", "G"])).toBe("Golgari (BG)");
			expect(getColorIdentityLabel(["G", "B"])).toBe("Golgari (BG)");
		});

		it("handles Gruul (RG)", () => {
			expect(getColorIdentityLabel(["R", "G"])).toBe("Gruul (RG)");
			expect(getColorIdentityLabel(["G", "R"])).toBe("Gruul (RG)");
		});
	});

	describe("shards (3-color allied)", () => {
		it("handles Bant (GWU)", () => {
			expect(getColorIdentityLabel(["G", "W", "U"])).toBe("Bant (GWU)");
			expect(getColorIdentityLabel(["W", "U", "G"])).toBe("Bant (GWU)");
			expect(getColorIdentityLabel(["U", "G", "W"])).toBe("Bant (GWU)");
		});

		it("handles Esper (WUB)", () => {
			expect(getColorIdentityLabel(["W", "U", "B"])).toBe("Esper (WUB)");
			expect(getColorIdentityLabel(["U", "B", "W"])).toBe("Esper (WUB)");
			expect(getColorIdentityLabel(["B", "W", "U"])).toBe("Esper (WUB)");
		});

		it("handles Grixis (UBR)", () => {
			expect(getColorIdentityLabel(["U", "B", "R"])).toBe("Grixis (UBR)");
			expect(getColorIdentityLabel(["B", "R", "U"])).toBe("Grixis (UBR)");
			expect(getColorIdentityLabel(["R", "U", "B"])).toBe("Grixis (UBR)");
		});

		it("handles Jund (BRG)", () => {
			expect(getColorIdentityLabel(["B", "R", "G"])).toBe("Jund (BRG)");
			expect(getColorIdentityLabel(["R", "G", "B"])).toBe("Jund (BRG)");
			expect(getColorIdentityLabel(["G", "B", "R"])).toBe("Jund (BRG)");
		});

		it("handles Naya (RGW)", () => {
			expect(getColorIdentityLabel(["R", "G", "W"])).toBe("Naya (RGW)");
			expect(getColorIdentityLabel(["G", "W", "R"])).toBe("Naya (RGW)");
			expect(getColorIdentityLabel(["W", "R", "G"])).toBe("Naya (RGW)");
		});
	});

	describe("wedges (3-color enemy)", () => {
		it("handles Abzan (WBG)", () => {
			expect(getColorIdentityLabel(["W", "B", "G"])).toBe("Abzan (WBG)");
			expect(getColorIdentityLabel(["B", "G", "W"])).toBe("Abzan (WBG)");
			expect(getColorIdentityLabel(["G", "W", "B"])).toBe("Abzan (WBG)");
		});

		it("handles Jeskai (URW)", () => {
			expect(getColorIdentityLabel(["U", "R", "W"])).toBe("Jeskai (URW)");
			expect(getColorIdentityLabel(["R", "W", "U"])).toBe("Jeskai (URW)");
			expect(getColorIdentityLabel(["W", "U", "R"])).toBe("Jeskai (URW)");
		});

		it("handles Sultai (BGU)", () => {
			expect(getColorIdentityLabel(["B", "G", "U"])).toBe("Sultai (BGU)");
			expect(getColorIdentityLabel(["G", "U", "B"])).toBe("Sultai (BGU)");
			expect(getColorIdentityLabel(["U", "B", "G"])).toBe("Sultai (BGU)");
		});

		it("handles Mardu (RWB)", () => {
			expect(getColorIdentityLabel(["R", "W", "B"])).toBe("Mardu (RWB)");
			expect(getColorIdentityLabel(["W", "B", "R"])).toBe("Mardu (RWB)");
			expect(getColorIdentityLabel(["B", "R", "W"])).toBe("Mardu (RWB)");
		});

		it("handles Temur (GUR)", () => {
			expect(getColorIdentityLabel(["G", "U", "R"])).toBe("Temur (GUR)");
			expect(getColorIdentityLabel(["U", "R", "G"])).toBe("Temur (GUR)");
			expect(getColorIdentityLabel(["R", "G", "U"])).toBe("Temur (GUR)");
		});
	});

	describe("4-color", () => {
		it("handles Non-Green (WUBR)", () => {
			expect(getColorIdentityLabel(["W", "U", "B", "R"])).toBe(
				"Non-Green (WUBR)",
			);
		});

		it("handles Non-Red (WUBG)", () => {
			expect(getColorIdentityLabel(["W", "U", "B", "G"])).toBe(
				"Non-Red (WUBG)",
			);
		});

		it("handles Non-Black (WURG)", () => {
			expect(getColorIdentityLabel(["W", "U", "R", "G"])).toBe(
				"Non-Black (WURG)",
			);
		});

		it("handles Non-Blue (WBRG)", () => {
			expect(getColorIdentityLabel(["W", "B", "R", "G"])).toBe(
				"Non-Blue (WBRG)",
			);
		});

		it("handles Non-White (UBRG)", () => {
			expect(getColorIdentityLabel(["U", "B", "R", "G"])).toBe(
				"Non-White (UBRG)",
			);
		});
	});

	describe("5-color", () => {
		it("handles Five-Color (WUBRG)", () => {
			expect(getColorIdentityLabel(["W", "U", "B", "R", "G"])).toBe(
				"Five-Color (WUBRG)",
			);
			expect(getColorIdentityLabel(["G", "R", "B", "U", "W"])).toBe(
				"Five-Color (WUBRG)",
			);
		});
	});
});
