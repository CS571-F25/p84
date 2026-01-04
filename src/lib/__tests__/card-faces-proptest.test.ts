/**
 * Property-based tests for card-faces module
 *
 * Tests parseManaValue against the full card database to ensure
 * our parsing matches Scryfall's authoritative cmc values.
 *
 * Separated from unit tests because loading the full card database
 * takes several seconds.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseManaValue } from "../card-faces";
import { CARD_CHUNKS } from "../card-manifest";
import type { Card } from "../scryfall-types";

const PUBLIC_DIR = join(process.cwd(), "public", "data", "cards");

interface ChunkData {
	cards: Record<string, Card>;
}

async function loadAllCards(): Promise<Card[]> {
	const cards: Card[] = [];

	for (const chunkFile of CARD_CHUNKS) {
		const content = await readFile(join(PUBLIC_DIR, chunkFile), "utf-8");
		const chunk = JSON.parse(content) as ChunkData;
		cards.push(...Object.values(chunk.cards));
	}

	return cards;
}

describe("parseManaValue against real cards", () => {
	let allCards: Card[];

	beforeAll(async () => {
		allCards = await loadAllCards();
	}, 60_000);

	it("loads a reasonable number of cards", () => {
		expect(allCards.length).toBeGreaterThan(100_000);
	});

	it("matches Scryfall cmc for all single-faced cards", () => {
		const failures: Array<{
			name: string;
			manaCost: string;
			expected: number;
			got: number;
		}> = [];
		let testedCount = 0;

		for (const card of allCards) {
			// Skip cards without mana cost (lands, etc.)
			if (!card.mana_cost) continue;

			// Skip multi-faced cards - their top-level mana_cost can be combined
			if (card.card_faces && card.card_faces.length > 1) continue;

			// Skip cards without cmc (shouldn't happen, but be safe)
			if (card.cmc === undefined) continue;

			// Skip joke/test sets with intentionally broken data
			if (card.set === "unk") continue;

			testedCount++;
			const parsed = parseManaValue(card.mana_cost);
			if (parsed !== card.cmc) {
				failures.push({
					name: card.name,
					manaCost: card.mana_cost,
					expected: card.cmc,
					got: parsed,
				});
			}
		}

		expect(testedCount).toBeGreaterThan(50_000);

		if (failures.length > 0) {
			const sample = failures.slice(0, 10);
			const msg = sample
				.map(
					(f) =>
						`${f.name}: "${f.manaCost}" expected ${f.expected}, got ${f.got}`,
				)
				.join("\n");
			expect.fail(
				`${failures.length} cards failed mana value parsing:\n${msg}`,
			);
		}
	});

	it("matches Scryfall cmc for front face of DFCs", () => {
		const failures: Array<{
			name: string;
			manaCost: string;
			expected: number;
			got: number;
		}> = [];
		let testedCount = 0;

		// Only test DFCs where card.cmc = front face CMC
		// Skip split/adventure cards where card.cmc is combined
		const dfcLayouts = ["transform", "modal_dfc", "flip", "meld"];

		for (const card of allCards) {
			if (!card.card_faces || card.card_faces.length < 2) continue;
			if (!card.layout || !dfcLayouts.includes(card.layout)) continue;

			const frontFace = card.card_faces[0];
			if (!frontFace.mana_cost) continue;
			if (card.cmc === undefined) continue;

			testedCount++;
			const parsed = parseManaValue(frontFace.mana_cost);
			if (parsed !== card.cmc) {
				failures.push({
					name: card.name,
					manaCost: frontFace.mana_cost,
					expected: card.cmc,
					got: parsed,
				});
			}
		}

		expect(testedCount).toBeGreaterThan(500);

		if (failures.length > 0) {
			const sample = failures.slice(0, 10);
			const msg = sample
				.map(
					(f) =>
						`${f.name}: "${f.manaCost}" expected ${f.expected}, got ${f.got}`,
				)
				.join("\n");
			expect.fail(
				`${failures.length} DFC cards failed mana value parsing:\n${msg}`,
			);
		}
	});
});
