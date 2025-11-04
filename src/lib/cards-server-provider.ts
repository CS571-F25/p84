/**
 * Server-side card data provider
 *
 * Reads card data from filesystem (works in Node.js and Cloudflare Workers with node compat)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CardDataProvider } from "./card-data-provider";
import type { Card, OracleId, ScryfallId } from "./scryfall-types";

const DATA_DIR = join(process.cwd(), "public/data");

export class ServerCardProvider implements CardDataProvider {
	async getCardById(id: ScryfallId): Promise<Card | undefined> {
		try {
			const filePath = join(DATA_DIR, "by-id", `${id}.json`);
			const content = await readFile(filePath, "utf-8");
			return JSON.parse(content);
		} catch {
			return undefined;
		}
	}

	async getCardsByIds(ids: ScryfallId[]): Promise<Map<ScryfallId, Card>> {
		const cards = await Promise.all(
			ids.map(async (id) => [id, await this.getCardById(id)] as const),
		);
		return new Map(
			cards.filter((pair): pair is [ScryfallId, Card] => pair[1] !== undefined),
		);
	}

	async getPrintingsByOracleId(oracleId: OracleId): Promise<ScryfallId[]> {
		try {
			const filePath = join(DATA_DIR, "by-oracle", `${oracleId}.json`);
			const content = await readFile(filePath, "utf-8");
			return JSON.parse(content);
		} catch {
			return [];
		}
	}

	async getMetadata(): Promise<{ version: string; cardCount: number }> {
		try {
			const filePath = join(DATA_DIR, "metadata.json");
			const content = await readFile(filePath, "utf-8");
			return JSON.parse(content);
		} catch {
			return { version: "unknown", cardCount: 0 };
		}
	}

	async getCanonicalPrinting(
		oracleId: OracleId,
	): Promise<ScryfallId | undefined> {
		try {
			const filePath = join(DATA_DIR, "canonical", `${oracleId}.json`);
			const content = await readFile(filePath, "utf-8");
			const data = JSON.parse(content);
			return data.id;
		} catch {
			return undefined;
		}
	}

	async getCardWithPrintings(id: ScryfallId): Promise<{
		card: Card;
		otherPrintings: Array<{
			id: ScryfallId;
			name: string;
			set_name?: string;
		}>;
	} | null> {
		const card = await this.getCardById(id);
		if (!card) return null;

		const allPrintingIds = await this.getPrintingsByOracleId(card.oracle_id);
		const otherPrintingIds = allPrintingIds.filter((printId) => printId !== id);

		const otherPrintings = await Promise.all(
			otherPrintingIds.map(async (printId) => {
				const printing = await this.getCardById(printId);
				if (!printing) return null;
				return {
					id: printing.id,
					name: printing.name,
					set_name: printing.set_name,
				};
			}),
		);

		return {
			card,
			otherPrintings: otherPrintings.filter(
				(p): p is NonNullable<typeof p> => p !== null,
			),
		};
	}

	// Search not implemented server-side (client-only feature for now)
	searchCards = undefined;
}
