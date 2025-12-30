import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	computeManaCurve,
	computeManaSymbolsVsSources,
	computeSpeedDistribution,
	computeSubtypeDistribution,
	computeTypeDistribution,
	type SpeedCategory,
} from "@/lib/deck-stats";
import type { DeckCard } from "@/lib/deck-types";
import { combineCardQueries, getCardByIdQueryOptions } from "@/lib/queries";
import type { ManaColor, ScryfallId } from "@/lib/scryfall-types";
import { ManaCurveChart } from "./stats/ManaCurveChart";
import { ManaSourcesChart } from "./stats/ManaSourcesChart";
import { SpeedPieChart } from "./stats/SpeedPieChart";
import { StatsCardList } from "./stats/StatsCardList";
import { SubtypesPieChart } from "./stats/SubtypesPieChart";
import { TypesPieChart } from "./stats/TypesPieChart";

interface DeckStatsProps {
	cards: DeckCard[];
	onCardHover: (cardId: ScryfallId | null) => void;
}

export function DeckStats({ cards, onCardHover }: DeckStatsProps) {
	// Fetch card data for all cards
	const cardMap = useQueries({
		queries: cards.map((card) => getCardByIdQueryOptions(card.scryfallId)),
		combine: combineCardQueries,
	});

	// State for selected cards in the card list panel
	const [selectedCards, setSelectedCards] = useState<DeckCard[]>([]);
	const [selectedTitle, setSelectedTitle] = useState<string>("");

	// Chart selection state
	const [selectedCurveBucket, setSelectedCurveBucket] = useState<string | null>(
		null,
	);
	const [selectedCurveType, setSelectedCurveType] = useState<
		"permanent" | "spell" | null
	>(null);
	const [selectedType, setSelectedType] = useState<string | null>(null);
	const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
	const [selectedSpeedCategory, setSelectedSpeedCategory] =
		useState<SpeedCategory | null>(null);
	const [selectedManaColor, setSelectedManaColor] = useState<ManaColor | null>(
		null,
	);
	const [selectedManaType, setSelectedManaType] = useState<
		"symbol" | "source" | null
	>(null);

	// Compute statistics
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

	const manaSymbolsVsSources = useMemo(
		() =>
			cardMap
				? computeManaSymbolsVsSources(cards, (dc) => cardMap.get(dc.scryfallId))
				: [],
		[cards, cardMap],
	);

	const clearSelections = () => {
		setSelectedCurveBucket(null);
		setSelectedCurveType(null);
		setSelectedType(null);
		setSelectedSubtype(null);
		setSelectedSpeedCategory(null);
		setSelectedManaColor(null);
		setSelectedManaType(null);
	};

	const handleCurveSelect = (cards: DeckCard[], title: string) => {
		clearSelections();
		setSelectedCards(cards);
		setSelectedTitle(title);

		// Parse bucket and type from title for highlighting
		const mvMatch = title.match(/\(MV (\d\+?)\)/);
		if (mvMatch) {
			setSelectedCurveBucket(mvMatch[1]);
			setSelectedCurveType(
				title.startsWith("Permanents") ? "permanent" : "spell",
			);
		}
	};

	const handleTypeSelect = (cards: DeckCard[], title: string) => {
		clearSelections();
		setSelectedCards(cards);
		setSelectedTitle(title);

		// Parse type from title
		const typeMatch = title.match(/^(\w+)\s*\(/);
		if (typeMatch) {
			setSelectedType(typeMatch[1]);
		}
	};

	const handleSubtypeSelect = (cards: DeckCard[], title: string) => {
		clearSelections();
		setSelectedCards(cards);
		setSelectedTitle(title);

		// Parse subtype from title
		const subtypeMatch = title.match(/^(.+?)\s*\(/);
		if (subtypeMatch) {
			setSelectedSubtype(subtypeMatch[1]);
		}
	};

	const handleSpeedSelect = (cards: DeckCard[], title: string) => {
		clearSelections();
		setSelectedCards(cards);
		setSelectedTitle(title);

		if (title.startsWith("Instant")) {
			setSelectedSpeedCategory("instant");
		} else if (title.startsWith("Sorcery")) {
			setSelectedSpeedCategory("sorcery");
		}
	};

	const handleManaSourcesSelect = (cards: DeckCard[], title: string) => {
		clearSelections();
		setSelectedCards(cards);
		setSelectedTitle(title);

		// Parse color and type from title like "White Symbols" or "Blue Sources"
		const colors: Record<string, ManaColor> = {
			White: "W",
			Blue: "U",
			Black: "B",
			Red: "R",
			Green: "G",
		};

		for (const [name, color] of Object.entries(colors)) {
			if (title.startsWith(name)) {
				setSelectedManaColor(color);
				setSelectedManaType(title.includes("Symbols") ? "symbol" : "source");
				break;
			}
		}
	};

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
						onSelectCards={handleCurveSelect}
						selectedBucket={selectedCurveBucket}
						selectedType={selectedCurveType}
					/>
					<TypesPieChart
						data={typeDistribution}
						onSelectCards={handleTypeSelect}
						selectedType={selectedType}
					/>
					<SpeedPieChart
						data={speedDistribution}
						onSelectCards={handleSpeedSelect}
						selectedCategory={selectedSpeedCategory}
					/>
					<SubtypesPieChart
						data={subtypeDistribution}
						onSelectCards={handleSubtypeSelect}
						selectedSubtype={selectedSubtype}
					/>
					<ManaSourcesChart
						data={manaSymbolsVsSources}
						onSelectCards={handleManaSourcesSelect}
						selectedColor={selectedManaColor}
						selectedType={selectedManaType}
					/>
				</div>

				{/* Card list panel */}
				{selectedCards.length > 0 && (
					<div className="flex-shrink-0">
						<StatsCardList
							title={selectedTitle}
							cards={selectedCards}
							onCardHover={onCardHover}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
