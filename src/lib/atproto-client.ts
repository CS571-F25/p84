/**
 * ATProto client utilities for deck record CRUD operations
 * Reads via Slingshot (cached), writes via PDS (authenticated)
 */

import type { At, Did } from "@atcute/lexicons";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import type { ComDeckbelcherDeckList } from "./lexicons/index";

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
	uri: At.Uri;
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
			const error = await response.json().catch(() => ({}));
			return {
				success: false,
				error: new Error(
					error.message || `Failed to fetch deck: ${response.statusText}`,
				),
			};
		}

		const data = await response.json();
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
): Promise<Result<{ uri: At.Uri; cid: string; rkey: Rkey }>> {
	try {
		const response = await agent.rpc.call("com.atproto.repo.createRecord", {
			data: {
				repo: agent.did,
				collection: COLLECTION,
				record,
			},
		});

		if (!response.success) {
			return {
				success: false,
				error: new Error("Failed to create deck record"),
			};
		}

		// Extract rkey from the URI (at://did:plc:.../collection/rkey)
		const uri = response.data.uri;
		const rkey = uri.split("/").pop();
		if (!rkey) {
			return {
				success: false,
				error: new Error("Invalid URI returned from createRecord"),
			};
		}

		return {
			success: true,
			data: { ...response.data, rkey: asRkey(rkey) },
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
): Promise<Result<{ uri: At.Uri; cid: string }>> {
	try {
		const response = await agent.rpc.call("com.atproto.repo.putRecord", {
			data: {
				repo: agent.did,
				collection: COLLECTION,
				rkey,
				record,
			},
		});

		if (!response.success) {
			return {
				success: false,
				error: new Error("Failed to update deck record"),
			};
		}

		return { success: true, data: response.data };
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
			const error = await response.json().catch(() => ({}));
			return {
				success: false,
				error: new Error(
					error.message || `Failed to list decks: ${response.statusText}`,
				),
			};
		}

		const data = await response.json();
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
		const response = await agent.rpc.call("com.atproto.repo.deleteRecord", {
			data: {
				repo: agent.did,
				collection: COLLECTION,
				rkey,
			},
		});

		if (!response.success) {
			return {
				success: false,
				error: new Error("Failed to delete deck record"),
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
