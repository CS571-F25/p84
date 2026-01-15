/**
 * API client for Constellation backlink indexer
 * See .claude/CONSTELLATION.md for full API documentation
 */

import type { Result } from "./atproto-client";

const CONSTELLATION_BASE = "https://constellation.microcosm.blue";
export const MICROCOSM_USER_AGENT = "deckbelcher.com by @aviva.gay";

// Path constants for DeckBelcher collections
// Constellation includes $type in paths for union array elements
// Use oracleUri for card aggregation (counts across printings)
export const COLLECTION_LIST_CARD_PATH =
	".items[com.deckbelcher.collection.list#cardItem].ref.oracleUri";
export const COLLECTION_LIST_DECK_PATH =
	".items[com.deckbelcher.collection.list#deckItem].ref.uri";
// Future: cards in decks (also uses oracleUri for aggregation)
export const DECK_LIST_CARD_PATH = ".cards[].ref.oracleUri";

// Like paths (subject is a union, so includes $type in path)
export const LIKE_CARD_PATH =
	".subject[com.deckbelcher.social.like#cardSubject].ref.oracleUri";
export const LIKE_RECORD_PATH =
	".subject[com.deckbelcher.social.like#recordSubject].ref.uri";

export const COLLECTION_LIST_NSID = "com.deckbelcher.collection.list";
export const DECK_LIST_NSID = "com.deckbelcher.deck.list";
export const LIKE_NSID = "com.deckbelcher.social.like";

export interface BacklinkRecord {
	uri: string;
	cid: string;
	did: string;
	indexedAt: string;
}

export interface BacklinksResponse {
	total: number;
	records: BacklinkRecord[];
	cursor?: string;
}

export interface CountResponse {
	total: number;
}

export interface GetBacklinksParams {
	subject: string;
	source: string;
	did?: string;
	limit?: number;
}

export interface GetLinksCountParams {
	target: string;
	collection: string;
	path: string;
}

/**
 * Get records that link to a target
 */
export async function getBacklinks(
	params: GetBacklinksParams,
): Promise<Result<BacklinksResponse>> {
	try {
		const url = new URL(
			`${CONSTELLATION_BASE}/xrpc/blue.microcosm.links.getBacklinks`,
		);
		url.searchParams.set("subject", params.subject);
		url.searchParams.set("source", params.source);
		if (params.did) {
			url.searchParams.set("did", params.did);
		}
		if (params.limit !== undefined) {
			url.searchParams.set("limit", String(params.limit));
		}

		const response = await fetch(url.toString(), {
			headers: {
				Accept: "application/json",
				"User-Agent": MICROCOSM_USER_AGENT,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(`Constellation API error: ${response.statusText}`),
			};
		}

		const data = (await response.json()) as BacklinksResponse;
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Get count of records linking to a target
 */
export async function getLinksCount(
	params: GetLinksCountParams,
): Promise<Result<CountResponse>> {
	try {
		const url = new URL(`${CONSTELLATION_BASE}/links/count`);
		url.searchParams.set("target", params.target);
		url.searchParams.set("collection", params.collection);
		url.searchParams.set("path", params.path);

		const response = await fetch(url.toString(), {
			headers: {
				Accept: "application/json",
				"User-Agent": MICROCOSM_USER_AGENT,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(`Constellation API error: ${response.statusText}`),
			};
		}

		const data = (await response.json()) as CountResponse;
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

/**
 * Build the source string for getBacklinks
 * Format: collection:path (without leading dot)
 * Note: getBacklinks expects path WITHOUT leading dot, but /links/count expects WITH leading dot
 */
export function buildSource(collection: string, path: string): string {
	const pathWithoutDot = path.startsWith(".") ? path.slice(1) : path;
	return `${collection}:${pathWithoutDot}`;
}
