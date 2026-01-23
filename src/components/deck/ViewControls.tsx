import { useId } from "react";
import type { GroupBy, SortBy } from "@/lib/deck-types";

interface ViewControlsProps {
	groupBy: GroupBy;
	sortBy: SortBy;
	onGroupByChange: (value: GroupBy) => void;
	onSortByChange: (value: SortBy) => void;
}

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
	{ value: "typeAndTags", label: "Type & Tags" },
	{ value: "type", label: "Type" },
	{ value: "subtype", label: "Subtype" },
	{ value: "manaValue", label: "Mana Value" },
	{ value: "colorIdentity", label: "Color Identity" },
	{ value: "none", label: "None" },
];

const SORT_BY_OPTIONS: Array<{ value: SortBy; label: string }> = [
	{ value: "name", label: "Name" },
	{ value: "manaValue", label: "Mana Value" },
	{ value: "rarity", label: "Rarity" },
];

export function ViewControls({
	groupBy,
	sortBy,
	onGroupByChange,
	onSortByChange,
}: ViewControlsProps) {
	const groupById = useId();
	const sortById = useId();

	return (
		<div className="flex gap-4 items-center mb-4 flex-wrap">
			<div className="flex items-center gap-1.5">
				<label
					htmlFor={groupById}
					className="text-xs font-medium text-gray-600 dark:text-zinc-300"
				>
					Group:
				</label>
				<select
					id={groupById}
					value={groupBy}
					onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
					className="min-w-32 cursor-pointer rounded bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 py-1 px-2 text-sm text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
				>
					{GROUP_BY_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			<div className="flex items-center gap-1.5">
				<label
					htmlFor={sortById}
					className="text-xs font-medium text-gray-600 dark:text-zinc-300"
				>
					Sort:
				</label>
				<select
					id={sortById}
					value={sortBy}
					onChange={(e) => onSortByChange(e.target.value as SortBy)}
					className="min-w-28 cursor-pointer rounded bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 py-1 px-2 text-sm text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
				>
					{SORT_BY_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
