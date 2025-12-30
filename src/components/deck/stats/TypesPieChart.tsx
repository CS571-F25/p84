import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { TypeData } from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";

interface TypesPieChartProps {
	data: TypeData[];
	onSelectCards: (cards: DeckCard[], title: string) => void;
	selectedType: string | null;
}

const TYPE_COLORS: Record<string, string> = {
	Creature: "#22C55E",
	Instant: "#3B82F6",
	Sorcery: "#EF4444",
	Enchantment: "#A855F7",
	Artifact: "#6B7280",
	Planeswalker: "#F59E0B",
	Land: "#84CC16",
	Battle: "#EC4899",
	Kindred: "#8B5CF6",
	Other: "#9CA3AF",
};

function getTypeColor(type: string): string {
	return TYPE_COLORS[type] ?? TYPE_COLORS.Other;
}

export function TypesPieChart({
	data,
	onSelectCards,
	selectedType,
}: TypesPieChartProps) {
	const handleSliceClick = (entry: TypeData) => {
		onSelectCards(entry.cards, `${entry.type} (${entry.count})`);
	};

	const total = data.reduce((sum, d) => sum + d.count, 0);

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
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
								onClick={(_, index) => handleSliceClick(data[index])}
							>
								{data.map((entry) => (
									<Cell
										key={entry.type}
										fill={getTypeColor(entry.type)}
										stroke={
											selectedType === entry.type ? "#fff" : "transparent"
										}
										strokeWidth={selectedType === entry.type ? 2 : 0}
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
							onClick={() => handleSliceClick(entry)}
						>
							<div
								className="w-2 h-2 rounded-full flex-shrink-0"
								style={{ backgroundColor: getTypeColor(entry.type) }}
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
