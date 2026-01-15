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
 *   ./src/lib/__tests__/add-test-card.sh "Card Name"
 */

import { ServerCardProvider } from "../cards-server-provider";
import type { Card, OracleId } from "../scryfall-types";
import { asOracleId } from "../scryfall-types";
import testCardsFixture from "./test-cards.json";
import { mockFetchFromPublicDir } from "./test-helpers";

const nameToOracleId: Record<string, string> = testCardsFixture;

/**
 * Get oracle ID for a card name from the test fixture.
 * Throws if card not in fixture.
 */
export function getTestCardOracleId(name: string): OracleId {
	const oracleIdStr = nameToOracleId[name];
	if (!oracleIdStr) {
		const available = Object.keys(nameToOracleId)
			.filter((n) => n !== "$comment")
			.join(", ");
		throw new Error(
			`Card "${name}" not in test fixture. Available: ${available}\n` +
				`To add: ./src/lib/__tests__/add-test-card.sh "${name}"`,
		);
	}
	return asOracleId(oracleIdStr);
}

export class TestCardLookup {
	private provider: ServerCardProvider;

	constructor() {
		this.provider = new ServerCardProvider();
	}

	async get(name: string): Promise<Card> {
		const oracleId = getTestCardOracleId(name);
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

		// log the card, so that the details of the card are shown in the error
		console.log(card);

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
