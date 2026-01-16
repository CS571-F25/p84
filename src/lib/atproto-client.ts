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
	ComDeckbelcherSocialLike,
} from "./lexicons/index";

type AtUri = `at://${string}`;

const SLINGSHOT_BASE = "https://slingshot.microcosm.blue";

type Collection = `${string}.${string}.${string}`;

export function getCollectionFromSchema(schema: BaseSchema): Collection {
	// Schema structure: { object: { shape: { $type: { expected: "com.foo.bar" } } } }
	const schemaAny = schema as {
		object?: { shape?: { $type?: { expected?: string } } };
	};
	const collection = schemaAny.object?.shape?.$type?.expected;
	if (!collection) {
		throw new Error("Schema does not have $type.expected");
	}
	return collection as Collection;
}

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

/**
 * Parse an AT URI into its components
 * Format: at://AUTHORITY/COLLECTION/RKEY
 * - Authority: DID (did:method:identifier)
 * - Collection: NSID (com.example.foo)
 * - Rkey: Record key (alphanumeric + ._:~-)
 * @see https://atproto.com/specs/at-uri-scheme
 */
export function parseAtUri(
	uri: string,
): { did: Did; collection: string; rkey: Rkey } | null {
	// DID: did:method:method-specific-id (method lowercase, id has various chars)
	// Collection: NSID format (lowercase segments separated by dots)
	// Rkey: alphanumeric plus ._:~- (1-512 chars, not . or ..)
	const match = uri.match(
		/^at:\/\/(did:[a-z]+:[a-zA-Z0-9._:%-]+)\/([a-z][a-z0-9.-]*(?:\.[a-z][a-z0-9-]*)*)\/([a-zA-Z0-9._:~-]+)$/,
	);
	if (!match) return null;
	const rkey = match[3];
	if (rkey === "." || rkey === "..") return null;
	return {
		did: match[1] as Did,
		collection: match[2],
		rkey: asRkey(rkey),
	};
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
	schema: TSchema,
): Promise<Result<RecordResponse<InferOutput<TSchema>>>> {
	const collection = getCollectionFromSchema(schema);
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
						`Failed to fetch ${collection}: ${response.statusText}`,
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

async function createRecord<TSchema extends BaseSchema>(
	agent: OAuthUserAgent,
	record: InferOutput<TSchema>,
	schema: TSchema,
	rkey?: Rkey,
): Promise<Result<{ uri: AtUri; cid: string; rkey: Rkey }>> {
	const collection = getCollectionFromSchema(schema);
	try {
		const validation = safeParse(schema, record);
		if (!validation.ok) {
			return {
				success: false,
				error: new Error(`Invalid ${collection} record: ${validation.message}`),
			};
		}

		const client = new Client({ handler: agent });

		// Use putRecord if rkey provided (deterministic), createRecord otherwise (auto-generate)
		const response = rkey
			? await client.post("com.atproto.repo.putRecord", {
					input: {
						repo: agent.sub,
						collection,
						rkey,
						record: record as Record<string, unknown>,
					},
				})
			: await client.post("com.atproto.repo.createRecord", {
					input: {
						repo: agent.sub,
						collection,
						record: record as Record<string, unknown>,
					},
				});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || `Failed to create ${collection} record`,
				),
			};
		}

		const uri = response.data.uri as string;
		const cid = response.data.cid as string;
		const extractedRkey = uri.split("/").pop();
		if (!extractedRkey) {
			return {
				success: false,
				error: new Error("Invalid URI returned from createRecord"),
			};
		}

		return {
			success: true,
			data: { uri: uri as AtUri, cid, rkey: asRkey(extractedRkey) },
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

async function updateRecord<TSchema extends BaseSchema>(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: InferOutput<TSchema>,
	schema: TSchema,
): Promise<Result<{ uri: AtUri; cid: string }>> {
	const collection = getCollectionFromSchema(schema);
	try {
		const validation = safeParse(schema, record);
		if (!validation.ok) {
			return {
				success: false,
				error: new Error(`Invalid ${collection} record: ${validation.message}`),
			};
		}

		const client = new Client({ handler: agent });
		const response = await client.post("com.atproto.repo.putRecord", {
			input: {
				repo: agent.sub,
				collection,
				rkey,
				record: record as Record<string, unknown>,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(
					response.data.message || `Failed to update ${collection} record`,
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
	schema: TSchema,
	cursor?: string,
): Promise<Result<ListRecordsResponse<InferOutput<TSchema>>>> {
	const collection = getCollectionFromSchema(schema);
	try {
		const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", collection);
		if (cursor) {
			url.searchParams.set("cursor", cursor);
		}

		const response = await fetch(url.toString());

		if (!response.ok) {
			const error = (await response.json().catch(() => ({}))) as {
				message?: string;
			};
			return {
				success: false,
				error: new Error(
					error.message ||
						`Failed to list ${collection}: ${response.statusText}`,
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
				console.warn(
					`Skipping malformed ${collection} record ${record.uri}: ${result.message}`,
				);
				continue;
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

async function deleteRecord<TSchema extends BaseSchema>(
	agent: OAuthUserAgent,
	rkey: Rkey,
	schema: TSchema,
): Promise<Result<void>> {
	const collection = getCollectionFromSchema(schema);
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
					response.data.message || `Failed to delete ${collection} record`,
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
	return getRecord(did, rkey, ComDeckbelcherDeckList.mainSchema);
}

export function createDeckRecord(
	agent: OAuthUserAgent,
	record: ComDeckbelcherDeckList.Main,
) {
	return createRecord(agent, record, ComDeckbelcherDeckList.mainSchema);
}

export function updateDeckRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: ComDeckbelcherDeckList.Main,
) {
	return updateRecord(agent, rkey, record, ComDeckbelcherDeckList.mainSchema);
}

export function listUserDecks(pdsUrl: PdsUrl, did: Did, cursor?: string) {
	return listRecords(pdsUrl, did, ComDeckbelcherDeckList.mainSchema, cursor);
}

export function deleteDeckRecord(agent: OAuthUserAgent, rkey: Rkey) {
	return deleteRecord(agent, rkey, ComDeckbelcherDeckList.mainSchema);
}

// ============================================================================
// Collection List Records
// ============================================================================

export type CollectionListRecordResponse =
	RecordResponse<ComDeckbelcherCollectionList.Main>;

export function getCollectionListRecord(did: Did, rkey: Rkey) {
	return getRecord(did, rkey, ComDeckbelcherCollectionList.mainSchema);
}

export function createCollectionListRecord(
	agent: OAuthUserAgent,
	record: ComDeckbelcherCollectionList.Main,
) {
	return createRecord(agent, record, ComDeckbelcherCollectionList.mainSchema);
}

export function updateCollectionListRecord(
	agent: OAuthUserAgent,
	rkey: Rkey,
	record: ComDeckbelcherCollectionList.Main,
) {
	return updateRecord(
		agent,
		rkey,
		record,
		ComDeckbelcherCollectionList.mainSchema,
	);
}

export function listUserCollectionLists(
	pdsUrl: PdsUrl,
	did: Did,
	cursor?: string,
) {
	return listRecords(
		pdsUrl,
		did,
		ComDeckbelcherCollectionList.mainSchema,
		cursor,
	);
}

export function deleteCollectionListRecord(agent: OAuthUserAgent, rkey: Rkey) {
	return deleteRecord(agent, rkey, ComDeckbelcherCollectionList.mainSchema);
}

// ============================================================================
// Like Records
// ============================================================================

export type LikeRecordResponse = RecordResponse<ComDeckbelcherSocialLike.Main>;

type LikeSubject = ComDeckbelcherSocialLike.Main["subject"];

/**
 * Hash an object to a deterministic rkey using SHA-256 + base64url.
 * Full hash (43 chars) for maximum collision resistance.
 * Valid rkey chars: A-Za-z0-9.-_:~ (base64url uses A-Za-z0-9-_)
 * Sorts keys to ensure hash is independent of object key insertion order.
 */
export async function hashToRkey(obj: unknown): Promise<Rkey> {
	const json = JSON.stringify(obj, Object.keys(obj as object).sort());
	const encoder = new TextEncoder();
	const data = encoder.encode(json);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);

	const hashArray = new Uint8Array(hashBuffer);
	const base64 = btoa(String.fromCharCode(...hashArray));
	const base64url = base64
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	return asRkey(base64url);
}

export async function createLikeRecord(
	agent: OAuthUserAgent,
	subject: LikeSubject,
) {
	const rkey = await hashToRkey(subject);
	const record: ComDeckbelcherSocialLike.Main = {
		$type: "com.deckbelcher.social.like",
		subject,
		createdAt: new Date().toISOString(),
	};
	return createRecord(agent, record, ComDeckbelcherSocialLike.mainSchema, rkey);
}

export async function deleteLikeRecord(
	agent: OAuthUserAgent,
	subject: LikeSubject,
) {
	const rkey = await hashToRkey(subject);
	return deleteRecord(agent, rkey, ComDeckbelcherSocialLike.mainSchema);
}
