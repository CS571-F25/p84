import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import type { ManaCurveData } from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";

interface ManaCurveChartProps {
	data: ManaCurveData[];
	onSelectCards: (cards: DeckCard[], title: string) => void;
	selectedBucket: string | null;
	selectedType: "permanent" | "spell" | null;
}

const COLORS = {
	permanent: "#22C55E", // Green
	spell: "#3B82F6", // Blue
	permanentHover: "#16A34A",
	spellHover: "#2563EB",
};

export function ManaCurveChart({
	data,
	onSelectCards,
	selectedBucket,
	selectedType,
}: ManaCurveChartProps) {
	const handleBarClick = (
		bucket: string,
		type: "permanent" | "spell",
		cards: DeckCard[],
	) => {
		const title = `${type === "permanent" ? "Permanents" : "Spells"} (MV ${bucket})`;
		onSelectCards(cards, title);
	};

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
				Mana Curve
			</h3>
			<div className="h-48">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={data} barCategoryGap="15%">
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
							{data.map((entry) => (
								<Cell
									key={`perm-${entry.bucket}`}
									fill={
										selectedBucket === entry.bucket &&
										selectedType === "permanent"
											? COLORS.permanentHover
											: COLORS.permanent
									}
									onClick={() =>
										handleBarClick(
											entry.bucket,
											"permanent",
											entry.permanentCards,
										)
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
							{data.map((entry) => (
								<Cell
									key={`spell-${entry.bucket}`}
									fill={
										selectedBucket === entry.bucket && selectedType === "spell"
											? COLORS.spellHover
											: COLORS.spell
									}
									onClick={() =>
										handleBarClick(entry.bucket, "spell", entry.spellCards)
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
