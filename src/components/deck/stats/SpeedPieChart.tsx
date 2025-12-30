import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { SpeedData } from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";

interface SpeedPieChartProps {
	data: SpeedData[];
	onSelectCards: (cards: DeckCard[], title: string) => void;
	selectedCategory: "instant" | "sorcery" | null;
}

const SPEED_COLORS = {
	instant: "#3B82F6",
	sorcery: "#EF4444",
};

const SPEED_LABELS = {
	instant: "Instant Speed",
	sorcery: "Sorcery Speed",
};

export function SpeedPieChart({
	data,
	onSelectCards,
	selectedCategory,
}: SpeedPieChartProps) {
	const handleSliceClick = (entry: SpeedData) => {
		onSelectCards(
			entry.cards,
			`${SPEED_LABELS[entry.category]} (${entry.count})`,
		);
	};

	const total = data.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
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
								onClick={(_, index) => handleSliceClick(data[index])}
							>
								{data.map((entry) => (
									<Cell
										key={entry.category}
										fill={SPEED_COLORS[entry.category]}
										stroke={
											selectedCategory === entry.category
												? "#fff"
												: "transparent"
										}
										strokeWidth={selectedCategory === entry.category ? 2 : 0}
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
							onClick={() => handleSliceClick(entry)}
						>
							<div
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ backgroundColor: SPEED_COLORS[entry.category] }}
							/>
							<span className="text-xs text-gray-600 dark:text-gray-400">
								{SPEED_LABELS[entry.category]}
							</span>
							<span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
								{total > 0 ? Math.round((entry.count / total) * 100) : 0}%
							</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
