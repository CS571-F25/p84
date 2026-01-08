/**
 * TanStack Query integration for collection list operations
 * Provides query options and mutations for saving cards/decks to lists
 */

import type { Did } from "@atcute/lexicons";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	asPdsUrl,
	createCollectionListRecord,
	deleteCollectionListRecord,
	getCollectionListRecord,
	type ListRecordsResponse,
	listUserCollectionLists,
	type Rkey,
	updateCollectionListRecord,
} from "./atproto-client";
import type { CollectionList } from "./collection-list-types";
import { getPdsForDid } from "./identity";
import type { ComDeckbelcherCollectionList } from "./lexicons/index";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

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
			return result.data.value as CollectionList;
		},
		staleTime: 30 * 1000,
	});

/**
 * Query options for listing all collection lists for a user
 */
export const listUserCollectionListsQueryOptions = (did: Did) =>
	queryOptions({
		queryKey: ["collection-lists", did] as const,
		queryFn: async (): Promise<ListRecordsResponse<CollectionList>> => {
			const pds = await getPdsForDid(did);
			const result = await listUserCollectionLists(asPdsUrl(pds), did);
			if (!result.success) {
				throw result.error;
			}
			return result.data as ListRecordsResponse<CollectionList>;
		},
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
				items: list.items as ComDeckbelcherCollectionList.Main["items"],
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

			const previousLists = queryClient.getQueryData<
				ListRecordsResponse<CollectionList>
			>(["collection-lists", did]);

			queryClient.setQueryData<CollectionList>(
				["collection-list", did, rkey],
				newList,
			);

			if (previousLists) {
				queryClient.setQueryData<ListRecordsResponse<CollectionList>>(
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
				queryClient.setQueryData<ListRecordsResponse<CollectionList>>(
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
