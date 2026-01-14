/**
 * ATProto client utilities for record CRUD operations
 * Reads via Slingshot (cached), writes via PDS (authenticated)
 */

import type {} from "@atcute/atproto";
import { Client } from "@atcute/client";
import type { Did } from "@atcute/lexicons";
import {
	type BaseSchema,
	type InferOutput,
	safeParse,
} from "@atcute/lexicons/validations";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import {
	ComDeckbelcherCollectionList,
	ComDeckbelcherDeckList,
} from "./lexicons/index";

type AtUri = `at://${string}`;

const SLINGSHOT_BASE = "https://slingshot.microcosm.blue";
const DECK_COLLECTION = "com.deckbelcher.deck.list" as const;
const LIST_COLLECTION = "com.deckbelcher.collection.list" as const;

type Collection = typeof DECK_COLLECTION | typeof LIST_COLLECTION;

// Branded types for type safety
declare const PdsUrlBrand: unique symbol;
export type PdsUrl = string & { readonly [PdsUrlBrand]: typeof PdsUrlBrand };

declare const RkeyBrand: unique symbol;
export type Rkey = string & { readonly [RkeyBrand]: typeof RkeyBrand };

export function asPdsUrl(url: string): PdsUrl {
	return url as PdsUrl;
}

export function asRkey(rkey: string): Rkey {
	return rkey as Rkey;
}

export type Result<T, E = Error> =
	| { success: true; data: T }
	| { success: false; error: E };

export interface RecordResponse<T> {
	uri: AtUri;
	cid: string;
	value: T;
}

export interface ListRecordsResponse<T> {
	records: RecordResponse<T>[];
	cursor?: string;
}

// ============================================================================
// Generic ATProto Operations
// ============================================================================

