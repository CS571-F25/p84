import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { SpeedCategory, SpeedData } from "@/lib/deck-stats";
import type { StatsSelection } from "@/lib/stats-selection";

interface SpeedPieChartProps {
	data: SpeedData[];
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

const SPEED_COLORS: Record<SpeedCategory, string> = {
	instant: "var(--color-cyan-500)",
	sorcery: "var(--color-amber-500)",
};

const SPEED_LABELS: Record<SpeedCategory, string> = {
	instant: "Instant Speed",
	sorcery: "Sorcery Speed",
};

export function SpeedPieChart({
	data,
	selection,
	onSelect,
}: SpeedPieChartProps) {
	const isSelected = (category: SpeedCategory) =>
		selection?.chart === "speed" && selection.category === category;

	const total = data.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-600">
			<h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-4">
				Speed
			</h3>
			<div className="h-48 flex">
				<div className="flex-1">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data as unknown as Record<string, unknown>[]}
								dataKey="count"
								nameKey="category"
								cx="50%"
								cy="50%"
								innerRadius={40}
								outerRadius={70}
								cursor="pointer"
								onClick={(_, index) =>
									onSelect({ chart: "speed", category: data[index].category })
								}
							>
								{data.map((entry) => (
									<Cell
										key={entry.category}
										fill={SPEED_COLORS[entry.category]}
										stroke={isSelected(entry.category) ? "#fff" : "transparent"}
										strokeWidth={isSelected(entry.category) ? 2 : 0}
									/>
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<div className="w-28 flex flex-col justify-center gap-2">
					{data.map((entry) => (
						<button
							key={entry.category}
							type="button"
							className="flex items-center gap-1 text-left hover:opacity-80 transition-opacity"
							onClick={() =>
								onSelect({ chart: "speed", category: entry.category })
							}
						>
							<div
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ backgroundColor: SPEED_COLORS[entry.category] }}
							/>
							<span className="text-xs text-gray-600 dark:text-zinc-300">
								{SPEED_LABELS[entry.category]}
							</span>
							<span className="text-xs text-gray-500 dark:text-zinc-400 ml-auto">
								{total > 0 ? Math.round((entry.count / total) * 100) : 0}%
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
