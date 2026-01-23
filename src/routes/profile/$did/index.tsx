import type { Did } from "@atcute/lexicons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { DeckPreview } from "@/components/DeckPreview";
import {
	domainResolvesQueryOptions,
	ProfileLayout,
} from "@/components/profile/ProfileLayout";
import {
	type DeckListRecord,
	listUserDecksQueryOptions,
} from "@/lib/deck-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import { getProfileQueryOptions } from "@/lib/profile-queries";
import { useAuth } from "@/lib/useAuth";

type SortOption = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";

interface DecksSearch {
	sort?: SortOption;
	format?: string;
}

export const Route = createFileRoute("/profile/$did/")({
	component: DecksTab,
	validateSearch: (search: Record<string, unknown>): DecksSearch => ({
		sort: (search.sort as SortOption) || undefined,
		format: (search.format as string) || undefined,
	}),
	loader: async ({ context, params }) => {
		const [, didDocument] = await Promise.all([
			context.queryClient.ensureInfiniteQueryData(
				listUserDecksQueryOptions(params.did as Did),
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
		return { meta: [{ title: `${display} | DeckBelcher` }] };
	},
});

function sortDecks(
	records: DeckListRecord[],
	sort: SortOption | undefined,
): DeckListRecord[] {
	const sorted = [...records];

	switch (sort) {
		case "name-asc":
			sorted.sort((a, b) => a.value.name.localeCompare(b.value.name));
			break;
		case "name-desc":
			sorted.sort((a, b) => b.value.name.localeCompare(a.value.name));
			break;
		case "updated-asc":
			sorted.sort((a, b) => {
				const dateA = a.value.updatedAt ?? a.value.createdAt;
				const dateB = b.value.updatedAt ?? b.value.createdAt;
				return dateA.localeCompare(dateB);
			});
			break;
		default:
			sorted.sort((a, b) => {
				const dateA = a.value.updatedAt ?? a.value.createdAt;
				const dateB = b.value.updatedAt ?? b.value.createdAt;
				return dateB.localeCompare(dateA);
			});
			break;
	}

	return sorted;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
	{ value: "updated-desc", label: "Recently Updated" },
	{ value: "updated-asc", label: "Oldest First" },
	{ value: "name-asc", label: "Name A-Z" },
	{ value: "name-desc", label: "Name Z-A" },
];

function DecksTab() {
	const { did } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { session } = useAuth();
	const { data: decksData, isLoading } = useInfiniteQuery(
		listUserDecksQueryOptions(did as Did),
	);

	const isOwner = session?.info.sub === did;
	const decks = decksData?.pages.flatMap((p) => p.records) ?? [];

	return (
		<ProfileLayout did={did}>
			<DecksContent
				did={did}
				decks={decks}
				isLoading={isLoading}
				isOwner={isOwner}
				search={search}
				navigate={navigate}
			/>
		</ProfileLayout>
	);
}

interface DecksContentProps {
	did: string;
	decks: DeckListRecord[];
	isLoading: boolean;
	isOwner: boolean;
	search: DecksSearch;
	navigate: ReturnType<typeof Route.useNavigate>;
}

function DecksContent({
	did,
	decks,
	isLoading,
	isOwner,
	search,
	navigate,
}: DecksContentProps) {
	const availableFormats = useMemo(() => {
		const formats = new Set<string>();
		for (const record of decks) {
			if (record.value.format) {
				formats.add(record.value.format);
			}
		}
		return Array.from(formats).sort();
	}, [decks]);

	const filteredAndSorted = useMemo(() => {
		let records = decks;

		if (search.format) {
			records = records.filter((r) => r.value.format === search.format);
		}

		return sortDecks(records, search.sort);
	}, [decks, search.format, search.sort]);

	const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value as SortOption | "";
		navigate({
			search: (prev: DecksSearch) => ({
				...prev,
				sort: value || undefined,
			}),
			replace: true,
		});
	};

	const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value;
		navigate({
			search: (prev: DecksSearch) => ({
				...prev,
				format: value || undefined,
			}),
			replace: true,
		});
	};

	const hasActiveFilters = search.format != null;

	return (
		<section>
			{/* Sort and filter controls */}
			<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
				{decks.length > 0 && (
					<div className="flex flex-wrap gap-4">
						<select
							value={search.sort ?? "updated-desc"}
							onChange={handleSortChange}
							className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
						>
							{SORT_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>

						{availableFormats.length > 0 && (
							<select
								value={search.format ?? ""}
								onChange={handleFormatChange}
								className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
							>
								<option value="">All Formats</option>
								{availableFormats.map((format) => (
									<option key={format} value={format}>
										{formatDisplayName(format)}
									</option>
								))}
							</select>
						)}
					</div>
				)}
				{isOwner && (
					<Link
						to="/deck/new"
						className="flex items-center gap-2 px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-gray-900 font-medium rounded-lg transition-colors"
					>
						<Plus className="w-4 h-4" />
						New Deck
					</Link>
				)}
			</div>

			{isLoading ? (
				<div className="text-center py-8 bg-gray-50 dark:bg-zinc-800 rounded-lg">
					<p className="text-gray-600 dark:text-zinc-300">
						Loading decklists...
					</p>
				</div>
			) : decks.length === 0 ? (
				<div className="text-center py-8 bg-gray-50 dark:bg-zinc-800 rounded-lg">
					<p className="text-gray-600 dark:text-zinc-300 mb-4">
						{isOwner ? "No decklists yet" : "No decklists"}
					</p>
					{isOwner && (
						<Link
							to="/deck/new"
							className="inline-block px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-gray-900 font-medium rounded-lg transition-colors"
						>
							Create Your First Deck
						</Link>
					)}
				</div>
			) : filteredAndSorted.length === 0 ? (
				<div className="text-center py-8 bg-gray-50 dark:bg-zinc-800 rounded-lg">
					<p className="text-gray-600 dark:text-zinc-300 mb-4">
						No decks match your filters
					</p>
					{hasActiveFilters && (
						<button
							type="button"
							onClick={() =>
								navigate({
									search: { sort: search.sort },
									replace: true,
								})
							}
							className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium"
						>
							Clear filters
						</button>
					)}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filteredAndSorted.map((record) => {
						const rkey = record.uri.split("/").pop();
						if (!rkey) return null;

						return (
							<DeckPreview
								key={record.uri}
								did={did as Did}
								rkey={rkey}
								deck={record.value}
							/>
						);
					})}
				</div>
			)}
		</section>
	);
}