async function getRecord<TSchema extends BaseSchema>(
	did: Did,
	rkey: Rkey,
	collection: Collection,
	entityName: string,
	schema: TSchema,
): Promise<Result<RecordResponse<InferOutput<TSchema>>>> {
	try {
		const url = new URL(`${SLINGSHOT_BASE}/xrpc/com.atproto.repo.getRecord`);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", collection);
		url.searchParams.set("rkey", rkey);

		const response = await fetch(url.toString());

		if (!response.ok) {
			const error = (await response.json().catch(() => ({}))) as {
				message?: string;
			};
			return {
				success: false,
				error: new Error(
					error.message ||
						`Failed to fetch ${entityName}: ${response.statusText}`,
				),
			};
		}

		const json = (await response.json()) as {
			uri: string;
			cid: string;
			value: unknown;
		};
		const result = safeParse(schema, json.value);
		if (!result.ok) {
			return {
				success: false,
				error: new Error(result.message),
			};
		}

		return {
			success: true,
			data: {
				uri: json.uri as AtUri,
				cid: json.cid,
				value: result.value,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

async function createRecord<T extends Record<string, unknown>>(
	agent: OAuthUserAgent,
	record: T,
	collection: Collection,
	entityName: string,
): Promise<Result<{ uri: AtUri; cid: string; rkey: Rkey }>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.createRecord", {
			input: {
				repo: agent.sub,
				collection,
				record,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || `Failed to create ${entityName} record`,
				),
			};
		}

		const uri = response.data.uri as string;
		const cid = response.data.cid as string;
		const rkey = uri.split("/").pop();
		if (!rkey) {
			return {
				success: false,
				error: new Error("Invalid URI returned from createRecord"),
			};
		}

		return {
			success: true,
			data: { uri: uri as AtUri, cid, rkey: asRkey(rkey) },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

async function updateRecord<T extends Record<string, unknown>>(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: T,
	collection: Collection,
	entityName: string,
): Promise<Result<{ uri: AtUri; cid: string }>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.putRecord", {
			input: {
				repo: agent.sub,
				collection,
				rkey,
				record,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || `Failed to update ${entityName} record`,
				),
			};
		}

		return {
			success: true,
			data: {
				uri: response.data.uri as AtUri,
				cid: response.data.cid as string,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

async function listRecords<TSchema extends BaseSchema>(
	pdsUrl: PdsUrl,
	did: Did,
	collection: Collection,
	entityName: string,
	schema: TSchema,
): Promise<Result<ListRecordsResponse<InferOutput<TSchema>>>> {
	try {
		const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", collection);

		const response = await fetch(url.toString());

		if (!response.ok) {
			const error = (await response.json().catch(() => ({}))) as {
				message?: string;
			};
			return {
				success: false,
				error: new Error(
					error.message ||
						`Failed to list ${entityName}s: ${response.statusText}`,
				),
			};
		}

		const json = (await response.json()) as {
			records: { uri: string; cid: string; value: unknown }[];
			cursor?: string;
		};

		const validatedRecords: RecordResponse<InferOutput<TSchema>>[] = [];
		for (const record of json.records) {
			const result = safeParse(schema, record.value);
			if (!result.ok) {
				return {
					success: false,
					error: new Error(result.message),
				};
			}
			validatedRecords.push({
				uri: record.uri as AtUri,
				cid: record.cid,
				value: result.value,
			});
		}

		return {
			success: true,
			data: { records: validatedRecords, cursor: json.cursor },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

async function deleteRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	collection: Collection,
	entityName: string,
): Promise<Result<void>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.deleteRecord", {
			input: {
				repo: agent.sub,
				collection,
				rkey,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || `Failed to delete ${entityName} record`,
				),
			};
		}

		return { success: true, data: undefined };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

// ============================================================================
// Deck Records
// ============================================================================

export type DeckRecordResponse = RecordResponse<ComDeckbelcherDeckList.Main>;

export function getDeckRecord(did: Did, rkey: Rkey) {
	return getRecord(
		did,
		rkey,
		DECK_COLLECTION,
		"deck",
		ComDeckbelcherDeckList.mainSchema,
	);
}

export function createDeckRecord(
	agent: OAuthUserAgent,
	record: ComDeckbelcherDeckList.Main,
) {
	return createRecord(agent, record, DECK_COLLECTION, "deck");
}

export function updateDeckRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: ComDeckbelcherDeckList.Main,
) {
	return updateRecord(agent, rkey, record, DECK_COLLECTION, "deck");
}

export function listUserDecks(pdsUrl: PdsUrl, did: Did) {
	return listRecords(
		pdsUrl,
		did,
		DECK_COLLECTION,
		"deck",
		ComDeckbelcherDeckList.mainSchema,
	);
}

export function deleteDeckRecord(agent: OAuthUserAgent, rkey: Rkey) {
	return deleteRecord(agent, rkey, DECK_COLLECTION, "deck");
}

// ============================================================================
// Collection List Records
// ============================================================================

export type CollectionListRecordResponse =
	RecordResponse<ComDeckbelcherCollectionList.Main>;

export function getCollectionListRecord(did: Did, rkey: Rkey) {
	return getRecord(
		did,
		rkey,
		LIST_COLLECTION,
		"list",
		ComDeckbelcherCollectionList.mainSchema,
	);
}

export function createCollectionListRecord(
	agent: OAuthUserAgent,
	record: ComDeckbelcherCollectionList.Main,
) {
	return createRecord(agent, record, LIST_COLLECTION, "list");
}

export function updateCollectionListRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: ComDeckbelcherCollectionList.Main,
) {
	return updateRecord(agent, rkey, record, LIST_COLLECTION, "list");
}

export function listUserCollectionLists(pdsUrl: PdsUrl, did: Did) {
	return listRecords(
		pdsUrl,
		did,
		LIST_COLLECTION,
		"list",
		ComDeckbelcherCollectionList.mainSchema,
	);
}

export function deleteCollectionListRecord(agent: OAuthUserAgent, rkey: Rkey) {
	return deleteRecord(agent, rkey, LIST_COLLECTION, "list");
}
