import type { Did } from "@atcute/lexicons";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { DeckPreview } from "@/components/DeckPreview";
import { ListPreview } from "@/components/ListPreview";
import type { DeckRecordResponse } from "@/lib/atproto-client";
import {
	listUserCollectionListsQueryOptions,
	useCreateCollectionListMutation,
} from "@/lib/collection-list-queries";
import { listUserDecksQueryOptions } from "@/lib/deck-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import { useAuth } from "@/lib/useAuth";

type SortOption = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";

interface ProfileSearch {
	sort?: SortOption;
	format?: string;
}

export const Route = createFileRoute("/profile/$did/")({
	component: ProfilePage,
	validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
		sort: (search.sort as SortOption) || undefined,
		format: (search.format as string) || undefined,
	}),
	loader: async ({ context, params }) => {
		// Prefetch deck list, collection lists, and DID document during SSR
		const [, , didDocument] = await Promise.all([
			context.queryClient.ensureQueryData(
				listUserDecksQueryOptions(params.did as Did),
			),
			context.queryClient.ensureQueryData(
				listUserCollectionListsQueryOptions(params.did as Did),
			),
			context.queryClient.ensureQueryData(
				didDocumentQueryOptions(params.did as Did),
			),
		]);
		return { handle: extractHandle(didDocument) };
	},
	head: ({ loaderData }) => {
		const display = loaderData?.handle ? `@${loaderData.handle}` : "Profile";
		return { meta: [{ title: `${display} | DeckBelcher` }] };
	},
});

function sortDecks(
	records: DeckRecordResponse[],
	sort: SortOption | undefined,
): DeckRecordResponse[] {
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

function ProfilePage() {
	const { did } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { session } = useAuth();
	const { data: decksData } = useSuspenseQuery(
		listUserDecksQueryOptions(did as Did),
	);
	const { data: listsData } = useQuery(
		listUserCollectionListsQueryOptions(did as Did),
	);
	const { data: didDocument } = useQuery(didDocumentQueryOptions(did as Did));
	const createListMutation = useCreateCollectionListMutation();

	const handle = extractHandle(didDocument ?? null);
	const isOwner = session?.info.sub === did;
	const lists = listsData?.records ?? [];

	// Get unique formats for filter dropdown
	const availableFormats = useMemo(() => {
		const formats = new Set<string>();
		for (const record of decksData.records) {
			if (record.value.format) {
				formats.add(record.value.format);
			}
		}
		return Array.from(formats).sort();
	}, [decksData.records]);

	// Filter and sort
	const filteredAndSorted = useMemo(() => {
		let records = decksData.records;

		// Filter by format
		if (search.format) {
			records = records.filter((r) => r.value.format === search.format);
		}

		// Sort
		return sortDecks(records, search.sort);
	}, [decksData.records, search.format, search.sort]);

	const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value as SortOption | "";
		navigate({
			search: (prev) => ({
				...prev,
				sort: value || undefined,
			}),
			replace: true,
		});
	};

	const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value;
		navigate({
			search: (prev) => ({
				...prev,
				format: value || undefined,
			}),
			replace: true,
		});
	};

	const hasActiveFilters = search.format != null;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-16">
				<div className="mb-8">
					<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
						Decklists
					</h1>
					<p className="text-gray-600 dark:text-gray-400">
						{handle ? `@${handle}` : did}
					</p>
				</div>

				{/* Sort and filter controls - only show if there are decks */}
				{decksData.records.length > 0 && (
					<div className="flex flex-wrap gap-4 mb-6">
						<select
							value={search.sort ?? "updated-desc"}
							onChange={handleSortChange}
							className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
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
								className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
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

				{/* Decks Section */}
				<section className="mb-12">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
						Decks
					</h2>
					{decksData.records.length === 0 ? (
						<div className="text-center py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
							<p className="text-gray-600 dark:text-gray-400 mb-4">
								{isOwner ? "No decklists yet" : "No decklists"}
							</p>
							{isOwner && (
								<Link
									to="/deck/new"
									className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
								>
									Create Your First Deck
								</Link>
							)}
						</div>
					) : filteredAndSorted.length === 0 ? (
						<div className="text-center py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
							<p className="text-gray-600 dark:text-gray-400 mb-4">
								No decks match your filters
							</p>
							{hasActiveFilters && (
								<button
									type="button"
									onClick={() =>
										navigate({ search: { sort: search.sort }, replace: true })
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

				{/* Lists Section */}
				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
							Lists
						</h2>
						{isOwner && (
							<button
								type="button"
								onClick={() => createListMutation.mutate({ name: "New List" })}
								disabled={createListMutation.isPending}
								className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
							>
								<Plus className="w-4 h-4" />
								New List
							</button>
						)}
					</div>
					{lists.length === 0 ? (
						<div className="text-center py-8 bg-gray-50 dark:bg-slate-800 rounded-lg">
							<p className="text-gray-600 dark:text-gray-400">
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
			</div>
		</div>
	);
}
