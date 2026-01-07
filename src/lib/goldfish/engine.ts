import type { DeckCard } from "@/lib/deck-types";
import { seededShuffle } from "@/lib/useSeededRandom";
import {
	type CardInstance,
	createCardInstance,
	createEmptyGameState,
	type GameState,
	type Zone,
} from "./types";

function findCard(
	state: GameState,
	instanceId: number,
): { card: CardInstance; zone: Zone } | null {
	const zones: Zone[] = [
		"hand",
		"battlefield",
		"graveyard",
		"exile",
		"library",
	];
	for (const zone of zones) {
		const card = state[zone].find((c) => c.instanceId === instanceId);
		if (card) return { card, zone };
	}
	return null;
}

function updateCardInState(
	state: GameState,
	instanceId: number,
	updater: (card: CardInstance) => CardInstance,
): GameState {
	const found = findCard(state, instanceId);
	if (!found) return state;

	return {
		...state,
		[found.zone]: state[found.zone].map((c) =>
			c.instanceId === instanceId ? updater(c) : c,
		),
	};
}

export function createInitialState(
	deck: DeckCard[],
	rng: () => number,
	startingLife = 20,
): GameState {
	const instances: CardInstance[] = [];
	let instanceId = 0;

	for (const card of deck) {
		for (let i = 0; i < card.quantity; i++) {
			instances.push(createCardInstance(card.scryfallId, instanceId++));
		}
	}

	const shuffled = seededShuffle(instances, rng);

	return {
		...createEmptyGameState(startingLife),
		hand: shuffled.slice(0, 7),
		library: shuffled.slice(7),
	};
}

export function draw(state: GameState): GameState {
	if (state.library.length === 0) return state;

	const [drawn, ...rest] = state.library;
	return {
		...state,
		hand: [...state.hand, drawn],
		library: rest,
	};
}

export function mulligan(
	state: GameState,
	rng: () => number,
	startingLife = 20,
): GameState {
	const allCards = [
		...state.hand,
		...state.library,
		...state.battlefield,
		...state.graveyard,
		...state.exile,
	].map((card) => ({
		...card,
		isTapped: false,
		isFaceDown: false,
		faceIndex: 0,
		counters: {},
		position: undefined,
	}));

	const shuffled = seededShuffle(allCards, rng);

	return {
		...createEmptyGameState(startingLife),
		hand: shuffled.slice(0, 7),
		library: shuffled.slice(7),
	};
}

export function tap(state: GameState, instanceId: number): GameState {
	return updateCardInState(state, instanceId, (card) => ({
		...card,
		isTapped: true,
	}));
}

export function untap(state: GameState, instanceId: number): GameState {
	return updateCardInState(state, instanceId, (card) => ({
		...card,
		isTapped: false,
	}));
}

export function toggleTap(state: GameState, instanceId: number): GameState {
	return updateCardInState(state, instanceId, (card) => ({
		...card,
		isTapped: !card.isTapped,
	}));
}

export function untapAll(state: GameState): GameState {
	return {
		...state,
		battlefield: state.battlefield.map((card) => ({
			...card,
			isTapped: false,
		})),
	};
}

export function cycleFace(
	state: GameState,
	instanceId: number,
	maxFaces: number,
): GameState {
	if (maxFaces <= 1) return state;

	return updateCardInState(state, instanceId, (card) => ({
		...card,
		faceIndex: (card.faceIndex + 1) % maxFaces,
	}));
}

export function toggleFaceDown(
	state: GameState,
	instanceId: number,
): GameState {
	return updateCardInState(state, instanceId, (card) => ({
		...card,
		isFaceDown: !card.isFaceDown,
	}));
}

export function moveCard(
	state: GameState,
	instanceId: number,
	toZone: Zone,
	position?: { x: number; y: number },
): GameState {
	const found = findCard(state, instanceId);
	if (!found) return state;

	const { card, zone: fromZone } = found;

	if (fromZone === toZone) {
		if (toZone === "battlefield" && position) {
			return updateCardInState(state, instanceId, (c) => ({
				...c,
				position,
			}));
		}
		return state;
	}

	const movedCard: CardInstance =
		toZone === "battlefield"
			? { ...card, position: position ?? { x: 100, y: 100 } }
			: { ...card, position: undefined };

	return {
		...state,
		[fromZone]: state[fromZone].filter((c) => c.instanceId !== instanceId),
		[toZone]: [...state[toZone], movedCard],
	};
}

export function setHoveredCard(
	state: GameState,
	instanceId: number | null,
): GameState {
	if (state.hoveredId === instanceId) return state;
	return {
		...state,
		hoveredId: instanceId,
	};
}

export function resetGame(
	deck: DeckCard[],
	rng: () => number,
	startingLife = 20,
): GameState {
	return createInitialState(deck, rng, startingLife);
}

// Counter manipulation

export function addCounter(
	state: GameState,
	instanceId: number,
	counterType: string,
	amount = 1,
): GameState {
	return updateCardInState(state, instanceId, (card) => {
		const current = card.counters[counterType] ?? 0;
		const newValue = current + amount;
		if (newValue <= 0) {
			const { [counterType]: _, ...rest } = card.counters;
			return { ...card, counters: rest };
		}
		return {
			...card,
			counters: { ...card.counters, [counterType]: newValue },
		};
	});
}

export function removeCounter(
	state: GameState,
	instanceId: number,
	counterType: string,
	amount = 1,
): GameState {
	return addCounter(state, instanceId, counterType, -amount);
}

export function setCounter(
	state: GameState,
	instanceId: number,
	counterType: string,
	value: number,
): GameState {
	return updateCardInState(state, instanceId, (card) => {
		if (value <= 0) {
			const { [counterType]: _, ...rest } = card.counters;
			return { ...card, counters: rest };
		}
		return {
			...card,
			counters: { ...card.counters, [counterType]: value },
		};
	});
}

export function clearCounters(state: GameState, instanceId: number): GameState {
	return updateCardInState(state, instanceId, (card) => ({
		...card,
		counters: {},
	}));
}

// Player state manipulation

export function setLife(state: GameState, life: number): GameState {
	return {
		...state,
		player: { ...state.player, life },
	};
}

export function adjustLife(state: GameState, amount: number): GameState {
	return setLife(state, state.player.life + amount);
}

export function setPoison(state: GameState, poison: number): GameState {
	return {
		...state,
		player: { ...state.player, poison: Math.max(0, poison) },
	};
}

export function adjustPoison(state: GameState, amount: number): GameState {
	return setPoison(state, state.player.poison + amount);
}

export function addPlayerCounter(
	state: GameState,
	counterType: string,
	amount = 1,
): GameState {
	const current = state.player.counters[counterType] ?? 0;
	const newValue = current + amount;
	if (newValue <= 0) {
		const { [counterType]: _, ...rest } = state.player.counters;
		return {
			...state,
			player: { ...state.player, counters: rest },
		};
	}
	return {
		...state,
		player: {
			...state.player,
			counters: { ...state.player.counters, [counterType]: newValue },
		},
	};
}
