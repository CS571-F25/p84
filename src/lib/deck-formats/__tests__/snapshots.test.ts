/**
 * Snapshot and roundtrip tests for deck-formats
 *
 * These tests serve as regression guards:
 * 1. Roundtrip identity: parse → export as detected format → compare strings
 * 2. Parse snapshots: parsed structure for each fixture
 * 3. Export snapshots: export to every format for each fixture
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectFormat } from "../detect";
import { formatDeck } from "../export";
import { parseDeck } from "../parse";
import type { DeckFormat } from "../types";

const fixturesDir = join(__dirname, "fixtures");

// Map directory names to default expected formats
const dirToFormat: Record<string, DeckFormat> = {
	arena: "arena",
	moxfield: "moxfield",
	archidekt: "archidekt",
	mtggoldfish: "mtggoldfish",
	xmage: "xmage",
	deckstats: "deckstats",
	tappedout: "tappedout",
	"edge-cases": "generic",
};

// Per-file overrides when the file's format differs from directory default
// Key format: "dir/filename"
const fixtureFormatOverrides: Record<string, DeckFormat> = {
	// TappedOut's "simple" export doesn't use Nx format - it's generic
	"tappedout/simple.txt": "generic",
	// TappedOut's "Arena export" uses Nx quantity - it's really tappedout format
	"tappedout/arena-export.txt": "tappedout",
	// Archidekt's Arena export is just cards with blank line separator - generic
	"archidekt/arena-export.txt": "generic",
	// Deckstats generic exports are just generic format
	"deckstats/generic-simple.txt": "generic",
	"deckstats/generic-txt.txt": "generic",
	// MTGGoldfish simple is just names - generic
	"mtggoldfish/simple.txt": "generic",
	"mtggoldfish/commander.txt": "generic",
};

// All formats we export to
const allFormats: DeckFormat[] = [
	"arena",
	"mtgo",
	"moxfield",
	"xmage",
	"tappedout",
	"mtggoldfish",
	"deckstats",
];

interface FixtureInfo {
	path: string;
	name: string;
	dir: string;
	expectedFormat: DeckFormat;
}

function collectFixtures(): FixtureInfo[] {
	const fixtures: FixtureInfo[] = [];

	for (const dir of readdirSync(fixturesDir)) {
		const dirPath = join(fixturesDir, dir);
		if (!statSync(dirPath).isDirectory()) continue;

		const dirDefault = dirToFormat[dir] ?? "generic";

		for (const file of readdirSync(dirPath)) {
			// Include .txt, .dec, .dck files
			if (!/\.(txt|dec|dck)$/.test(file)) continue;

			const name = `${dir}/${file}`;
			const expectedFormat = fixtureFormatOverrides[name] ?? dirDefault;

			fixtures.push({
				path: join(dirPath, file),
				name,
				dir,
				expectedFormat,
			});
		}
	}

	return fixtures.sort((a, b) => a.name.localeCompare(b.name));
}

const fixtures = collectFixtures();

// Fixtures with structural differences that prevent text-identical roundtrip
// - archidekt flat/by-category: cards alphabetized, category headers become card names
// - archidekt sections: old format uses Commander/Mainboard headers, we use # Sideboard + inline [Commander]
// - deckstats generic-*: cross-format (deckstats dir but generic expected format)
// - deckstats commander-with-categories: custom //category comments we don't preserve
const structurallyDifferentFixtures = new Set([
	"archidekt/ashling-flat.txt",
	"archidekt/ashling-flat-no-maybe.txt",
	"archidekt/ashling-by-category.txt",
	"archidekt/ashling-sections.txt",
	"archidekt/ashling-sections-no-maybe.txt",
	"archidekt/txt-with-categories.txt",
	"deckstats/generic-simple.txt",
	"deckstats/generic-txt.txt",
	"deckstats/commander-with-categories.dec",
]);

// Only test real-world fixtures for roundtrip (exclude edge-cases and structurally different)
const realWorldFixtures = fixtures.filter(
	(f) => f.dir !== "edge-cases" && !structurallyDifferentFixtures.has(f.name),
);

import { normalizeForRoundtrip } from "./normalize";

describe("roundtrip identity", () => {
	// Roundtrip test: parse → export → compare to normalized original
	// Normalization accounts for intentional data loss (foil markers, global tags, etc.)
	it.each(realWorldFixtures)("$name", ({ path, expectedFormat }) => {
		const content = readFileSync(path, "utf-8");
		const parsed = parseDeck(content, { stripRedundantTypeTags: false });
		const exported = formatDeck(parsed, expectedFormat);

		// Normalize original to account for intentional data loss
		const normalizedOriginal = normalizeForRoundtrip(content, expectedFormat);
		const normalizedExported = exported.trim().replace(/\r\n/g, "\n");

		expect(normalizedExported).toBe(normalizedOriginal);
	});
});

describe("parse snapshots", () => {
	it.each(fixtures)("$name", ({ path, expectedFormat }) => {
		const content = readFileSync(path, "utf-8");
		// Disable stripping redundant type tags for accurate parsing comparison
		const parsed = parseDeck(content, {
			format: expectedFormat,
			stripRedundantTypeTags: false,
		});
		expect(parsed).toMatchSnapshot();
	});
});

describe("export snapshots", () => {
	for (const fixture of fixtures) {
		describe(fixture.name, () => {
			const content = readFileSync(fixture.path, "utf-8");
			// Disable stripping redundant type tags for roundtrip accuracy
			const parsed = parseDeck(content, {
				format: fixture.expectedFormat,
				stripRedundantTypeTags: false,
			});

			it.each(allFormats)("export to %s", (format) => {
				const exported = formatDeck(parsed, format);
				expect(exported).toMatchSnapshot();
			});
		});
	}
});

describe("format detection", () => {
	it.each(realWorldFixtures)(
		"$name detects as expected format",
		({ path, expectedFormat }) => {
			const content = readFileSync(path, "utf-8");
			const detected = detectFormat(content);
			expect({ detected, expected: expectedFormat }).toMatchSnapshot();
		},
	);
});
