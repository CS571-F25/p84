/**
 * TanStack Query definitions for UFOs API
 * Fetches recent records from the ATProto firehose
 */

import { queryOptions } from "@tanstack/react-query";
import type { Result } from "./atproto-client";
import type { ComDeckbelcherDeckList } from "./lexicons/index";
import type {
	ActivityCollection,
	UfosDeckRecord,
	UfosRecord,
} from "./ufos-types";

const UFOS_BASE = "https://ufos-api.microcosm.blue";

/**
 * Fetch recent records from UFOs API
 */
async function fetchRecentRecords<T>(
	collection: ActivityCollection,
	limit: number,
): Promise<Result<UfosRecord<T>[]>> {
	try {
		const url = new URL(`${UFOS_BASE}/records`);
		url.searchParams.set("collection", collection);
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

/**
 * Query options for recent deck activity
 */
export const recentDecksQueryOptions = (limit = 10) =>
	queryOptions({
		queryKey: ["ufos", "recentDecks", limit] as const,
		queryFn: async () => {
			const result = await fetchRecentRecords<ComDeckbelcherDeckList.Main>(
				"com.deckbelcher.deck.list",
				limit,
			);
			if (!result.success) {
				throw result.error;
			}
			return result.data as UfosDeckRecord[];
		},
		staleTime: 60 * 1000, // 1 minute
		refetchOnWindowFocus: true,
	});
