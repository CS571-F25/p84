import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import type { ManaCurveData } from "@/lib/deck-stats";
import type { StatsSelection } from "@/lib/stats-selection";

interface ManaCurveChartProps {
	data: ManaCurveData[];
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

const COLORS = {
	permanent: "var(--color-cyan-500)",
	spell: "var(--color-violet-500)",
	permanentHover: "var(--color-cyan-600)",
	spellHover: "var(--color-violet-600)",
};

export function ManaCurveChart({
	data,
	selection,
	onSelect,
}: ManaCurveChartProps) {
	// Hide 0-CMC bucket when empty (common after excluding lands)
	const filteredData = data.filter(
		(d) => d.bucket !== "0" || d.permanents > 0 || d.spells > 0,
	);

	const isSelected = (bucket: string, type: "permanent" | "spell") =>
		selection?.chart === "curve" &&
		selection.bucket === bucket &&
		selection.type === type;

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
				Mana Curve
			</h3>
			<div className="h-48">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={filteredData} barCategoryGap="15%">
						<XAxis
							dataKey="bucket"
							tick={{ fill: "#9CA3AF", fontSize: 12 }}
							axisLine={{ stroke: "#4B5563" }}
							tickLine={{ stroke: "#4B5563" }}
						/>
						<YAxis
							tick={{ fill: "#9CA3AF", fontSize: 12 }}
							axisLine={{ stroke: "#4B5563" }}
							tickLine={{ stroke: "#4B5563" }}
							allowDecimals={false}
						/>
						<Bar
							dataKey="permanents"
							stackId="stack"
							name="Permanents"
							cursor="pointer"
						>
							{filteredData.map((entry) => (
								<Cell
									key={`perm-${entry.bucket}`}
									fill={
										isSelected(entry.bucket, "permanent")
											? COLORS.permanentHover
											: COLORS.permanent
									}
									onClick={() =>
										onSelect({
											chart: "curve",
											bucket: entry.bucket,
											type: "permanent",
										})
									}
								/>
							))}
						</Bar>
						<Bar
							dataKey="spells"
							stackId="stack"
							name="Spells"
							cursor="pointer"
						>
							{filteredData.map((entry) => (
								<Cell
									key={`spell-${entry.bucket}`}
									fill={
										isSelected(entry.bucket, "spell")
											? COLORS.spellHover
											: COLORS.spell
									}
									onClick={() =>
										onSelect({
											chart: "curve",
											bucket: entry.bucket,
											type: "spell",
										})
									}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
			<div className="flex justify-center gap-4 mt-2">
				<div className="flex items-center gap-1">
					<div
						className="w-3 h-3 rounded"
						style={{ backgroundColor: COLORS.permanent }}
					/>
					<span className="text-xs text-gray-600 dark:text-gray-400">
						Permanents
					</span>
				</div>
				<div className="flex items-center gap-1">
					<div
						className="w-3 h-3 rounded"
						style={{ backgroundColor: COLORS.spell }}
					/>
					<span className="text-xs text-gray-600 dark:text-gray-400">
						Spells
					</span>
				</div>
			</div>
		</div>
	);
}
