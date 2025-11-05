import {
	Label,
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from "@headlessui/react";
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
	const groupByLabel =
		GROUP_BY_OPTIONS.find((opt) => opt.value === groupBy)?.label ?? "Group By";
	const sortByLabel =
		SORT_BY_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? "Sort By";

	return (
		<div className="flex gap-2 items-center mb-4">
			<Listbox value={groupBy} onChange={onGroupByChange}>
				<div className="relative flex items-center gap-1.5">
					<Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
						Group:
					</Label>
					<ListboxButton className="relative min-w-32 cursor-pointer rounded bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 py-1 pl-2 pr-6 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors">
						<span className="block truncate">{groupByLabel}</span>
						<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
							<svg
								className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clipRule="evenodd"
								/>
							</svg>
						</span>
					</ListboxButton>
					<ListboxOptions className="absolute top-full left-0 z-10 mt-1 min-w-40 overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-sm shadow-lg ring-1 ring-black/10 dark:ring-white/10 focus:outline-none">
						{GROUP_BY_OPTIONS.map((option) => (
							<ListboxOption
								key={option.value}
								value={option.value}
								className="relative cursor-pointer select-none py-1.5 pl-8 pr-3 text-gray-900 dark:text-gray-200 data-[focus]:bg-cyan-600 data-[focus]:text-white"
							>
								{({ selected }) => (
									<>
										<span className={selected ? "font-medium" : "font-normal"}>
											{option.label}
										</span>
										{selected && (
											<span className="absolute inset-y-0 left-0 flex items-center pl-2 text-cyan-600 data-[focus]:text-white">
												<svg
													className="h-3.5 w-3.5"
													viewBox="0 0 20 20"
													fill="currentColor"
													aria-hidden="true"
												>
													<path
														fillRule="evenodd"
														d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
														clipRule="evenodd"
													/>
												</svg>
											</span>
										)}
									</>
								)}
							</ListboxOption>
						))}
					</ListboxOptions>
				</div>
			</Listbox>

			<Listbox value={sortBy} onChange={onSortByChange}>
				<div className="relative flex items-center gap-1.5">
					<Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
						Sort:
					</Label>
					<ListboxButton className="relative min-w-28 cursor-pointer rounded bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 py-1 pl-2 pr-6 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors">
						<span className="block truncate">{sortByLabel}</span>
						<span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
							<svg
								className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
									clipRule="evenodd"
								/>
							</svg>
						</span>
					</ListboxButton>
					<ListboxOptions className="absolute top-full left-0 z-10 mt-1 min-w-32 overflow-auto rounded-md bg-white dark:bg-slate-800 py-1 text-sm shadow-lg ring-1 ring-black/10 dark:ring-white/10 focus:outline-none">
						{SORT_BY_OPTIONS.map((option) => (
							<ListboxOption
								key={option.value}
								value={option.value}
								className="relative cursor-pointer select-none py-1.5 pl-8 pr-3 text-gray-900 dark:text-gray-200 data-[focus]:bg-cyan-600 data-[focus]:text-white"
							>
								{({ selected }) => (
									<>
										<span className={selected ? "font-medium" : "font-normal"}>
											{option.label}
										</span>
										{selected && (
											<span className="absolute inset-y-0 left-0 flex items-center pl-2 text-cyan-600 data-[focus]:text-white">
												<svg
													className="h-3.5 w-3.5"
													viewBox="0 0 20 20"
													fill="currentColor"
													aria-hidden="true"
												>
													<path
														fillRule="evenodd"
														d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
														clipRule="evenodd"
													/>
												</svg>
											</span>
										)}
									</>
								)}
							</ListboxOption>
						))}
					</ListboxOptions>
				</div>
			</Listbox>
		</div>
	);
}
