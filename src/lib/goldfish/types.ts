import type { ScryfallId } from "@/lib/scryfall-types";

export interface CardInstance {
	cardId: ScryfallId;
	instanceId: number;
	isTapped: boolean;
	isFaceDown: boolean;
	faceIndex: number;
	position?: { x: number; y: number };
	zIndex: number;
	counters: Record<string, number>;
}

export type Zone = "hand" | "battlefield" | "graveyard" | "exile" | "library";

export interface PlayerState {
	life: number;
	poison: number;
	counters: Record<string, number>;
}

export interface GameState {
	hand: CardInstance[];
	library: CardInstance[];
	battlefield: CardInstance[];
	graveyard: CardInstance[];
	exile: CardInstance[];
	hoveredId: number | null;
	nextZIndex: number;
	player: PlayerState;
}

export function createCardInstance(
	cardId: ScryfallId,
	instanceId: number,
): CardInstance {
	return {
		cardId,
		instanceId,
		isTapped: false,
		isFaceDown: false,
		faceIndex: 0,
		zIndex: 0,
		counters: {},
	};
}

export function createPlayerState(startingLife = 20): PlayerState {
	return {
		life: startingLife,
		poison: 0,
		counters: {},
	};
}

export function createEmptyGameState(startingLife = 20): GameState {
	return {
		hand: [],
		library: [],
		battlefield: [],
		graveyard: [],
		exile: [],
		hoveredId: null,
		nextZIndex: 1,
		player: createPlayerState(startingLife),
	};
}
