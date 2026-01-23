/**
 * Utilities for optimistic updates in TanStack Query mutations
 * Each function returns a thunk that performs the update and returns a rollback
 */

import type {
	InfiniteData,
	QueryClient,
	QueryKey,
} from "@tanstack/react-query";
import type { BacklinkRecord, BacklinksResponse } from "./constellation-client";

export type Rollback = () => void;
export type OptimisticUpdate = () => Promise<Rollback>;

/**
 * Combine multiple rollback functions into one
 * Executes in reverse order (last update rolled back first)
 */
export function combineRollbacks(rollbacks: Rollback[]): Rollback {
	return () => {
		for (let i = rollbacks.length - 1; i >= 0; i--) {
			rollbacks[i]();
		}
	};
}

/**
 * Run multiple optimistic updates sequentially and combine their rollbacks
 * Updates run in order, rollbacks execute in reverse order
 */
export async function runOptimistic(
	updates: OptimisticUpdate[],
): Promise<Rollback> {
	const rollbacks: Rollback[] = [];
	for (const update of updates) {
		rollbacks.push(await update());
	}
	return combineRollbacks(rollbacks);
}

/**
 * No-op update for use in ternaries
 * Example: condition ? optimisticFoo(...) : skip()
 */
export function skip(): OptimisticUpdate {
	return () => Promise.resolve(() => {});
}

/**
 * Conditionally run an update only if value is truthy
 * Passes the narrowed value to the update factory
 */
export function when<T>(
	value: T | null | undefined | false,
	update: (value: T) => OptimisticUpdate,
): OptimisticUpdate {
	if (!value) return skip();
	return update(value);
}

/**
 * Cancel queries and snapshot current value before optimistic update
 */
async function prepareOptimisticUpdate<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
): Promise<T | undefined> {
	await queryClient.cancelQueries({ queryKey });
	return queryClient.getQueryData<T>(queryKey);
}

/**
 * Create a rollback function that properly handles undefined previous values
 * setQueryData(key, undefined) doesn't clear the entry, so we use removeQueries instead
 */
function createRollback<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	previous: T | undefined,
): Rollback {
	return () => {
		if (previous === undefined) {
			queryClient.removeQueries({ queryKey, exact: true });
		} else {
			queryClient.setQueryData<T>(queryKey, previous);
		}
	};
}

/**
 * Optimistically toggle a boolean value
 * Can accept a closure that receives queryClient and returns:
 * - boolean: set to that value
 * - undefined: skip the update (no-op rollback)
 */
export function optimisticBoolean(
	queryClient: QueryClient,
	queryKey: QueryKey,
	newValue: boolean | ((qc: QueryClient) => boolean | undefined),
): OptimisticUpdate {
	return async () => {
		const previous = await prepareOptimisticUpdate<boolean>(
			queryClient,
			queryKey,
		);

		const resolved =
			typeof newValue === "function" ? newValue(queryClient) : newValue;

		if (resolved === undefined) {
			return () => {};
		}

		queryClient.setQueryData<boolean>(queryKey, resolved);
		return createRollback(queryClient, queryKey, previous);
	};
}

/**
 * Optimistically update a count (increment or decrement)
 * Clamps to 0 minimum
 */
export function optimisticCount(
	queryClient: QueryClient,
	queryKey: QueryKey,
	delta: number,
): OptimisticUpdate {
	return async () => {
		const previous = await prepareOptimisticUpdate<number>(
			queryClient,
			queryKey,
		);
		queryClient.setQueryData<number>(queryKey, (old) =>
			Math.max(0, (old ?? 0) + delta),
		);
		return createRollback(queryClient, queryKey, previous);
	};
}

/**
 * Optimistically toggle a boolean and its associated count together
 * Common pattern for like/save operations
 */
