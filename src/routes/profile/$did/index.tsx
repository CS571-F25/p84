import type { Did } from "@atcute/lexicons";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ClientDate } from "@/components/ClientDate";
import { asRkey, type DeckRecordResponse } from "@/lib/atproto-client";
import { listUserDecksQueryOptions } from "@/lib/deck-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import type { ScryfallId } from "@/lib/scryfall-types";
import { getImageUri } from "@/lib/scryfall-utils";
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
		// Prefetch deck list and DID document during SSR
		await Promise.all([
			context.queryClient.ensureQueryData(
				listUserDecksQueryOptions(params.did as Did),
			),
			context.queryClient.ensureQueryData(
				didDocumentQueryOptions(params.did as Did),
			),
		]);
	},
});

function getSectionCounts(cards: { quantity: number; section: string }[]) {
	const counts: Record<string, number> = {};
	for (const card of cards) {
		counts[card.section] = (counts[card.section] ?? 0) + card.quantity;
	}
	return counts;
}

function formatSectionCounts(counts: Record<string, number>): string {
	const parts: string[] = [];

	// Show commander first if present
	if (counts.commander) {
		parts.push(`${counts.commander} cmdr`);
	}

	// Main deck
	if (counts.mainboard) {
		parts.push(`${counts.mainboard} main`);
	}

	// Sideboard
	if (counts.sideboard) {
		parts.push(`${counts.sideboard} side`);
	}

	// Maybeboard
	if (counts.maybeboard) {
		parts.push(`${counts.maybeboard} maybe`);
	}

	// Any other sections
	for (const [section, count] of Object.entries(counts)) {
		if (
			!["commander", "mainboard", "sideboard", "maybeboard"].includes(section)
		) {
			parts.push(`${count} ${section}`);
		}
	}

	return parts.join(" · ");
}

function getThumbnailId(
	cards: { scryfallId: string; section: string }[],
): ScryfallId | null {
	// Prefer commander
	const commander = cards.find((c) => c.section === "commander");
	if (commander) return commander.scryfallId as ScryfallId;

	// Fall back to first mainboard card
	const mainboard = cards.find((c) => c.section === "mainboard");
	if (mainboard) return mainboard.scryfallId as ScryfallId;

	// Fall back to any card
	return cards[0]?.scryfallId as ScryfallId | null;
}

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
	const { data } = useSuspenseQuery(listUserDecksQueryOptions(did as Did));
	const { data: didDocument } = useQuery(didDocumentQueryOptions(did as Did));

	const handle = extractHandle(didDocument ?? null);
	const isOwner = session?.info.sub === did;

	// Get unique formats for filter dropdown
	const availableFormats = useMemo(() => {
		const formats = new Set<string>();
		for (const record of data.records) {
			if (record.value.format) {
				formats.add(record.value.format);
			}
		}
		return Array.from(formats).sort();
	}, [data.records]);

	// Filter and sort
	const filteredAndSorted = useMemo(() => {
		let records = data.records;

		// Filter by format
		if (search.format) {
			records = records.filter((r) => r.value.format === search.format);
		}

		// Sort
		return sortDecks(records, search.sort);
	}, [data.records, search.format, search.sort]);

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
				{data.records.length > 0 && (
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

				{data.records.length === 0 ? (
					<div className="text-center py-12">
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
					<div className="text-center py-12">
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

							const sectionCounts = getSectionCounts(record.value.cards);
							const sectionString = formatSectionCounts(sectionCounts);
							const dateString =
								record.value.updatedAt ?? record.value.createdAt;
							const thumbnailId = getThumbnailId(record.value.cards);

							return (
								<Link
									key={record.uri}
									to="/profile/$did/deck/$rkey"
									params={{ did, rkey: asRkey(rkey) }}
									className="flex gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
								>
									{/* Thumbnail */}
									{thumbnailId && (
										<div className="flex-shrink-0 w-16 h-[90px] rounded overflow-hidden">
											<img
												src={getImageUri(thumbnailId, "small")}
												alt=""
												className="w-full h-full object-cover"
												loading="lazy"
											/>
										</div>
									)}

									{/* Deck info */}
									<div className="flex-1 min-w-0">
										<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
											{record.value.name}
										</h2>
										<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
											{record.value.format && (
												<>
													{formatDisplayName(record.value.format)}
													{sectionString && " · "}
												</>
											)}
											{sectionString}
										</p>
										<p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
											Updated <ClientDate dateString={dateString} />
										</p>
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
