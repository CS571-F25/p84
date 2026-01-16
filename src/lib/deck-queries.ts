/**
 * TanStack Query integration for deck operations
 * Provides query options and mutations with optimistic updates
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
	createDeckRecord,
	deleteDeckRecord,
	getDeckRecord,
	listUserDecks,
	type Rkey,
	updateDeckRecord,
} from "./atproto-client";
import type { Deck } from "./deck-types";
import { getPdsForDid } from "./identity";
import type { ComDeckbelcherDeckList } from "./lexicons/index";
import { optimisticRecord, runOptimistic } from "./optimistic-utils";
import {
	parseOracleUri,
	parseScryfallUri,
	toOracleUri,
	toScryfallUri,
} from "./scryfall-types";
import { useAuth } from "./useAuth";
import { useMutationWithToast } from "./useMutationWithToast";

/**
 * Transform lexicon deck record to app Deck type
 * Parses ref URIs to typed IDs at the boundary
 */
export function transformDeckRecord(record: ComDeckbelcherDeckList.Main): Deck {
	return {
		...record,
		cards: record.cards.map((card) => {
			const scryfallId = parseScryfallUri(card.ref.scryfallUri);
			const oracleId = parseOracleUri(card.ref.oracleUri);

			if (!scryfallId || !oracleId) {
				throw new Error(
					`Invalid card ref URIs: ${card.ref.scryfallUri}, ${card.ref.oracleUri}`,
				);
			}

			const { ref: _ref, ...rest } = card;
			return { ...rest, scryfallId, oracleId };
		}),
	};
}

export interface DeckRecord {
	deck: Deck;
	cid: string;
}

/**
 * Query options for fetching a single deck
 * Uses Slingshot for cached reads
 */
export const getDeckQueryOptions = (did: Did, rkey: Rkey) =>
	queryOptions({
		queryKey: ["deck", did, rkey] as const,
		queryFn: async (): Promise<DeckRecord> => {
			const result = await getDeckRecord(did, rkey);
			if (!result.success) {
				throw result.error;
			}
			return {
				deck: transformDeckRecord(result.data.value),
				cid: result.data.cid,
			};
		},
		staleTime: 30 * 1000, // 30 seconds - balance between freshness and cache hits
	});

export interface DeckListRecord {
	uri: string;
	cid: string;
	value: Deck;
}

/**
 * Query options for listing all decks for a user
 * Fetches from user's PDS directly
 */
export const listUserDecksQueryOptions = (did: Did) =>
	infiniteQueryOptions({
		queryKey: ["decks", did] as const,
		queryFn: async ({
			pageParam,
		}): Promise<{ records: DeckListRecord[]; cursor?: string }> => {
			const pds = await getPdsForDid(did);
			const result = await listUserDecks(asPdsUrl(pds), did, pageParam);
			if (!result.success) {
				throw result.error;
			}
			return {
				records: result.data.records.map((record) => ({
					uri: record.uri,
					cid: record.cid,
					value: transformDeckRecord(record.value),
				})),
				cursor: result.data.cursor,
			};
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.cursor,
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
				name: deck.name,
				format: deck.format,
				primer: deck.primer,
				cards: deck.cards.map((card) => {
					const { scryfallId, oracleId, ...rest } = card;
					return {
						...rest,
						ref: {
							scryfallUri: toScryfallUri(scryfallId),
							oracleUri: toOracleUri(oracleId),
						},
					};
				}),
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
				primer: deck.primer,
				cards: deck.cards.map((card) => {
					const { scryfallId, oracleId, ...rest } = card;
					return {
						...rest,
						ref: {
							scryfallUri: toScryfallUri(scryfallId),
							oracleUri: toOracleUri(oracleId),
						},
					};
				}),
				createdAt: deck.createdAt,
				updatedAt: new Date().toISOString(),
			});

			if (!result.success) {
				throw result.error;
			}

			return result.data;
		},
		onMutate: async (newDeck) => {
			// WARN: We preserve the old cid during optimistic updates. This means the
			// cid will be stale until onSuccess updates it. If someone likes the deck
			// during this window, the like will reference the old cid. This is unlikely
			// but could cause issues if the deck is being rapidly edited while liked.
			const rollback = await runOptimistic([
				optimisticRecord<DeckRecord>(queryClient, ["deck", did, rkey], (old) =>
					old ? { deck: newDeck, cid: old.cid } : undefined,
				),
			]);
			return { rollback };
		},
		onSuccess: (data, newDeck) => {
			// Update cache with the new cid from the server response
			queryClient.setQueryData<DeckRecord>(["deck", did, rkey], {
				deck: newDeck,
				cid: data.cid,
			});
		},
		onError: (_err, _newDeck, context) => {
			context?.rollback();
			queryClient.invalidateQueries({ queryKey: ["deck", did, rkey] });
		},
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
