/**
 * TanStack Query definitions for UFOs API
 * Fetches recent records from the ATProto firehose
 */

import { safeParse } from "@atcute/lexicons/validations";
import { queryOptions } from "@tanstack/react-query";
import type { Result } from "./atproto-client";
import { transformListRecord } from "./collection-list-queries";
import { COLLECTION_LIST_NSID, DECK_LIST_NSID } from "./constellation-client";
import { transformDeckRecord } from "./deck-queries";
import {
	ComDeckbelcherCollectionList,
	ComDeckbelcherDeckList,
} from "./lexicons/index";
import type {
	ActivityCollection,
	UfosDeckRecord,
	UfosListRecord,
	UfosRecord,
} from "./ufos-types";

const UFOS_BASE = "https://ufos-api.microcosm.blue";

/**
 * Fetch recent records from UFOs API
 */
async function fetchRecentRecords(
	collections: ActivityCollection | ActivityCollection[],
	limit: number,
): Promise<Result<UfosRecord[]>> {
	try {
		const url = new URL(`${UFOS_BASE}/records`);
		const collectionParam = Array.isArray(collections)
			? collections.join(",")
			: collections;
		url.searchParams.set("collection", collectionParam);
		url.searchParams.set("limit", String(limit));

		const response = await fetch(url.toString());

		if (!response.ok) {
			return {
				success: false,
				error: new Error(`UFOs API error: ${response.statusText}`),
			};
		}

		const data = (await response.json()) as UfosRecord[];
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
	return record.collection === DECK_LIST_NSID;
}

export function isListRecord(record: ActivityRecord): record is UfosListRecord {
	return record.collection === COLLECTION_LIST_NSID;
}

function transformActivityRecord(rawRecord: UfosRecord): ActivityRecord | null {
	if (rawRecord.collection === DECK_LIST_NSID) {
		const validation = safeParse(
			ComDeckbelcherDeckList.mainSchema,
			rawRecord.record,
		);
		if (!validation.ok) {
			console.warn(
				`Skipping invalid deck record ${rawRecord.did}/${rawRecord.rkey}: ${validation.message}`,
			);
			return null;
		}
		return {
			...rawRecord,
			collection: DECK_LIST_NSID,
			record: transformDeckRecord(validation.value),
		};
	}

	if (rawRecord.collection === COLLECTION_LIST_NSID) {
		const validation = safeParse(
			ComDeckbelcherCollectionList.mainSchema,
			rawRecord.record,
		);
		if (!validation.ok) {
			console.warn(
				`Skipping invalid list record ${rawRecord.did}/${rawRecord.rkey}: ${validation.message}`,
			);
			return null;
		}
		return {
			...rawRecord,
			collection: COLLECTION_LIST_NSID,
			record: transformListRecord(validation.value),
		};
	}

	return null;
}

/**
 * Query options for recent activity (decks + lists)
 */
export const recentActivityQueryOptions = (limit = 10) =>
	queryOptions({
		queryKey: ["ufos", "recentActivity", limit] as const,
		queryFn: async (): Promise<ActivityRecord[]> => {
			const result = await fetchRecentRecords(
				[DECK_LIST_NSID, COLLECTION_LIST_NSID],
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
