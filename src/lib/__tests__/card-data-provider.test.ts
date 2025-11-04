/**
 * Contract tests for CardDataProvider implementations
 *
 * Ensures ClientCardProvider and ServerCardProvider return identical data
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CardDataProvider } from "../card-data-provider";
import { ClientCardProvider } from "../cards-client-provider";
import { ServerCardProvider } from "../cards-server-provider";
import { asOracleId, asScryfallId } from "../scryfall-types";

const PUBLIC_DIR = join(process.cwd(), "public");

// Mock cards-worker-client to use real worker code without Comlink/Worker
vi.mock("../cards-worker-client", () => {
	// biome-ignore lint/suspicious/noExplicitAny: mock needs to accept any worker instance
	let workerInstance: any = null;

	return {
		initializeWorker: async () => {
			const { __CardsWorkerForTestingOnly } = await import(
				"../../workers/cards.worker"
			);
			workerInstance = new __CardsWorkerForTestingOnly();
			await workerInstance.initialize();
		},
		getCardsWorker: () =>
			new Proxy(workerInstance, {
				get(target, prop) {
					const value = target[prop];
					if (typeof value === "function") {
						// biome-ignore lint/suspicious/noExplicitAny: proxy needs to handle any function signature
						return async (...args: any[]) => {
							const result = await value.apply(target, args);
							return structuredClone(result);
						};
					}
					return value;
				},
			}),
	};
});

// Known test IDs from our dataset (using first sample card - Forest from Bloomburrow)
const TEST_CARD_ID = asScryfallId("0000419b-0bba-4488-8f7a-6194544ce91e");
const TEST_CARD_ORACLE = asOracleId("b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6");
const TEST_CARD_NAME = "Forest";
const INVALID_ID = asScryfallId("00000000-0000-0000-0000-000000000000");
const INVALID_ORACLE = asOracleId("00000000-0000-0000-0000-000000000000");

// Sample of 50 card IDs evenly distributed across dataset for bulk testing
const SAMPLE_CARD_IDS = [
	"0000419b-0bba-4488-8f7a-6194544ce91e",
	"050ee59e-23fc-4476-8d1f-3f29d3ec9e74",
	"0a05ead0-5e82-4af9-9c7e-78a6de425673",
	"0eed3360-1634-4e60-b24d-4128c4896994",
	"142479d8-8956-44a2-8c54-9dd6dc1774c0",
	"19439420-9e0a-4fd1-bae9-f1c698edee1c",
	"1e6e80ec-68a4-4cfb-a712-2ea0d26dc6a1",
	"23a48f4a-96eb-47bd-9384-3bcc959a7c4b",
	"28a6b23f-a854-469a-9b06-119507dd9d42",
	"2dde460a-208f-4758-b172-64123ac69d75",
	"32eb6ab0-831e-4a30-a2fc-5ea1cb40930c",
	"381097a1-aac8-449b-bed5-ec0d9879a2c8",
	"3d5529ca-5c20-4dfd-8595-96d6dfa6debe",
	"427e31b2-2c53-46c8-af51-16a1ad6c66fd",
	"47a469be-e43a-48cb-b216-bb39ade32acb",
	"4cc636b1-5fc5-422d-9722-5fa12c754d6c",
	"520d3b08-bd71-422c-ae6b-d67360a36aca",
	"570a8272-7ca1-47db-834b-82f603d1417a",
	"5bf655ce-c841-42b2-9578-56ab401bf4de",
	"610def80-1303-488e-bfd9-4a27f031d20e",
	"6620ead7-4499-4a19-b3b8-edd263067c02",
	"6b3eb24e-bba4-463b-ad7e-e3daebda1e74",
	"7083fa8a-a841-4c69-9443-af35676a7817",
	"75a62b31-986c-4722-97da-d984272f0f05",
	"7ae76409-40d7-4a54-ad58-5c67996b1a0c",
	"8010cc08-7035-4daf-a4c4-e8d8959e1e82",
	"853d15cd-a1a2-47a8-89c4-81b7ca663fff",
	"8a238f08-f7c3-46be-b999-77b1c310cb1a",
	"8f5427b1-f1c2-4bb3-8736-701667ac2256",
	"949d42fb-72ff-40f9-8aff-7b0937fcdedf",
	"998d0cc8-ca2a-41c3-ab65-d05c26ab8278",
	"9e997f78-22a2-4b66-ac10-1adc9a72ce3b",
	"a39d6484-6530-4237-84b9-68ab8a056e7c",
	"a898939c-fb28-40cb-9c48-49763c0771a1",
	"ada2b522-219a-44be-98c1-83a02efdd709",
	"b2d51bdf-f118-4a1e-9060-bdf3c78697f2",
	"b7e92c82-840f-4c75-b617-7b58a07be5b4",
	"bd139009-fe5d-4189-8cde-a68ede6283fc",
	"c233f64e-179f-4783-a6a4-d3fe2c718a39",
	"c7552208-fd7c-4dc0-b7dd-acfcd3f78841",
	"cc738025-a771-4186-b08c-7b37c0e9713b",
	"d15adc93-1a71-453b-8277-4a525a9cbc7b",
	"d691cd3b-afe5-4f28-95a9-125475515126",
	"dbb0df36-8467-4a41-8e1c-6c3584d4fd10",
	"e0d4b681-9f20-4bb5-8a6d-552f069e577f",
	"e62d3bcc-7bb4-42be-90a9-caf3c1caa29d",
	"eb58d7ba-ba86-433e-8f1e-3f492c380796",
	"f08383ed-bf90-474a-97fb-9d7f8b3fb70a",
	"f5a65d3b-83e7-4f32-89b3-d152e66f1868",
	"fac38053-817d-4e0c-b6cc-81b6b92e652f",
];

describe("CardDataProvider contract", () => {
	let clientProvider: ClientCardProvider;
	let serverProvider: ServerCardProvider;

	beforeAll(async () => {
		// Mock fetch to serve cards.json from filesystem
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = typeof input === "string" ? input : input.toString();

				if (url.startsWith("/data/")) {
					const filePath = join(PUBLIC_DIR, url);
					try {
						const content = await readFile(filePath, "utf-8");
						return new Response(content, {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					} catch {}
				}

				return new Response(null, { status: 404 });
			}),
		);

		serverProvider = new ServerCardProvider();
		clientProvider = new ClientCardProvider();
		await clientProvider.initialize();
	});

	describe.each([
		["ServerCardProvider", () => serverProvider],
		["ClientCardProvider", () => clientProvider],
	])("%s", (_name, getProvider) => {
		let provider: CardDataProvider;

		beforeAll(() => {
			provider = getProvider();
		});

		describe("getCardById", () => {
			it("returns a valid card for known ID", async () => {
				const card = await provider.getCardById(TEST_CARD_ID);

				expect(card).toBeDefined();
				expect(card?.id).toBe(TEST_CARD_ID);
				expect(card?.name).toBe(TEST_CARD_NAME);
				expect(card?.oracle_id).toBe(TEST_CARD_ORACLE);
			});

			it("returns undefined for invalid ID", async () => {
				const card = await provider.getCardById(INVALID_ID);
				expect(card).toBeUndefined();
			});

			it("returns undefined for missing ID", async () => {
				const missingId = asScryfallId("ffffffff-ffff-ffff-ffff-ffffffffffff");
				const card = await provider.getCardById(missingId);
				expect(card).toBeUndefined();
			});
		});

		describe("getPrintingsByOracleId", () => {
			it("returns printing IDs for known oracle ID", async () => {
				const printings =
					await provider.getPrintingsByOracleId(TEST_CARD_ORACLE);

				expect(Array.isArray(printings)).toBe(true);
				expect(printings.length).toBeGreaterThan(0);
				expect(printings).toContain(TEST_CARD_ID);
			});

			it("returns empty array for invalid oracle ID", async () => {
				const printings = await provider.getPrintingsByOracleId(INVALID_ORACLE);
				expect(printings).toEqual([]);
			});

			it("returns empty array for missing oracle ID", async () => {
				const missingOracle = asOracleId(
					"ffffffff-ffff-ffff-ffff-ffffffffffff",
				);
				const printings = await provider.getPrintingsByOracleId(missingOracle);
				expect(printings).toEqual([]);
			});
		});

		describe("getMetadata", () => {
			it("returns version and card count", async () => {
				const metadata = await provider.getMetadata();

				expect(metadata).toHaveProperty("version");
				expect(metadata).toHaveProperty("cardCount");
				expect(typeof metadata.version).toBe("string");
				expect(typeof metadata.cardCount).toBe("number");
				expect(metadata.cardCount).toBeGreaterThan(0);
			});
		});

		describe("getCanonicalPrinting", () => {
			it("returns canonical printing ID for known oracle ID", async () => {
				const canonicalId =
					await provider.getCanonicalPrinting(TEST_CARD_ORACLE);

				expect(canonicalId).toBeDefined();
				expect(typeof canonicalId).toBe("string");
			});

			it("returns undefined for invalid oracle ID", async () => {
				const canonicalId = await provider.getCanonicalPrinting(INVALID_ORACLE);
				expect(canonicalId).toBeUndefined();
			});

			it("returns undefined for missing oracle ID", async () => {
				const missingOracle = asOracleId(
					"ffffffff-ffff-ffff-ffff-ffffffffffff",
				);
				const canonicalId = await provider.getCanonicalPrinting(missingOracle);
				expect(canonicalId).toBeUndefined();
			});
		});

		describe("getCardWithPrintings", () => {
			it("returns card with other printings for known ID", async () => {
				const result = await provider.getCardWithPrintings(TEST_CARD_ID);

				expect(result).toBeDefined();
				expect(result?.card.id).toBe(TEST_CARD_ID);
				expect(result?.card.name).toBe(TEST_CARD_NAME);
				expect(Array.isArray(result?.otherPrintings)).toBe(true);
			});

			it("returns null for invalid ID", async () => {
				const result = await provider.getCardWithPrintings(INVALID_ID);
				expect(result).toBeNull();
			});

			it("returns null for missing ID", async () => {
				const missingId = asScryfallId("ffffffff-ffff-ffff-ffff-ffffffffffff");
				const result = await provider.getCardWithPrintings(missingId);
				expect(result).toBeNull();
			});
		});
	});

	describe("Cross-provider consistency", () => {
		it("returns identical card data", async () => {
			const [clientCard, serverCard] = await Promise.all([
				clientProvider.getCardById(TEST_CARD_ID),
				serverProvider.getCardById(TEST_CARD_ID),
			]);

			expect(clientCard).toEqual(serverCard);
		});

		it("returns identical printing lists", async () => {
			const [clientPrintings, serverPrintings] = await Promise.all([
				clientProvider.getPrintingsByOracleId(TEST_CARD_ORACLE),
				serverProvider.getPrintingsByOracleId(TEST_CARD_ORACLE),
			]);

			expect(clientPrintings).toEqual(serverPrintings);
		});

		it("returns identical metadata", async () => {
			const [clientMetadata, serverMetadata] = await Promise.all([
				clientProvider.getMetadata(),
				serverProvider.getMetadata(),
			]);

			expect(clientMetadata).toEqual(serverMetadata);
		});

		it("returns identical canonical printings", async () => {
			const [clientCanonical, serverCanonical] = await Promise.all([
				clientProvider.getCanonicalPrinting(TEST_CARD_ORACLE),
				serverProvider.getCanonicalPrinting(TEST_CARD_ORACLE),
			]);

			expect(clientCanonical).toEqual(serverCanonical);
		});

		it("returns identical card with printings", async () => {
			const [clientResult, serverResult] = await Promise.all([
				clientProvider.getCardWithPrintings(TEST_CARD_ID),
				serverProvider.getCardWithPrintings(TEST_CARD_ID),
			]);

			expect(clientResult?.card).toEqual(serverResult?.card);
			expect(clientResult?.otherPrintings).toEqual(
				serverResult?.otherPrintings,
			);
		});

		it("returns identical results for missing IDs", async () => {
			const missingId = asScryfallId("ffffffff-ffff-ffff-ffff-ffffffffffff");
			const [clientCard, serverCard] = await Promise.all([
				clientProvider.getCardById(missingId),
				serverProvider.getCardById(missingId),
			]);

			expect(clientCard).toBeUndefined();
			expect(serverCard).toBeUndefined();
			expect(clientCard).toEqual(serverCard);
		});

		it.each(SAMPLE_CARD_IDS)(
			"returns identical data for card %s",
			async (cardId) => {
				const id = asScryfallId(cardId);
				const [clientCard, serverCard] = await Promise.all([
					clientProvider.getCardById(id),
					serverProvider.getCardById(id),
				]);

				expect(clientCard).toEqual(serverCard);
			},
		);
	});

	describe("ClientCardProvider specific", () => {
		it("supports searchCards", async () => {
			expect(clientProvider.searchCards).toBeDefined();

			const results = await clientProvider.searchCards("forest", 10);
			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBeGreaterThan(0);

			const forest = results.find((c) => c.name === TEST_CARD_NAME);
			expect(forest).toBeDefined();
		});
	});

	describe("ServerCardProvider specific", () => {
		it("does not support searchCards", () => {
			expect(serverProvider.searchCards).toBeUndefined();
		});
	});
});
