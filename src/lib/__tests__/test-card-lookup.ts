/**
 * Test utility for looking up real card data by name.
 *
 * Uses a fixture file (test-cards.json) for name → oracle_id mapping,
 * then ServerCardProvider for fast binary-search card lookups.
 *
 * Usage:
 *   const cards = await setupTestCards();
 *
 *   const llanowar = await cards.get("Llanowar Elves");
 *   expect(getSourceTempo(llanowar)).toBe("delayed");
 *
 * To add a new test card:
 *   1. Get the oracle_id from Scryfall: curl 'https://api.scryfall.com/cards/named?exact=Card+Name'
 *   2. Add to test-cards.json: "Card Name": "oracle-id-here"
 */

import { ServerCardProvider } from "../cards-server-provider";
import type { Card } from "../scryfall-types";
import { asOracleId } from "../scryfall-types";
import testCardsFixture from "./test-cards.json";
import { mockFetchFromPublicDir } from "./test-helpers";

const nameToOracleId: Record<string, string> = testCardsFixture;

export class TestCardLookup {
	private provider: ServerCardProvider;

	constructor() {
		this.provider = new ServerCardProvider();
	}

	async get(name: string): Promise<Card> {
		const oracleIdStr = nameToOracleId[name];
		if (!oracleIdStr) {
			const available = Object.keys(nameToOracleId)
				.filter((n) => n !== "$comment")
				.join(", ");
			throw new Error(
				`Card "${name}" not in test fixture. Available: ${available}\n` +
					`To add: curl 'https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}' | jq .oracle_id`,
			);
		}

		const oracleId = asOracleId(oracleIdStr);
		const scryfallId = await this.provider.getCanonicalPrinting(oracleId);
		if (!scryfallId) {
			throw new Error(
				`No canonical printing found for "${name}" (${oracleId})`,
			);
		}

		const card = await this.provider.getCardById(scryfallId);
		if (!card) {
			throw new Error(`Card data not found for "${name}" (${scryfallId})`);
		}

		// For MDFCs, allow matching either the front face or full name
		const nameMatches =
			card.name === name || card.name.startsWith(`${name} //`);
		if (!nameMatches) {
			throw new Error(
				`Name mismatch: expected "${name}" but got "${card.name}". ` +
					`Oracle ID ${oracleId} may be wrong in test-cards.json`,
			);
		}

		return card;
	}

	async getAll(...names: string[]): Promise<Card[]> {
		return Promise.all(names.map((name) => this.get(name)));
	}
}

/**
 * Set up test card lookup with mocked fetch.
 * Call this in beforeAll.
 */
export async function setupTestCards(): Promise<TestCardLookup> {
	mockFetchFromPublicDir();
	return new TestCardLookup();
}
