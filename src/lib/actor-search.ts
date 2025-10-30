// Import type definitions for Bluesky lexicons
import type { AppBskyActorSearchActorsTypeahead } from "@atcute/bluesky";
import { Client, ok, simpleFetchHandler } from "@atcute/client";
import { queryOptions } from "@tanstack/react-query";

const handler = simpleFetchHandler({ service: "https://public.api.bsky.app" });
const rpc = new Client({ handler });

export type ActorSearchResult =
	AppBskyActorSearchActorsTypeahead.$output["actors"][number];

/**
 * Query options for searching actors by handle/name prefix.
 * Used for typeahead/autocomplete functionality.
 */
export const searchActorsQueryOptions = (q: string) =>
	queryOptions({
		queryKey: ["actorSearch", q] as const,
		queryFn: async (): Promise<ActorSearchResult[]> => {
			if (!q || q.length < 2) return [];

			const data = await ok(
				rpc.get("app.bsky.actor.searchActorsTypeahead", {
					params: {
						q,
						limit: 10,
					},
				}),
			);

			return data.actors;
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		enabled: q.length >= 2,
	});
