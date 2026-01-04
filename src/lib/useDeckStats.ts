import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	computeManaCurve,
	computeManaSymbolsVsSources,
	computeSpeedDistribution,
	computeSubtypeDistribution,
	computeTypeDistribution,
	type ManaCurveData,
	type ManaSymbolsData,
	type SpeedData,
	type TypeData,
} from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";

export interface DeckStatsData {
	manaCurve: ManaCurveData[];
	typeDistribution: TypeData[];
	subtypeDistribution: TypeData[];
	speedDistribution: SpeedData[];
	manaBreakdown: ManaSymbolsData[];
	isLoading: boolean;
}

export function useDeckStats(cards: DeckCard[]): DeckStatsData {
	const cardMap = useQueries({
		queries: cards.map((card) => getCardByIdQueryOptions(card.scryfallId)),
		combine: combineCardQueries,
	});

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

	return {
		manaCurve,
		typeDistribution,
		subtypeDistribution,
		speedDistribution,
		manaBreakdown,
		isLoading: !cardMap,
	};
}
