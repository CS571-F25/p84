import { Client, ok, simpleFetchHandler } from "@atcute/client";
import type { Did } from "@atcute/lexicons";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";

interface FollowRelationship {
	viewerFollows: boolean;
	profileFollows: boolean;
}

const handler = simpleFetchHandler({ service: "https://public.api.bsky.app" });
const rpc = new Client({ handler });

async function getRelationship(
	viewerDid: string,
	profileDid: string,
): Promise<FollowRelationship> {
	const data = await ok(
		rpc.get("app.bsky.graph.getRelationships", {
			params: {
				actor: viewerDid as Did,
				others: [profileDid as Did],
			},
		}),
	);

	if (data.relationships.length === 0) {
		return { viewerFollows: false, profileFollows: false };
	}

	const rel = data.relationships[0];
	if (rel.$type === "app.bsky.graph.defs#notFoundActor") {
		return { viewerFollows: false, profileFollows: false };
	}

	return {
		viewerFollows: !!rel.following,
		profileFollows: !!rel.followedBy,
	};
}

const relationshipQueryOptions = (viewerDid: string, profileDid: string) =>
	queryOptions({
		queryKey: ["bsky-relationship", viewerDid, profileDid] as const,
		queryFn: () => getRelationship(viewerDid, profileDid),
		staleTime: 5 * 60 * 1000,
		enabled: !!viewerDid && !!profileDid && viewerDid !== profileDid,
	});

interface RelationshipBadgeProps {
	profileDid: string;
}

export function RelationshipBadge({ profileDid }: RelationshipBadgeProps) {
	const { session } = useAuth();
	const viewerDid = session?.info.sub ?? null;

	const { data } = useQuery(
		relationshipQueryOptions(viewerDid ?? "", profileDid),
	);

	if (!viewerDid || viewerDid === profileDid || !data) return null;

	const { viewerFollows, profileFollows } = data;
	if (!viewerFollows && !profileFollows) return null;

	const label =
		viewerFollows && profileFollows
			? "mutuals"
			: profileFollows
				? "follows you"
				: "following";

	return (
		<span
			className="inline-flex items-baseline gap-1 px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 shrink-0"
			style={{ fontVariationSettings: "'CASL' 0.5" }}
		>
			<svg
				viewBox="0 0 320 286"
				fill="currentColor"
				className="w-3 h-3 self-center opacity-50"
				role="img"
				aria-label="Bluesky"
			>
				<title>Bluesky</title>
				<path d="M69.364 19.146c36.687 27.806 76.147 84.186 90.636 114.439 14.489-30.253 53.948-86.633 90.636-114.439C277.107-.917 320-16.44 320 32.957c0 9.865-5.603 82.875-8.889 94.729-11.423 41.208-53.045 51.719-90.071 45.357 64.719 11.12 81.182 47.953 45.627 84.785-80 82.874-106.667-44.333-106.667-44.333s-26.667 127.207-106.667 44.333c-35.555-36.832-19.092-73.665 45.627-84.785-37.026 6.362-78.648-4.149-90.071-45.357C5.603 115.832 0 42.822 0 32.957 0-16.44 42.893-.917 69.364 19.147Z" />
			</svg>
			{label}
		</span>
	);
}
