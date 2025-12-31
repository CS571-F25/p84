import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import type { ManaSymbolsData } from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";
import type { ManaColorWithColorless } from "@/lib/scryfall-types";

interface ManaSourcesChartProps {
	data: ManaSymbolsData[];
	onSelectCards: (cards: DeckCard[], title: string) => void;
	selectedColor: ManaColorWithColorless | null;
	selectedType: "symbol" | "source" | null;
}

const MANA_COLORS: Record<ManaColorWithColorless, string> = {
	W: "#FEF3C7",
	U: "#3B82F6",
	B: "#374151",
	R: "#EF4444",
	G: "#22C55E",
	C: "#9CA3AF",
};

const MANA_NAMES: Record<ManaColorWithColorless, string> = {
	W: "White",
	U: "Blue",
	B: "Black",
	R: "Red",
	G: "Green",
	C: "Colorless",
};

export function ManaSourcesChart({
	data,
	onSelectCards,
	selectedColor,
	selectedType,
}: ManaSourcesChartProps) {
	const handleBarClick = (
		color: ManaColorWithColorless,
		type: "symbol" | "source",
		cards: DeckCard[],
	) => {
		const typeName = type === "symbol" ? "Symbols" : "Sources";
		onSelectCards(cards, `${MANA_NAMES[color]} ${typeName}`);
	};

	const getAllSourceCards = (entry: ManaSymbolsData): DeckCard[] => {
		const seen = new Set<string>();
		const result: DeckCard[] = [];
		for (const card of [
			...entry.immediateSourceCards,
			...entry.delayedSourceCards,
			...entry.bounceSourceCards,
		]) {
			if (!seen.has(card.scryfallId)) {
				seen.add(card.scryfallId);
				result.push(card);
			}
		}
		return result;
	};

	// Filter out colors with no data
	const filteredData = data.filter(
		(d) => d.symbolCount > 0 || d.sourceCount > 0,
	);

	if (filteredData.length === 0) {
		return (
			<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
				<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
					Mana Symbols vs Sources
				</h3>
				<div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
					No mana data
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
			<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
				Mana Symbols vs Sources
			</h3>
			<div className="h-48">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={filteredData} barCategoryGap="20%">
						<XAxis
							dataKey="color"
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
							dataKey="symbolCount"
							name="Symbols"
							cursor="pointer"
							barSize={12}
						>
							{filteredData.map((entry) => (
								<Cell
									key={`sym-${entry.color}`}
									fill={MANA_COLORS[entry.color]}
									stroke={
										entry.color === "W" ? "#D97706" : MANA_COLORS[entry.color]
									}
									strokeWidth={entry.color === "W" ? 1 : 0}
									opacity={
										selectedColor === entry.color && selectedType === "symbol"
											? 1
											: 0.7
									}
									onClick={() =>
										handleBarClick(entry.color, "symbol", entry.symbolCards)
									}
								/>
							))}
						</Bar>
						<Bar
							dataKey="sourceCount"
							name="Sources"
							cursor="pointer"
							barSize={12}
						>
							{filteredData.map((entry) => (
								<Cell
									key={`src-${entry.color}`}
									fill={MANA_COLORS[entry.color]}
									stroke={
										entry.color === "W" ? "#D97706" : MANA_COLORS[entry.color]
									}
									strokeWidth={entry.color === "W" ? 1 : 0}
									opacity={
										selectedColor === entry.color && selectedType === "source"
											? 1
											: 0.4
									}
									onClick={() =>
										handleBarClick(
											entry.color,
											"source",
											getAllSourceCards(entry),
										)
									}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
			<div className="flex justify-center gap-4 mt-2">
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded bg-gray-400 opacity-70" />
					<span className="text-xs text-gray-600 dark:text-gray-400">
						Symbols (pips in costs)
					</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="w-3 h-3 rounded bg-gray-400 opacity-40" />
					<span className="text-xs text-gray-600 dark:text-gray-400">
						Sources (cards that produce)
					</span>
				</div>
			</div>
		</div>
	);
}
