import type { StatsSelection } from "@/lib/stats-selection";
import type { DeckStatsData } from "@/lib/useDeckStats";
import { ManaBreakdown } from "./stats/ManaBreakdown";
import { ManaCurveChart } from "./stats/ManaCurveChart";
import { SpeedPieChart } from "./stats/SpeedPieChart";
import { SubtypesPieChart } from "./stats/SubtypesPieChart";
import { TypesPieChart } from "./stats/TypesPieChart";

interface DeckStatsProps {
	stats: DeckStatsData;
	selection: StatsSelection;
	onSelect: (selection: StatsSelection) => void;
}

export function DeckStats({ stats, selection, onSelect }: DeckStatsProps) {
	const {
		manaCurve,
		typeDistribution,
		subtypeDistribution,
		speedDistribution,
		manaBreakdown,
		isLoading,
	} = stats;

	if (isLoading) {
		return (
			<div className="mt-8 pt-8 border-t border-gray-200 dark:border-zinc-600">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					Statistics
				</h2>
				<div className="flex items-center justify-center h-48 bg-gray-100 dark:bg-zinc-800 rounded-lg">
					<div className="text-gray-500 dark:text-zinc-300">
						Loading statistics...
					</div>
				</div>
			</div>
		);
	}

	const hasData =
		manaCurve.length > 0 ||
		typeDistribution.length > 0 ||
		subtypeDistribution.length > 0 ||
		speedDistribution.length > 0 ||
		manaBreakdown.length > 0;

	if (!hasData) {
		return null;
	}

	return (
		<div className="mt-8 pt-8 border-t border-gray-200 dark:border-zinc-600">
			<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Statistics
			</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				<ManaCurveChart
					data={manaCurve}
					selection={selection}
					onSelect={onSelect}
				/>
				<TypesPieChart
					data={typeDistribution}
					selection={selection}
					onSelect={onSelect}
				/>
				<SpeedPieChart
					data={speedDistribution}
					selection={selection}
					onSelect={onSelect}
				/>
				<SubtypesPieChart
					data={subtypeDistribution}
					selection={selection}
					onSelect={onSelect}
				/>
				<ManaBreakdown
					data={manaBreakdown}
					selection={selection}
					onSelect={onSelect}
				/>
			</div>
		</div>
	);
}
