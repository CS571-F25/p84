import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { TypeData } from "@/lib/deck-stats";
import type { StatsSelection } from "@/lib/stats-selection";

interface SubtypesPieChartProps {
	data: TypeData[];
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

const COLORS = [
	"#22C55E",
	"#3B82F6",
	"#EF4444",
	"#A855F7",
	"#F59E0B",
	"#EC4899",
	"#14B8A6",
	"#6366F1",
	"#F97316",
	"#8B5CF6",
	"#06B6D4",
	"#84CC16",
];

function getSubtypeColor(subtype: string, index: number): string {
	if (subtype === "Other") return "#9CA3AF";
	return COLORS[index % COLORS.length];
}

export function SubtypesPieChart({
	data,
	selection,
	onSelect,
}: SubtypesPieChartProps) {
	const isSelected = (subtype: string) =>
		selection?.chart === "subtype" && selection.subtype === subtype;

	const total = data.reduce((sum, d) => sum + d.count, 0);

	if (data.length === 0) {
		return (
			<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
				<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
					Subtypes
				</h3>
				<div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
					No subtypes
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
				Subtypes
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
									onSelect({ chart: "subtype", subtype: data[index].type })
								}
							>
								{data.map((entry, index) => (
									<Cell
										key={entry.type}
										fill={getSubtypeColor(entry.type, index)}
										stroke={isSelected(entry.type) ? "#fff" : "transparent"}
										strokeWidth={isSelected(entry.type) ? 2 : 0}
									/>
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<div className="w-24 flex flex-col justify-center gap-1 max-h-48 overflow-y-auto">
					{data.slice(0, 8).map((entry, index) => (
						<button
							key={entry.type}
							type="button"
							className="flex items-center gap-1 text-left hover:opacity-80 transition-opacity"
							onClick={() =>
								onSelect({ chart: "subtype", subtype: entry.type })
							}
						>
							<div
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ backgroundColor: getSubtypeColor(entry.type, index) }}
							/>
							<span className="text-xs text-gray-600 dark:text-gray-400 truncate">
								{entry.type}
							</span>
							<span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
								{Math.round((entry.count / total) * 100)}%
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
