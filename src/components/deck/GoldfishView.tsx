import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckCard } from "@/lib/deck-types";
import type { ScryfallId } from "@/lib/scryfall-types";
import { seededShuffle, useSeededRandom } from "@/lib/useSeededRandom";
import { CardImage } from "../CardImage";

interface GoldfishViewProps {
	cards: DeckCard[];
	onCardHover?: (cardId: ScryfallId | null) => void;
}

interface CardInstance {
	cardId: ScryfallId;
	instanceId: number;
}

interface DeckState {
	hand: CardInstance[];
	library: CardInstance[];
}

function dealHand(
	deck: CardInstance[],
	rng: () => number,
	handSize = 7,
): DeckState {
	const shuffled = seededShuffle(deck, rng);
	return {
		hand: shuffled.slice(0, handSize),
		library: shuffled.slice(handSize),
	};
}

export function GoldfishView({ cards, onCardHover }: GoldfishViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const { rng, SeedEmbed } = useSeededRandom();

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

	const [state, setState] = useState(() => dealHand(fullDeck, rng));

	const newHand = useCallback(() => {
		setState(dealHand(fullDeck, rng));
	}, [fullDeck, rng]);

	const shouldScrollRef = useRef(false);

	const draw = useCallback(() => {
		setState((prev) => {
			if (prev.library.length === 0) return prev;
			shouldScrollRef.current = true;
			return {
				hand: [...prev.hand, prev.library[0]],
				library: prev.library.slice(1),
			};
		});
	}, []);

	// Scroll last card into view after draw renders
	const handLength = state.hand.length;
	useEffect(() => {
		if (handLength > 0 && shouldScrollRef.current && containerRef.current) {
			shouldScrollRef.current = false;
			onCardHover?.(state.hand[handLength - 1].cardId);
			// Wait for layout to settle before scrolling
			requestAnimationFrame(() => {
				const lastCard = containerRef.current?.lastElementChild;
				lastCard?.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
					inline: "nearest",
				});
			});
		}
	}, [handLength, onCardHover, state.hand]);

	if (cards.length === 0) return null;

	return (
		<div className="mt-8 pt-8 border-t border-gray-200 dark:border-zinc-600">
			<SeedEmbed />
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Goldfish
				</h2>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={newHand}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
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

			<section
				ref={containerRef}
				aria-label="Sample hand"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region needs keyboard access per axe-core
				tabIndex={0}
				className="flex gap-2 overflow-x-auto pb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 rounded"
			>
				{state.hand.map((card) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: hover is for visual preview only
					<div
						key={card.instanceId}
						className="flex-shrink-0"
						onMouseEnter={() => onCardHover?.(card.cardId)}
						onMouseLeave={() => onCardHover?.(null)}
					>
						<CardImage
							card={{ id: card.cardId, name: "" }}
							size="normal"
							className="h-52 aspect-[5/7] rounded-lg"
						/>
					</div>
				))}
			</section>
		</div>
	);
}
