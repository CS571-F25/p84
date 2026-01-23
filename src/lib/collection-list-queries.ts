/**
 * TanStack Query integration for collection list operations
 * Provides query options and mutations for saving cards/decks to lists
 */

import type { Did, ResourceUri } from "@atcute/lexicons";
import {
	type InfiniteData,
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
	addCardToList,
	addDeckToList,
	type CollectionList,
	hasCard,
	hasDeck,
	isCardItem,
	isDeckItem,
	type ListItem,
	removeCardFromList,
	removeDeckFromList,
} from "./collection-list-types";
import {
	type BacklinksResponse,
	COLLECTION_LIST_NSID,
} from "./constellation-client";
import { getConstellationQueryKeys } from "./constellation-queries";
import { getPdsForDid } from "./identity";
import type { ComDeckbelcherCollectionList } from "./lexicons/index";
import {
	optimisticBacklinks,
	optimisticBoolean,
	optimisticCount,
	optimisticRecordWithIndex,
	runOptimistic,
} from "./optimistic-utils";
import {
	parseOracleUri,
	parseScryfallUri,
	toOracleUri,
	toScryfallUri,
} from "./scryfall-types";
import type { SaveableItem } from "./social-item-types";
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

interface CreateListParams {
	name: string;
	initialItem?: SaveableItem;
}

/**
 * Mutation for creating a new collection list
 * Optionally adds an initial item to the list
 */
export function useCreateCollectionListMutation() {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async ({ name, initialItem }: CreateListParams) => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to create a list");
			}

			const items: ComDeckbelcherCollectionList.Main["items"] = [];
			if (initialItem) {
				const addedAt = new Date().toISOString();
				if (initialItem.type === "card") {
					items.push({
						$type: "com.deckbelcher.collection.list#cardItem",
						addedAt,
						ref: {
							scryfallUri: toScryfallUri(initialItem.scryfallId),
							oracleUri: toOracleUri(initialItem.oracleId),
						},
					});
				} else {
					items.push({
						$type: "com.deckbelcher.collection.list#deckItem",
						addedAt,
						ref: {
							uri: initialItem.uri as ResourceUri,
							cid: initialItem.cid,
						},
					});
				}
			}

			const result = await createCollectionListRecord(agent, {
				$type: "com.deckbelcher.collection.list",
				name,
				items,
				createdAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onSuccess: (_data, { initialItem }) => {
			toast.success(
				initialItem ? "List created and item saved" : "List created",
			);

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
			const rollback = await runOptimistic([
				optimisticRecordWithIndex<CollectionList>(
					queryClient,
					["collection-list", did, rkey],
					["collection-lists", did],
					rkey,
					newList,
				),
			]);
			return { rollback };
		},
		onError: (_err, _newList, context) => {
			context?.rollback();
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

interface ToggleListItemParams {
	list: CollectionList;
	item: SaveableItem;
	itemName?: string;
}

/**
 * Mutation for toggling an item in a collection list (add/remove)
 * Handles optimistic updates for constellation queries
 */
export function useToggleListItemMutation(did: Did, rkey: Rkey) {
	const { agent } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async ({ list, item }: ToggleListItemParams) => {
			if (!agent) {
				throw new Error("Must be authenticated to update a list");
			}

			const isSaved =
				item.type === "card"
					? hasCard(list, item.scryfallId)
					: hasDeck(list, item.uri);

			const updatedList = isSaved
				? item.type === "card"
					? removeCardFromList(list, item.scryfallId)
					: removeDeckFromList(list, item.uri)
				: item.type === "card"
					? addCardToList(list, item.scryfallId, item.oracleId)
					: addDeckToList(list, item.uri, item.cid);

			const result = await updateCollectionListRecord(agent, rkey, {
				$type: "com.deckbelcher.collection.list",
				name: updatedList.name,
				description: updatedList.description,
				items: updatedList.items.map((listItem) => {
					if (isCardItem(listItem)) {
						const { scryfallId, oracleId, ...rest } = listItem;
						const mapped = {
							...rest,
							ref: {
								scryfallUri: toScryfallUri(scryfallId),
								oracleUri: toOracleUri(oracleId),
							},
						};
						assertHasType(mapped);
						return mapped;
					}
					if (isDeckItem(listItem)) {
						assertHasType(listItem);
						return listItem;
					}
					throw new Error(
						`Unknown list item type: ${(listItem as { $type?: string }).$type}`,
					);
				}),
				createdAt: updatedList.createdAt,
				updatedAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return { ...result.data, wasSaved: isSaved };
		},
		onMutate: async ({ list, item }: ToggleListItemParams) => {
			const isSaved =
				item.type === "card"
					? hasCard(list, item.scryfallId)
					: hasDeck(list, item.uri);

			const updatedList = isSaved
				? item.type === "card"
					? removeCardFromList(list, item.scryfallId)
					: removeDeckFromList(list, item.uri)
				: item.type === "card"
					? addCardToList(list, item.scryfallId, item.oracleId)
					: addDeckToList(list, item.uri, item.cid);

			const itemUri =
				item.type === "card"
					? toOracleUri(item.oracleId)
					: (item.uri as `at://${string}`);
			const keys = getConstellationQueryKeys(itemUri, did);
			const newSavedState = !isSaved;

			const rollback = await runOptimistic([
				optimisticRecordWithIndex<CollectionList>(
					queryClient,
					["collection-list", did, rkey],
					["collection-lists", did],
					rkey,
					updatedList,
				),
				optimisticBoolean(queryClient, keys.userSaved, (qc) => {
					if (newSavedState) return true;
					// Removing - only set false if no other lists from this user have item
					const data = qc.getQueryData<InfiniteData<BacklinksResponse>>(
						keys.savers,
					);
					if (!data) return undefined; // cache miss - skip
					const hasOtherLists = data.pages.some((page) =>
						page.records.some((r) => r.did === did && r.rkey !== rkey),
					);
					return hasOtherLists ? undefined : false;
				}),
				optimisticCount(queryClient, keys.saveCount, newSavedState ? 1 : -1),
				optimisticBacklinks(
					queryClient,
					keys.savers,
					newSavedState ? "add" : "remove",
					{ did, collection: COLLECTION_LIST_NSID, rkey },
				),
			]);

			return { rollback, isSaved };
		},
		onError: (_err, _params, context) => {
			context?.rollback();
		},
		onSuccess: (data, { list, itemName, item }) => {
			const what = itemName ?? (item.type === "card" ? "Card" : "Deck");
			if (data.wasSaved) {
				toast.success(`Removed ${what} from ${list.name}`);
			} else {
				toast.success(`Saved ${what} to ${list.name}`);
			}
		},
	});
}
