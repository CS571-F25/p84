/**
 * ATProto client utilities for deck record CRUD operations
 * Reads via Slingshot (cached), writes via PDS (authenticated)
 */

import type {} from "@atcute/atproto";
import { Client } from "@atcute/client";
import type { Did } from "@atcute/lexicons";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import type { ComDeckbelcherDeckList } from "./lexicons/index";

type AtUri = `at://${string}`;

const SLINGSHOT_BASE = "https://slingshot.microcosm.blue";
const COLLECTION = "com.deckbelcher.deck.list";

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

export interface DeckRecordResponse {
	uri: AtUri;
	cid: string;
	value: ComDeckbelcherDeckList.Main;
}

export interface ListRecordsResponse {
	records: DeckRecordResponse[];
	cursor?: string;
}

export type Result<T, E = Error> =
	| { success: true; data: T }
	| { success: false; error: E };

/**
 * Fetch a deck record via Slingshot (cached, public read)
 */
export async function getDeckRecord(
	did: Did,
	rkey: Rkey,
): Promise<Result<DeckRecordResponse>> {
	try {
		const url = new URL(`${SLINGSHOT_BASE}/xrpc/com.atproto.repo.getRecord`);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", COLLECTION);
		url.searchParams.set("rkey", rkey);

		const response = await fetch(url.toString());

		if (!response.ok) {
			const error = (await response.json().catch(() => ({}))) as {
				message?: string;
			};
			return {
				success: false,
				error: new Error(
					error.message || `Failed to fetch deck: ${response.statusText}`,
				),
			};
		}

		const data = (await response.json()) as DeckRecordResponse;
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Create a new deck record (authenticated write to PDS)
 */
export async function createDeckRecord(
	agent: OAuthUserAgent,
	record: ComDeckbelcherDeckList.Main,
): Promise<Result<{ uri: AtUri; cid: string; rkey: Rkey }>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.createRecord", {
			input: {
				repo: agent.sub,
				collection: COLLECTION,
				record,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || "Failed to create deck record",
				),
			};
		}

		// Extract rkey from the URI (at://did:plc:.../collection/rkey)
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

/**
 * Update an existing deck record (authenticated write to PDS)
 */
export async function updateDeckRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: ComDeckbelcherDeckList.Main,
): Promise<Result<{ uri: AtUri; cid: string }>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.putRecord", {
			input: {
				repo: agent.sub,
				collection: COLLECTION,
				rkey,
				record,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || "Failed to update deck record",
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

/**
 * List all deck records for a user (direct PDS call)
 * Requires PDS URL for the target user
 */
export async function listUserDecks(
	pdsUrl: PdsUrl,
	did: Did,
): Promise<Result<ListRecordsResponse>> {
	try {
		const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", COLLECTION);

		const response = await fetch(url.toString());

		if (!response.ok) {
			const error = (await response.json().catch(() => ({}))) as {
				message?: string;
			};
			return {
				success: false,
				error: new Error(
					error.message || `Failed to list decks: ${response.statusText}`,
				),
			};
		}

		const data = (await response.json()) as ListRecordsResponse;
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Delete a deck record (authenticated write to PDS)
 */
export async function deleteDeckRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
): Promise<Result<void>> {
	try {
		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.deleteRecord", {
			input: {
				repo: agent.sub,
				collection: COLLECTION,
				rkey,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || "Failed to delete deck record",
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
