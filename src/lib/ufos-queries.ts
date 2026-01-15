/**
 * TanStack Query definitions for UFOs API
 * Fetches recent records from the ATProto firehose
 */

import { queryOptions } from "@tanstack/react-query";
import type { Result } from "./atproto-client";
import { transformListRecord } from "./collection-list-queries";
import { MICROCOSM_USER_AGENT } from "./constellation-client";
import { transformDeckRecord } from "./deck-queries";
import type {
	ComDeckbelcherCollectionList,
	ComDeckbelcherDeckList,
} from "./lexicons/index";
import type {
	ActivityCollection,
	UfosDeckRecord,
	UfosListRecord,
	UfosRawDeckRecord,
	UfosRawListRecord,
	UfosRecord,
} from "./ufos-types";

const UFOS_BASE = "https://ufos-api.microcosm.blue";

/**
 * Fetch recent records from UFOs API
 */
async function fetchRecentRecords<T>(
	collections: ActivityCollection | ActivityCollection[],
	limit: number,
): Promise<Result<UfosRecord<T>[]>> {
	try {
		const url = new URL(`${UFOS_BASE}/records`);
		const collectionParam = Array.isArray(collections)
			? collections.join(",")
			: collections;
		url.searchParams.set("collection", collectionParam);
		url.searchParams.set("limit", String(limit));

		const response = await fetch(url.toString(), {
			headers: {
				Accept: "application/json",
				"User-Agent": MICROCOSM_USER_AGENT,
			},
		});

		if (!response.ok) {
			return {
				success: false,
				error: new Error(`UFOs API error: ${response.statusText}`),
			};
		}

		const data = (await response.json()) as UfosRecord<T>[];
		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error(String(error)),
		};
	}
}

export type ActivityRecord = UfosDeckRecord | UfosListRecord;

export function isDeckRecord(record: ActivityRecord): record is UfosDeckRecord {
	return record.collection === "com.deckbelcher.deck.list";
}

export function isListRecord(record: ActivityRecord): record is UfosListRecord {
	return record.collection === "com.deckbelcher.collection.list";
}

function transformActivityRecord(
	rawRecord: UfosRecord<unknown>,
): ActivityRecord | null {
	try {
		if (rawRecord.collection === "com.deckbelcher.deck.list") {
			const deckRecord = rawRecord as UfosRawDeckRecord;
			return {
				...deckRecord,
				record: transformDeckRecord(deckRecord.record),
			} as UfosDeckRecord;
		}
		if (rawRecord.collection === "com.deckbelcher.collection.list") {
			const listRecord = rawRecord as UfosRawListRecord;
			return {
				...listRecord,
				record: transformListRecord(listRecord.record),
			} as UfosListRecord;
		}
		return null;
	} catch (error) {
		console.warn(
			`Skipping malformed UFOs record ${rawRecord.did}/${rawRecord.rkey}:`,
			error instanceof Error ? error.message : error,
		);
		return null;
	}
}

/**
 * Query options for recent activity (decks + lists)
 */
export const recentActivityQueryOptions = (limit = 10) =>
	queryOptions({
		queryKey: ["ufos", "recentActivity", limit] as const,
		queryFn: async (): Promise<ActivityRecord[]> => {
			const result = await fetchRecentRecords<
				ComDeckbelcherDeckList.Main | ComDeckbelcherCollectionList.Main
			>(
				["com.deckbelcher.deck.list", "com.deckbelcher.collection.list"],
				limit,
			);
			if (!result.success) {
				throw result.error;
			}

			return result.data
				.map(transformActivityRecord)
				.filter((r): r is ActivityRecord => r !== null);
		},
		staleTime: 60 * 1000,
		refetchOnWindowFocus: true,
	});
