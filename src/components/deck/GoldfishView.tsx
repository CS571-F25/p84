import { useCallback, useMemo, useState } from "react";
import type { DeckCard } from "@/lib/deck-types";
import type { ScryfallId } from "@/lib/scryfall-types";
import { CardImage } from "../CardImage";

interface GoldfishViewProps {
	cards: DeckCard[];
}

interface CardInstance {
	cardId: ScryfallId;
	instanceId: number;
}

function shuffle<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

interface DeckState {
	hand: CardInstance[];
	library: CardInstance[];
}

function dealHand(deck: CardInstance[], handSize = 7): DeckState {
	const shuffled = shuffle(deck);
	return {
		hand: shuffled.slice(0, handSize),
		library: shuffled.slice(handSize),
	};
}

export function GoldfishView({ cards }: GoldfishViewProps) {
	const fullDeck = useMemo(() => {
		const deck: CardInstance[] = [];
		let instanceId = 0;
		for (const card of cards) {
			for (let i = 0; i < card.quantity; i++) {
				deck.push({ cardId: card.scryfallId, instanceId: instanceId++ });
			}
		}
		return deck;
	}, [cards]);

	const [state, setState] = useState(() => dealHand(fullDeck));

	const newHand = useCallback(() => {
		setState(dealHand(fullDeck));
	}, [fullDeck]);

	const draw = useCallback(() => {
		setState((prev) => {
			if (prev.library.length === 0) return prev;
			return {
				hand: [...prev.hand, prev.library[0]],
				library: prev.library.slice(1),
			};
		});
	}, []);

	if (cards.length === 0) return null;

	return (
		<div className="mt-8 pt-8 border-t border-gray-200 dark:border-slate-700">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Goldfish
				</h2>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={newHand}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
					>
						New Hand
					</button>
					<button
						type="button"
						onClick={draw}
						disabled={state.library.length === 0}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Draw ({state.library.length})
					</button>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{state.hand.map((card) => (
					<CardImage
						key={card.instanceId}
						card={{ id: card.cardId, name: "" }}
						size="normal"
						className="h-48 w-auto"
					/>
				))}
			</div>
		</div>
	);
}
