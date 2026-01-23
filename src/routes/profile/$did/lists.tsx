import type { Did } from "@atcute/lexicons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ListPreview } from "@/components/ListPreview";
import {
	domainResolvesQueryOptions,
	ProfileLayout,
} from "@/components/profile/ProfileLayout";
import {
	listUserCollectionListsQueryOptions,
	useCreateCollectionListMutation,
} from "@/lib/collection-list-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { getProfileQueryOptions } from "@/lib/profile-queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/profile/$did/lists")({
	component: ListsTab,
	loader: async ({ context, params }) => {
		const [, didDocument] = await Promise.all([
			context.queryClient.ensureInfiniteQueryData(
				listUserCollectionListsQueryOptions(params.did as Did),
			),
			context.queryClient.ensureQueryData(
				didDocumentQueryOptions(params.did as Did),
			),
			context.queryClient.ensureQueryData(
				getProfileQueryOptions(params.did as Did),
			),
		]);
		const handle = extractHandle(didDocument);
		// Prefetch DNS check (don't await - not critical for render)
		context.queryClient.prefetchQuery(domainResolvesQueryOptions(handle));
		return { handle };
	},
	head: ({ loaderData }) => {
		const display = loaderData?.handle ? `@${loaderData.handle}` : "Profile";
		return { meta: [{ title: `${display} - Lists | DeckBelcher` }] };
	},
});

function ListsTab() {
	const { did } = Route.useParams();
	const { session } = useAuth();
	const { data: listsData, isLoading } = useInfiniteQuery(
		listUserCollectionListsQueryOptions(did as Did),
	);
	const createListMutation = useCreateCollectionListMutation();

	const isOwner = session?.info.sub === did;
	const lists = listsData?.pages.flatMap((p) => p.records) ?? [];

	return (
		<ProfileLayout did={did}>
			<section>
				<div className="flex justify-end mb-6">
					{isOwner && (
						<button
							type="button"
							onClick={() => createListMutation.mutate({ name: "New List" })}
							disabled={createListMutation.isPending}
							className="flex items-center gap-2 px-4 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:bg-cyan-400/50 text-gray-900 font-medium rounded-lg transition-colors"
						>
							<Plus className="w-4 h-4" />
							New List
						</button>
					)}
				</div>

				{isLoading ? (
					<div className="text-center py-8 bg-gray-50 dark:bg-zinc-800 rounded-lg">
						<p className="text-gray-600 dark:text-zinc-300">Loading lists...</p>
					</div>
				) : lists.length === 0 ? (
					<div className="text-center py-8 bg-gray-50 dark:bg-zinc-800 rounded-lg">
						<p className="text-gray-600 dark:text-zinc-300">
							{isOwner ? "No lists yet" : "No lists"}
						</p>
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{lists.map((record) => {
							const rkey = record.uri.split("/").pop();
							if (!rkey) return null;

							return (
								<ListPreview
									key={record.uri}
									did={did as Did}
									rkey={rkey}
									list={record.value}
								/>
							);
						})}
					</div>
				)}
			</section>
		</ProfileLayout>
	);
}
