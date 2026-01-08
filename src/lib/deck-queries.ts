/**
 * TanStack Query integration for deck operations
 * Provides query options and mutations with optimistic updates
 */

import type { Did } from "@atcute/lexicons";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	asPdsUrl,
	createDeckRecord,
	deleteDeckRecord,
	getDeckRecord,
	type ListRecordsResponse,
	listUserDecks,
	type Rkey,
	updateDeckRecord,
} from "./atproto-client";
import type { Deck } from "./deck-types";
import { getPdsForDid } from "./identity";
import { asScryfallId } from "./scryfall-types";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

/**
 * Query options for fetching a single deck
 * Uses Slingshot for cached reads
 */
export const getDeckQueryOptions = (did: Did, rkey: Rkey) =>
	queryOptions({
		queryKey: ["deck", did, rkey] as const,
		queryFn: async (): Promise<Deck> => {
			const result = await getDeckRecord(did, rkey);
			if (!result.success) {
				throw result.error;
			}

			// Map DeckRecordResponse to Deck type with branded ScryfallId
			return {
				...result.data.value,
				cards: result.data.value.cards.map((card) => ({
					...card,
					scryfallId: asScryfallId(card.scryfallId),
				})),
			};
		},
		staleTime: 30 * 1000, // 30 seconds - balance between freshness and cache hits
	});

/**
 * Query options for listing all decks for a user
 * Fetches from user's PDS directly
 */
export const listUserDecksQueryOptions = (did: Did) =>
	queryOptions({
		queryKey: ["decks", did] as const,
		queryFn: async (): Promise<ListRecordsResponse> => {
			const pds = await getPdsForDid(did);
			const result = await listUserDecks(asPdsUrl(pds), did);
			if (!result.success) {
				throw result.error;
			}
			return result.data;
		},
		staleTime: 60 * 1000, // 1 minute
	});

/**
 * Mutation for creating a new deck
 * Navigates to the new deck on success
 */
export function useCreateDeckMutation() {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutationWithToast({
		mutationFn: async (deck: Omit<Deck, "$type" | "createdAt">) => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to create a deck");
			}

			const result = await createDeckRecord(agent, {
				$type: "com.deckbelcher.deck.list",
				...deck,
				cards: deck.cards.map((card) => ({
					...card,
					scryfallId: card.scryfallId as string,
				})),
				createdAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onSuccess: (data) => {
			if (!session) return;

			// Invalidate deck list for current user
			queryClient.invalidateQueries({
				queryKey: ["decks", session.info.sub],
			});

			// Navigate to new deck
			navigate({
				to: "/profile/$did/deck/$rkey",
				params: {
					did: session.info.sub,
					rkey: data.rkey,
				},
			});
		},
	});
}

/**
 * Mutation for updating an existing deck
 * Uses optimistic updates with rollback on error
 * Debounce this mutation at call site to batch rapid changes
 */
export function useUpdateDeckMutation(did: Did, rkey: Rkey) {
	const { agent } = useAuth();
	const queryClient = useQueryClient();

	return useMutationWithToast({
		mutationFn: async (deck: Deck) => {
			if (!agent) {
				throw new Error("Must be authenticated to update a deck");
			}

			const result = await updateDeckRecord(agent, rkey, {
				$type: "com.deckbelcher.deck.list",
				name: deck.name,
				format: deck.format,
				cards: deck.cards.map((card) => ({
					...card,
					scryfallId: card.scryfallId as string,
				})),
				primer: deck.primer,
				createdAt: deck.createdAt,
				updatedAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onMutate: async (newDeck) => {
			// Cancel outgoing refetches
			await queryClient.cancelQueries({ queryKey: ["deck", did, rkey] });

			// Snapshot previous value
			const previous = queryClient.getQueryData<Deck>(["deck", did, rkey]);

			// Optimistically update cache
			queryClient.setQueryData<Deck>(["deck", did, rkey], newDeck);

			// Return context for rollback
			return { previous };
		},
		onError: (_err, _newDeck, context) => {
			// Rollback on error and refetch
			if (context?.previous) {
				queryClient.setQueryData<Deck>(["deck", did, rkey], context.previous);
			}
			queryClient.invalidateQueries({ queryKey: ["deck", did, rkey] });
		},
		// Don't refetch on success - optimistic update is correct
		// Slingshot (cache) might be stale anyway
	});
}

/**
 * Mutation for deleting a deck
 * Invalidates deck list and navigates to profile on success
 */
export function useDeleteDeckMutation(rkey: Rkey) {
	const { agent, session } = useAuth();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutationWithToast({
		mutationFn: async () => {
			if (!agent || !session) {
				throw new Error("Must be authenticated to delete a deck");
			}

			const result = await deleteDeckRecord(agent, rkey);

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onSuccess: () => {
			toast.success("Deck deleted");

			if (!session) return;

			// Invalidate deck list for current user
			queryClient.invalidateQueries({
				queryKey: ["decks", session.info.sub],
			});

			// Navigate back to profile
			navigate({
				to: "/profile/$did",
				params: { did: session.info.sub },
			});
		},
		errorMessage: "Failed to delete deck",
	});
}
