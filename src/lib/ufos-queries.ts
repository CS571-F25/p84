/**
 * TanStack Query definitions for UFOs API
 * Fetches recent records from the ATProto firehose
 */

import { queryOptions } from "@tanstack/react-query";
import type { Result } from "./atproto-client";
import type {
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

		const response = await fetch(url.toString());

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

/**
 * Query options for recent activity (decks + lists)
 */
export const recentActivityQueryOptions = (limit = 10) =>
	queryOptions({
		queryKey: ["ufos", "recentActivity", limit] as const,
		queryFn: async () => {
			const result = await fetchRecentRecords<
				ComDeckbelcherDeckList.Main | ComDeckbelcherCollectionList.Main
			>(
				["com.deckbelcher.deck.list", "com.deckbelcher.collection.list"],
				limit,
			);
			if (!result.success) {
				throw result.error;
			}
			return result.data as ActivityRecord[];
		},
		staleTime: 60 * 1000,
		refetchOnWindowFocus: true,
	});
