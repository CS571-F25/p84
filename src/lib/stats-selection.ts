import type {
	ManaCurveData,
	ManaSymbolsData,
	SourceTempo,
	SpeedCategory,
	SpeedData,
	TypeData,
} from "./deck-stats";
import type { DeckCard } from "./deck-types";
import type { ManaColorWithColorless } from "./scryfall-types";

export type StatsSelection =
	| { chart: "curve"; bucket: string; type: "permanent" | "spell" }
	| { chart: "type"; type: string }
	| { chart: "subtype"; subtype: string }
	| { chart: "speed"; category: SpeedCategory }
	| {
			chart: "mana";
			color: ManaColorWithColorless;
			type: "symbol" | SourceTempo;
	  }
	| null;

export interface AllStats {
	manaCurve: ManaCurveData[];
	typeDistribution: TypeData[];
	subtypeDistribution: TypeData[];
	speedDistribution: SpeedData[];
	manaBreakdown: ManaSymbolsData[];
}

export interface SelectedCardsResult {
	cards: DeckCard[];
	title: string;
}

const COLOR_NAMES: Record<ManaColorWithColorless, string> = {
	W: "White",
	U: "Blue",
	B: "Black",
	R: "Red",
	G: "Green",
	C: "Colorless",
};

const SPEED_LABELS: Record<SpeedCategory, string> = {
	instant: "Instant Speed",
	sorcery: "Sorcery Speed",
};

export function getSelectedCards(
	selection: StatsSelection,
	stats: AllStats,
): SelectedCardsResult {
	if (!selection) {
		return { cards: [], title: "" };
	}

	switch (selection.chart) {
		case "curve": {
			const bucket = stats.manaCurve.find((b) => b.bucket === selection.bucket);
			if (!bucket) return { cards: [], title: "" };
			const cards =
				selection.type === "permanent"
					? bucket.permanentCards
					: bucket.spellCards;
			const title = `${selection.type === "permanent" ? "Permanents" : "Spells"} (MV ${selection.bucket})`;
			return { cards, title };
		}

		case "type": {
			const typeData = stats.typeDistribution.find(
				(t) => t.type === selection.type,
			);
			if (!typeData) return { cards: [], title: "" };
			return {
				cards: typeData.cards,
				title: `${typeData.type} (${typeData.count})`,
			};
		}

		case "subtype": {
			const subtypeData = stats.subtypeDistribution.find(
				(s) => s.type === selection.subtype,
			);
			if (!subtypeData) return { cards: [], title: "" };
			return {
				cards: subtypeData.cards,
				title: `${subtypeData.type} (${subtypeData.count})`,
			};
		}

		case "speed": {
			const speedData = stats.speedDistribution.find(
				(s) => s.category === selection.category,
			);
			if (!speedData) return { cards: [], title: "" };
			return {
				cards: speedData.cards,
				title: `${SPEED_LABELS[selection.category]} (${speedData.count})`,
			};
		}

		case "mana": {
			const manaData = stats.manaBreakdown.find(
				(m) => m.color === selection.color,
			);
			if (!manaData) return { cards: [], title: "" };

			const colorName = COLOR_NAMES[selection.color];

			if (selection.type === "symbol") {
				return {
					cards: manaData.symbolCards,
					title: `${colorName} Symbols (${manaData.symbolCount})`,
				};
			}

			const tempoLabels: Record<SourceTempo, string> = {
				immediate: "Immediate",
				delayed: "Delayed",
				bounce: "Bounce",
			};

			const cardsByTempo: Record<SourceTempo, DeckCard[]> = {
				immediate: manaData.immediateSourceCards,
				delayed: manaData.delayedSourceCards,
				bounce: manaData.bounceSourceCards,
			};

			const countByTempo: Record<SourceTempo, number> = {
				immediate: manaData.immediateSourceCount,
				delayed: manaData.delayedSourceCount,
				bounce: manaData.bounceSourceCount,
			};

			return {
				cards: cardsByTempo[selection.type],
				title: `${colorName} ${tempoLabels[selection.type]} Sources (${countByTempo[selection.type]})`,
			};
		}
	}
}

export function isSelectionEqual(
	a: StatsSelection,
	b: StatsSelection,
): boolean {
	if (a === null || b === null) return a === b;
	if (a.chart !== b.chart) return false;

	switch (a.chart) {
		case "curve":
			return b.chart === "curve" && a.bucket === b.bucket && a.type === b.type;
		case "type":
			return b.chart === "type" && a.type === b.type;
		case "subtype":
			return b.chart === "subtype" && a.subtype === b.subtype;
		case "speed":
			return b.chart === "speed" && a.category === b.category;
		case "mana":
			return b.chart === "mana" && a.color === b.color && a.type === b.type;
	}
}
