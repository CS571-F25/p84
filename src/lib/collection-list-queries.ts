/**
 * TanStack Query integration for collection list operations
 * Provides query options and mutations for saving cards/decks to lists
 */

import type { Did } from "@atcute/lexicons";
import {
	infiniteQueryOptions,
	queryOptions,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	asPdsUrl,
	createCollectionListRecord,
	deleteCollectionListRecord,
	getCollectionListRecord,
	listUserCollectionLists,
	type Rkey,
	updateCollectionListRecord,
} from "./atproto-client";
import {
	type CollectionList,
	isCardItem,
	isDeckItem,
	type ListItem,
} from "./collection-list-types";
import { getPdsForDid } from "./identity";
import type { ComDeckbelcherCollectionList } from "./lexicons/index";
import {
	parseOracleUri,
	parseScryfallUri,
	toOracleUri,
	toScryfallUri,
} from "./scryfall-types";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

function assertHasType<T extends { $type?: string }>(
	item: T,
): asserts item is T & { $type: string } {
	if (!item.$type) throw new Error("Item missing $type discriminator");
}

/**
 * Transform lexicon list record to app CollectionList type
 * Parses ref URIs to typed IDs at the boundary
 */
export function transformListRecord(
	record: ComDeckbelcherCollectionList.Main,
): CollectionList {
	return {
		...record,
		items: record.items.map((item): ListItem => {
			assertHasType(item);
			if (item.$type === "com.deckbelcher.collection.list#cardItem") {
				const scryfallId = parseScryfallUri(item.ref.scryfallUri);
				const oracleId = parseOracleUri(item.ref.oracleUri);

				if (!scryfallId || !oracleId) {
					throw new Error(
						`Invalid card ref URIs: ${item.ref.scryfallUri}, ${item.ref.oracleUri}`,
					);
				}

				const { ref: _ref, ...rest } = item;
				return { ...rest, scryfallId, oracleId };
			}
			if (item.$type === "com.deckbelcher.collection.list#deckItem") {
				return item;
			}
			throw new Error(
				`Unknown list item type: ${(item as { $type?: string }).$type}`,
			);
		}),
	};
}

/**
 * Query options for fetching a single collection list
 */
export const getCollectionListQueryOptions = (did: Did, rkey: Rkey) =>
	queryOptions({
		queryKey: ["collection-list", did, rkey] as const,
		queryFn: async (): Promise<CollectionList> => {
			const result = await getCollectionListRecord(did, rkey);
			if (!result.success) {
				throw result.error;
			}
			return transformListRecord(result.data.value);
		},
		staleTime: 30 * 1000,
	});

export interface CollectionListRecord {
	uri: string;
	cid: string;
	value: CollectionList;
}

/**
 * Query options for listing all collection lists for a user
 */
export const listUserCollectionListsQueryOptions = (did: Did) =>
	infiniteQueryOptions({
		queryKey: ["collection-lists", did] as const,
		queryFn: async ({
			pageParam,
		}): Promise<{ records: CollectionListRecord[]; cursor?: string }> => {
			const pds = await getPdsForDid(did);
			const result = await listUserCollectionLists(
				asPdsUrl(pds),
				did,
				pageParam,
			);
			if (!result.success) {
				throw result.error;
			}
			return {
				records: result.data.records.map((record) => ({
					uri: record.uri,
					cid: record.cid,
					value: transformListRecord(record.value),
				})),
				cursor: result.data.cursor,
			};
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor,
		staleTime: 60 * 1000,
	});

/**
 * Mutation for creating a new collection list
 */
export function useCreateCollectionListMutation() {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async (list: { name: string }) => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to create a list");
			}

			const result = await createCollectionListRecord(agent, {
				$type: "com.deckbelcher.collection.list",
				name: list.name,
				items: [],
				createdAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onSuccess: () => {
			toast.success("List created");

			if (!session) return;

			queryClient.invalidateQueries({
				queryKey: ["collection-lists", session.info.sub],
			});

			// TODO: Navigate to list detail page once route exists
		},
	});
}

/**
 * Mutation for updating a collection list
 * Caller provides full new list state (with items array already updated)
 */
export function useUpdateCollectionListMutation(did: Did, rkey: Rkey) {
	const { agent } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async (list: CollectionList) => {
			if (!agent) {
				throw new Error("Must be authenticated to update a list");
			}

			const result = await updateCollectionListRecord(agent, rkey, {
				$type: "com.deckbelcher.collection.list",
				name: list.name,
				description: list.description,
				items: list.items.map((item) => {
					if (isCardItem(item)) {
						const { scryfallId, oracleId, ...rest } = item;
						const result = {
							...rest,
							ref: {
								scryfallUri: toScryfallUri(scryfallId),
								oracleUri: toOracleUri(oracleId),
							},
						};
						assertHasType(result);
						return result;
					}
					if (isDeckItem(item)) {
						assertHasType(item);
						return item;
					}
					throw new Error(
						`Unknown list item type: ${(item as { $type?: string }).$type}`,
					);
				}),
				createdAt: list.createdAt,
				updatedAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onMutate: async (newList) => {
			await queryClient.cancelQueries({
				queryKey: ["collection-list", did, rkey],
			});
			await queryClient.cancelQueries({
				queryKey: ["collection-lists", did],
			});

			const previousList = queryClient.getQueryData<CollectionList>([
				"collection-list",
				did,
				rkey,
			]);

			const previousLists = queryClient.getQueryData<{
				records: CollectionListRecord[];
			}>(["collection-lists", did]);

			queryClient.setQueryData<CollectionList>(
				["collection-list", did, rkey],
				newList,
			);

			if (previousLists) {
				queryClient.setQueryData<{ records: CollectionListRecord[] }>(
					["collection-lists", did],
					{
						...previousLists,
						records: previousLists.records.map((record) =>
							record.uri.endsWith(`/${rkey}`)
								? { ...record, value: newList }
								: record,
						),
					},
				);
			}

			return { previousList, previousLists };
		},
		onError: (_err, _newList, context) => {
			if (context?.previousList) {
				queryClient.setQueryData<CollectionList>(
					["collection-list", did, rkey],
					context.previousList,
				);
			}
			if (context?.previousLists) {
				queryClient.setQueryData<{ records: CollectionListRecord[] }>(
					["collection-lists", did],
					context.previousLists,
				);
			}
			queryClient.invalidateQueries({
				queryKey: ["collection-list", did, rkey],
			});
			queryClient.invalidateQueries({
				queryKey: ["collection-lists", did],
			});
		},
	});
}

/**
 * Mutation for deleting a collection list
 */
export function useDeleteCollectionListMutation(rkey: Rkey) {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutationWithToast({
		mutationFn: async () => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to delete a list");
			}

			const result = await deleteCollectionListRecord(agent, rkey);

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onSuccess: () => {
			toast.success("List deleted");

			if (!session) return;

			queryClient.invalidateQueries({
				queryKey: ["collection-lists", session.info.sub],
			});

			navigate({
				to: "/profile/$did",
				params: { did: session.info.sub },
			});
		},
		errorMessage: "Failed to delete list",
	});
}
