import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	computeManaCurve,
	computeManaSymbolsVsSources,
	computeSpeedDistribution,
	computeSubtypeDistribution,
	computeTypeDistribution,
} from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";
import type { ScryfallId } from "@/lib/scryfall-types";
import { getSelectedCards, type StatsSelection } from "@/lib/stats-selection";
import { ManaBreakdown } from "./stats/ManaBreakdown";
import { ManaCurveChart } from "./stats/ManaCurveChart";
import { SpeedPieChart } from "./stats/SpeedPieChart";
import { StatsCardList } from "./stats/StatsCardList";
import { SubtypesPieChart } from "./stats/SubtypesPieChart";
import { TypesPieChart } from "./stats/TypesPieChart";

interface DeckStatsProps {
	cards: DeckCard[];
	onCardHover: (cardId: ScryfallId | null) => void;
	onCardClick?: (card: DeckCard) => void;
}

export function DeckStats({ cards, onCardHover, onCardClick }: DeckStatsProps) {
	const cardMap = useQueries({
		queries: cards.map((card) => getCardByIdQueryOptions(card.scryfallId)),
		combine: combineCardQueries,
	});

	const [selection, setSelection] = useState<StatsSelection>(null);

	// Compute all statistics
	const manaCurve = useMemo(
		() =>
			cardMap
				? computeManaCurve(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	const typeDistribution = useMemo(
		() =>
			cardMap
				? computeTypeDistribution(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	const subtypeDistribution = useMemo(
		() =>
			cardMap
				? computeSubtypeDistribution(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	const speedDistribution = useMemo(
		() =>
			cardMap
				? computeSpeedDistribution(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	const manaBreakdown = useMemo(
		() =>
			cardMap
				? computeManaSymbolsVsSources(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	// Derive selected cards from selection + stats
	const { cards: selectedCards, title: selectedTitle } = useMemo(
		() =>
			getSelectedCards(selection, {
				manaCurve,
				typeDistribution,
				subtypeDistribution,
				speedDistribution,
				manaBreakdown,
			}),
		[
			selection,
			manaCurve,
			typeDistribution,
			subtypeDistribution,
			speedDistribution,
			manaBreakdown,
		],
	);

	if (!cardMap) {
		return (
			<div className="mt-8 pt-8 border-t border-gray-200 dark:border-slate-700">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					Statistics
				</h2>
				<div className="flex items-center justify-center h-48 bg-gray-100 dark:bg-slate-800 rounded-lg">
					<div className="text-gray-500 dark:text-gray-400">
						Loading statistics...
					</div>
				</div>
			</div>
		);
	}

	if (cards.length === 0) {
		return null;
	}

	return (
		<div className="mt-8 pt-8 border-t border-gray-200 dark:border-slate-700">
			<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Statistics
			</h2>

			<div className="flex gap-6">
				{/* Charts area */}
				<div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					<ManaCurveChart
						data={manaCurve}
						selection={selection}
						onSelect={setSelection}
					/>
					<TypesPieChart
						data={typeDistribution}
						selection={selection}
						onSelect={setSelection}
					/>
					<SpeedPieChart
						data={speedDistribution}
						selection={selection}
						onSelect={setSelection}
					/>
					<SubtypesPieChart
						data={subtypeDistribution}
						selection={selection}
						onSelect={setSelection}
					/>
					<ManaBreakdown
						data={manaBreakdown}
						selection={selection}
						onSelect={setSelection}
					/>
				</div>

				{/* Card list panel */}
				{selectedCards.length > 0 && (
					<div className="flex-shrink-0">
						<StatsCardList
							title={selectedTitle}
							cards={selectedCards}
							onCardHover={onCardHover}
							onCardClick={onCardClick}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
