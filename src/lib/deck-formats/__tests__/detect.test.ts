import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectFormat } from "../detect";

const fixturesDir = join(__dirname, "fixtures");

function readFixture(subdir: string, filename: string): string {
	return readFileSync(join(fixturesDir, subdir, filename), "utf-8");
}

describe("detectFormat", () => {
	describe("XMage format", () => {
		it("detects XMage by [SET:num] pattern before card name", () => {
			const text = readFixture("xmage", "uw-miracles.dck");
			expect(detectFormat(text)).toBe("xmage");
		});

		it("detects XMage even with SB: prefix lines", () => {
			const text = readFixture("xmage", "affinity.dck");
			expect(detectFormat(text)).toBe("xmage");
		});
	});

	describe("Archidekt format", () => {
		it("detects Archidekt by inline [Sideboard] and [Commander] markers", () => {
			const text = readFixture("archidekt", "txt-with-categories.txt");
			expect(detectFormat(text)).toBe("archidekt");
		});

		it("detects Archidekt by ^Tag^ color markers", () => {
			const text = `1x Sol Ring (cmm) 647 ^Have,#37d67a^`;
			expect(detectFormat(text)).toBe("archidekt");
		});
	});

	describe("MTGGoldfish format", () => {
		it("detects MTGGoldfish by [SET] after card name", () => {
			const text = readFixture("mtggoldfish", "exact-versions.txt");
			expect(detectFormat(text)).toBe("mtggoldfish");
		});

		it("detects MTGGoldfish with <variant> markers", () => {
			const text = `3 Enduring Curiosity <extended> [DSK]
4 Tishana's Tidebinder <borderless> [LCI]`;
			expect(detectFormat(text)).toBe("mtggoldfish");
		});
	});

	describe("Deckstats format", () => {
		it("detects Deckstats by //Section comments", () => {
			const text = readFixture("deckstats", "commander-with-categories.dec");
			expect(detectFormat(text)).toBe("deckstats");
		});

		it("detects Deckstats by # !Commander marker", () => {
			const text = `1 Black Waltz No. 3 # !Commander
1 Lightning Bolt`;
			expect(detectFormat(text)).toBe("deckstats");
		});
	});

	describe("TappedOut format", () => {
		it("detects TappedOut by Nx quantity pattern", () => {
			const text = readFixture("tappedout", "arena-export.txt");
			expect(detectFormat(text)).toBe("tappedout");
		});

		it("detects TappedOut with lowercase x", () => {
			const text = `4x Lightning Bolt
2x Counterspell`;
			expect(detectFormat(text)).toBe("tappedout");
		});
	});

	describe("Moxfield format", () => {
		it("detects Moxfield by *F* foil markers", () => {
			const text = readFixture("moxfield", "commander-with-foils.txt");
			expect(detectFormat(text)).toBe("moxfield");
		});

		it("detects Moxfield by #tag patterns (without inline section markers)", () => {
			const text = `1 Sol Ring (CMM) 647 #ramp #staple
1 Lightning Bolt (2XM) 141 #removal`;
			expect(detectFormat(text)).toBe("moxfield");
		});
	});

	describe("Arena format", () => {
		it("detects Arena by Deck/Sideboard section headers", () => {
			const text = `Deck
4 Lightning Bolt (2XM) 141
4 Counterspell (IMA) 52

Sideboard
2 Pyroblast (EMA) 142`;
			expect(detectFormat(text)).toBe("arena");
		});

		it("detects Arena by Commander section header", () => {
			const text = `Commander
1 Atraxa, Praetors' Voice (CM2) 10

Deck
1 Sol Ring (CMM) 647`;
			expect(detectFormat(text)).toBe("arena");
		});
	});

	describe("Generic format", () => {
		it("falls back to generic for plain card lists", () => {
			const text = readFixture("mtggoldfish", "simple.txt");
			expect(detectFormat(text)).toBe("generic");
		});

		it("returns generic for minimal card list", () => {
			const text = readFixture("edge-cases", "minimal.txt");
			expect(detectFormat(text)).toBe("generic");
		});

		it("returns generic for empty input", () => {
			expect(detectFormat("")).toBe("generic");
		});

		it("returns generic for whitespace-only input", () => {
			expect(detectFormat("   \n\n   ")).toBe("generic");
		});
	});

	describe("detection priority", () => {
		it("prefers XMage over other formats when [SET:num] present", () => {
			const text = `4 [2XM:141] Lightning Bolt
SB: 2 [EMA:142] Pyroblast`;
			expect(detectFormat(text)).toBe("xmage");
		});

		it("prefers Archidekt over Moxfield when [Sideboard] markers present", () => {
			const text = `1x Sol Ring (CMM) 647 [Sideboard] #ramp`;
			expect(detectFormat(text)).toBe("archidekt");
		});

		it("prefers MTGGoldfish when [SET] appears after name (not before)", () => {
			const text = `4 Lightning Bolt [2XM]
2 Counterspell [IMA]`;
			expect(detectFormat(text)).toBe("mtggoldfish");
		});

		it("detects moxfield when #tags present (even with [SET])", () => {
			// Conflict: [SET] is MTGGoldfish style, #tags is Moxfield
			// Detection prioritizes #tags → moxfield
			// User needs explicit hint if they want MTGGoldfish behavior
			const text = `4 Lightning Bolt [2XM] #removal
2 Counterspell [IMA] #counter`;
			expect(detectFormat(text)).toBe("moxfield");
		});
	});
});
