import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { TypeData } from "@/lib/deck-stats";
import type { StatsSelection } from "@/lib/stats-selection";

interface TypesPieChartProps {
	data: TypeData[];
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

const TYPE_COLORS: Record<string, string> = {
	Creature: "var(--color-emerald-500)",
	Instant: "var(--color-cyan-500)",
	Sorcery: "var(--color-amber-500)",
	Enchantment: "var(--color-sky-500)",
	Artifact: "var(--color-slate-500)",
	Planeswalker: "var(--color-orange-500)",
	Land: "var(--color-lime-500)",
	Battle: "var(--color-pink-500)",
	Kindred: "var(--color-purple-500)",
	Other: "var(--color-gray-400)",
};

function getTypeColor(type: string): string {
	return TYPE_COLORS[type] ?? TYPE_COLORS.Other;
}

export function TypesPieChart({
	data,
	selection,
	onSelect,
}: TypesPieChartProps) {
	const isSelected = (type: string) =>
		selection?.chart === "type" && selection.type === type;

	const total = data.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-600">
			<h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-4">
				Card Types
			</h3>
			<div className="h-48 flex">
				<div className="flex-1">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data as unknown as Record<string, unknown>[]}
								dataKey="count"
								nameKey="type"
								cx="50%"
								cy="50%"
								innerRadius={40}
								outerRadius={70}
								cursor="pointer"
								onClick={(_, index) =>
									onSelect({ chart: "type", type: data[index].type })
								}
							>
								{data.map((entry) => (
									<Cell
										key={entry.type}
										fill={getTypeColor(entry.type)}
										stroke={isSelected(entry.type) ? "#fff" : "transparent"}
										strokeWidth={isSelected(entry.type) ? 2 : 0}
									/>
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<div className="w-24 flex flex-col justify-center gap-1">
					{data.slice(0, 6).map((entry) => (
						<button
							key={entry.type}
							type="button"
							className="flex items-center gap-1 text-left hover:opacity-80 transition-opacity"
							onClick={() => onSelect({ chart: "type", type: entry.type })}
						>
							<div
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ backgroundColor: getTypeColor(entry.type) }}
							/>
							<span className="text-xs text-gray-600 dark:text-zinc-300 truncate">
								{entry.type}
							</span>
							<span className="text-xs text-gray-500 dark:text-zinc-400 ml-auto">
								{Math.round((entry.count / total) * 100)}%
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