export function optimisticToggle(
	queryClient: QueryClient,
	boolKey: QueryKey,
	countKey: QueryKey,
	newBoolValue: boolean,
): OptimisticUpdate {
	return async () => {
		const boolRollback = await optimisticBoolean(
			queryClient,
			boolKey,
			newBoolValue,
		)();
		const countRollback = await optimisticCount(
			queryClient,
			countKey,
			newBoolValue ? 1 : -1,
		)();
		return combineRollbacks([boolRollback, countRollback]);
	};
}

/**
 * Optimistically add or remove a record from a backlinks infinite query
 * Adds to first page (if cache exists), removes from any page.
 * Does NOT seed empty cache - that would show incomplete data when the query is first fetched.
 */
export function optimisticBacklinks(
	queryClient: QueryClient,
	queryKey: QueryKey,
	op: "add" | "remove",
	record: BacklinkRecord,
): OptimisticUpdate {
	return async () => {
		const previous = await prepareOptimisticUpdate<
			InfiniteData<BacklinksResponse>
		>(queryClient, queryKey);

		queryClient.setQueryData<InfiniteData<BacklinksResponse>>(
			queryKey,
			(old) => {
				// Don't modify cache if it doesn't exist - let the query fetch real data
				if (!old) return old;

				if (op === "remove") {
					return {
						...old,
						pages: old.pages.map((page, i) =>
							i === 0
								? {
										...page,
										total: Math.max(0, page.total - 1),
										records: page.records.filter(
											(r) =>
												!(
													r.did === record.did &&
													r.collection === record.collection &&
													r.rkey === record.rkey
												),
										),
									}
								: page,
						),
					};
				}

				// Add to first page
				return {
					...old,
					pages: old.pages.map((page, i) =>
						i === 0
							? {
									...page,
									total: page.total + 1,
									records: [record, ...page.records],
								}
							: page,
					),
				};
			},
		);

		return createRollback(queryClient, queryKey, previous);
	};
}

/**
 * Optimistically update a single record in the cache
 */
export function optimisticRecord<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	updater: T | ((old: T | undefined) => T | undefined),
): OptimisticUpdate {
	return async () => {
		const previous = await prepareOptimisticUpdate<T>(queryClient, queryKey);

		if (typeof updater === "function") {
			queryClient.setQueryData<T>(
				queryKey,
				updater as (old: T | undefined) => T | undefined,
			);
		} else {
			queryClient.setQueryData<T>(queryKey, updater);
		}

		return createRollback(queryClient, queryKey, previous);
	};
}

/**
 * Page shape for record list infinite queries (decks, lists, etc.)
 */
export interface RecordPage<T> {
	records: Array<{ uri: string; cid: string; value: T }>;
	cursor?: string;
}

/**
 * Optimistically update a record in an infinite query by URI match
 * Used when you have both a single record query and a list query containing it
 */
export function optimisticInfiniteRecord<T>(
	queryClient: QueryClient,
	queryKey: QueryKey,
	uriSuffix: string,
	newValue: T,
): OptimisticUpdate {
	return async () => {
		const previous = await prepareOptimisticUpdate<InfiniteData<RecordPage<T>>>(
			queryClient,
			queryKey,
		);

		queryClient.setQueryData<InfiniteData<RecordPage<T>>>(queryKey, (old) => {
			if (!old) return old;
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					records: page.records.map((record) =>
						record.uri.endsWith(uriSuffix)
							? { ...record, value: newValue }
							: record,
					),
				})),
			};
		});

		return createRollback(queryClient, queryKey, previous);
	};
}

/**
 * Optimistically update both a single record and its entry in an infinite list
 * Common pattern for repo record mutations
 */
export function optimisticRecordWithIndex<T>(
	queryClient: QueryClient,
	recordKey: QueryKey,
	indexKey: QueryKey,
	rkey: string,
	newValue: T,
): OptimisticUpdate {
	return async () => {
		const recordRollback = await optimisticRecord(
			queryClient,
			recordKey,
			newValue,
		)();
		const indexRollback = await optimisticInfiniteRecord(
			queryClient,
			indexKey,
			`/${rkey}`,
			newValue,
		)();
		return combineRollbacks([recordRollback, indexRollback]);
	};
}
