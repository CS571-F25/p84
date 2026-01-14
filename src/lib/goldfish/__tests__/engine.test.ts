import { describe, expect, it } from "vitest";
import type { DeckCard } from "@/lib/deck-types";
import { asOracleId, asScryfallId } from "@/lib/scryfall-types";
import { createSeededRng } from "@/lib/useSeededRandom";
import {
	addCounter,
	adjustLife,
	adjustPoison,
	clearCounters,
	createInitialState,
	cycleFace,
	draw,
	flipCard,
	moveCard,
	mulligan,
	removeCounter,
	setCounter,
	setHoveredCard,
	tap,
	toggleFaceDown,
	toggleTap,
	untap,
	untapAll,
} from "../engine";
import type { GameState } from "../types";

function mockDeck(count: number): DeckCard[] {
	return Array.from({ length: count }, (_, i) => ({
		scryfallId: asScryfallId(`card-${i}`),
		oracleId: asOracleId(`oracle-${i}`),
		quantity: 1,
		section: "mainboard" as const,
		tags: [],
	}));
}

function createTestRng(seed = 42): () => number {
	const stateRef = { current: seed };
	return createSeededRng(stateRef);
}

describe("createInitialState", () => {
	it("creates state with 7 cards in hand", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		expect(state.hand).toHaveLength(7);
	});

	it("puts remaining cards in library", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		expect(state.library).toHaveLength(53);
	});

	it("starts with empty battlefield, graveyard, and exile", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		expect(state.battlefield).toHaveLength(0);
		expect(state.graveyard).toHaveLength(0);
		expect(state.exile).toHaveLength(0);
	});

	it("assigns unique instanceIds to all cards", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		const allCards = [...state.hand, ...state.library];
		const ids = allCards.map((c) => c.instanceId);
		const uniqueIds = new Set(ids);

		expect(uniqueIds.size).toBe(60);
	});

	it("uses custom starting life", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng(), 40);

		expect(state.player.life).toBe(40);
	});

	it("defaults to 20 life", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		expect(state.player.life).toBe(20);
	});
});

describe("draw", () => {
	it("moves top card from library to hand", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());
		const topCard = state.library[0];

		const newState = draw(state);

		expect(newState.hand).toHaveLength(8);
		expect(newState.library).toHaveLength(52);
		expect(newState.hand[7].instanceId).toBe(topCard.instanceId);
		expect(newState.hand[7].cardId).toBe(topCard.cardId);
	});

	it("reveals drawn card (sets isFaceDown to false)", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		// Library cards start face-down
		expect(state.library[0].isFaceDown).toBe(true);

		const newState = draw(state);

		// Drawn card should be face-up
		expect(newState.hand[7].isFaceDown).toBe(false);
	});

	it("returns same state if library is empty", () => {
		const state: GameState = {
			hand: [],
			library: [],
			battlefield: [],
			graveyard: [],
			exile: [],
			hoveredId: null,
			nextZIndex: 1,
			player: { life: 20, poison: 0, counters: {} },
		};

		const newState = draw(state);

		expect(newState).toBe(state);
	});
});

describe("mulligan", () => {
	it("reshuffles all cards and deals new hand", () => {
		const deck = mockDeck(60);
		const state = createInitialState(deck, createTestRng());

		const newState = mulligan(state, createTestRng(123));

		expect(newState.hand).toHaveLength(7);
		expect(newState.library).toHaveLength(53);
		expect(newState.battlefield).toHaveLength(0);
	});

	it("includes cards from all zones in reshuffle", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		state = moveCard(state, state.hand[0].instanceId, "graveyard");

		const newState = mulligan(state, createTestRng(456));

		const totalCards =
			newState.hand.length +
			newState.library.length +
			newState.battlefield.length +
			newState.graveyard.length +
			newState.exile.length;
		expect(totalCards).toBe(10);
	});

	it("resets card state on mulligan", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		state = tap(state, state.battlefield[0].instanceId);
		state = addCounter(state, state.battlefield[0].instanceId, "+1/+1", 3);

		const newState = mulligan(state, createTestRng(789));

		const allCards = [...newState.hand, ...newState.library];
		for (const card of allCards) {
			expect(card.isTapped).toBe(false);
			expect(card.counters).toEqual({});
		}
	});
});

describe("tap/untap", () => {
	it("tap sets isTapped to true", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		const cardId = state.battlefield[0].instanceId;

		const newState = tap(state, cardId);

		expect(newState.battlefield[0].isTapped).toBe(true);
	});

	it("untap sets isTapped to false", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		state = tap(state, state.battlefield[0].instanceId);
		const cardId = state.battlefield[0].instanceId;

		const newState = untap(state, cardId);

		expect(newState.battlefield[0].isTapped).toBe(false);
	});

	it("toggleTap flips isTapped", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		const cardId = state.battlefield[0].instanceId;

		expect(state.battlefield[0].isTapped).toBe(false);

		state = toggleTap(state, cardId);
		expect(state.battlefield[0].isTapped).toBe(true);

		state = toggleTap(state, cardId);
		expect(state.battlefield[0].isTapped).toBe(false);
	});

	it("untapAll untaps all battlefield cards", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		state = moveCard(state, state.hand[0].instanceId, "battlefield");
		state = tap(state, state.battlefield[0].instanceId);
		state = tap(state, state.battlefield[1].instanceId);

		const newState = untapAll(state);

		expect(newState.battlefield[0].isTapped).toBe(false);
		expect(newState.battlefield[1].isTapped).toBe(false);
	});
});

describe("cycleFace", () => {
	it("increments faceIndex", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = cycleFace(state, cardId, 2);

		expect(state.hand[0].faceIndex).toBe(1);
	});

	it("wraps around at maxFaces", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = cycleFace(state, cardId, 2);
		state = cycleFace(state, cardId, 2);

		expect(state.hand[0].faceIndex).toBe(0);
	});

	it("does nothing for single-faced cards", () => {
		const deck = mockDeck(10);
		const state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		const newState = cycleFace(state, cardId, 1);

		expect(newState).toBe(state);
	});
});

describe("toggleFaceDown", () => {
	it("toggles isFaceDown for morph/manifest", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		expect(state.hand[0].isFaceDown).toBe(false);

		state = toggleFaceDown(state, cardId);
		expect(state.hand[0].isFaceDown).toBe(true);

		state = toggleFaceDown(state, cardId);
		expect(state.hand[0].isFaceDown).toBe(false);
	});
});

describe("flipCard", () => {
	it("reveals face-down card", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = toggleFaceDown(state, cardId);
		expect(state.hand[0].isFaceDown).toBe(true);

		state = flipCard(state, cardId, 1);

		expect(state.hand[0].isFaceDown).toBe(false);
	});

	it("cycles face for DFC when face-up", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		expect(state.hand[0].faceIndex).toBe(0);

		state = flipCard(state, cardId, 2);

		expect(state.hand[0].faceIndex).toBe(1);
		expect(state.hand[0].isFaceDown).toBe(false);
	});

	it("wraps around when cycling DFC faces", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = flipCard(state, cardId, 2);
		state = flipCard(state, cardId, 2);

		expect(state.hand[0].faceIndex).toBe(0);
	});

	it("morphs single-faced card when face-up", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		expect(state.hand[0].isFaceDown).toBe(false);

		state = flipCard(state, cardId, 1);

		expect(state.hand[0].isFaceDown).toBe(true);
	});

	it("reveals face-down DFC to front face", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = toggleFaceDown(state, cardId);
		expect(state.hand[0].isFaceDown).toBe(true);

		state = flipCard(state, cardId, 2);

		expect(state.hand[0].isFaceDown).toBe(false);
		expect(state.hand[0].faceIndex).toBe(0);
	});

	it("toggles between morph and reveal for single-faced card", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = flipCard(state, cardId, 1);
		expect(state.hand[0].isFaceDown).toBe(true);

		state = flipCard(state, cardId, 1);
		expect(state.hand[0].isFaceDown).toBe(false);

		state = flipCard(state, cardId, 1);
		expect(state.hand[0].isFaceDown).toBe(true);
	});
});

describe("moveCard", () => {
	it("moves card between zones", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = moveCard(state, cardId, "battlefield");

		expect(state.hand).toHaveLength(6);
		expect(state.battlefield).toHaveLength(1);
		expect(state.battlefield[0].instanceId).toBe(cardId);
	});

	it("sets position when moving to battlefield", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = moveCard(state, cardId, "battlefield", {
			position: { x: 200, y: 300 },
		});

		expect(state.battlefield[0].position).toEqual({ x: 200, y: 300 });
	});

	it("uses default position if none provided", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = moveCard(state, cardId, "battlefield");

		expect(state.battlefield[0].position).toEqual({ x: 100, y: 100 });
	});

	it("clears position when leaving battlefield", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield", {
			position: { x: 200, y: 300 },
		});
		const cardId = state.battlefield[0].instanceId;

		state = moveCard(state, cardId, "graveyard");

		expect(state.graveyard[0].position).toBeUndefined();
	});

	it("updates position when moving within battlefield", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = moveCard(state, state.hand[0].instanceId, "battlefield", {
			position: { x: 100, y: 100 },
		});
		const cardId = state.battlefield[0].instanceId;

		state = moveCard(state, cardId, "battlefield", {
			position: { x: 500, y: 600 },
		});

		expect(state.battlefield[0].position).toEqual({ x: 500, y: 600 });
	});
});

describe("setHoveredCard", () => {
	it("sets hoveredId", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());

		state = setHoveredCard(state, 5);

		expect(state.hoveredId).toBe(5);
	});

	it("returns same state if hoveredId unchanged", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = setHoveredCard(state, 5);

		const newState = setHoveredCard(state, 5);

		expect(newState).toBe(state);
	});
});

describe("counters", () => {
	it("addCounter adds counters to a card", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = addCounter(state, cardId, "+1/+1", 3);

		expect(state.hand[0].counters["+1/+1"]).toBe(3);
	});

	it("addCounter stacks with existing counters", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = addCounter(state, cardId, "+1/+1", 3);
		state = addCounter(state, cardId, "+1/+1", 2);

		expect(state.hand[0].counters["+1/+1"]).toBe(5);
	});

	it("removeCounter removes counters", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = addCounter(state, cardId, "+1/+1", 5);
		state = removeCounter(state, cardId, "+1/+1", 2);

		expect(state.hand[0].counters["+1/+1"]).toBe(3);
	});

	it("removeCounter deletes counter type when reaching zero", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = addCounter(state, cardId, "+1/+1", 3);
		state = removeCounter(state, cardId, "+1/+1", 3);

		expect(state.hand[0].counters["+1/+1"]).toBeUndefined();
	});

	it("setCounter sets counter to specific value", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = setCounter(state, cardId, "loyalty", 4);

		expect(state.hand[0].counters.loyalty).toBe(4);
	});

	it("clearCounters removes all counters", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		const cardId = state.hand[0].instanceId;

		state = addCounter(state, cardId, "+1/+1", 3);
		state = addCounter(state, cardId, "charge", 5);
		state = clearCounters(state, cardId);

		expect(state.hand[0].counters).toEqual({});
	});
});

describe("player state", () => {
	it("adjustLife changes life total", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());

		state = adjustLife(state, -5);

		expect(state.player.life).toBe(15);
	});

	it("adjustPoison changes poison counters", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());

		state = adjustPoison(state, 3);

		expect(state.player.poison).toBe(3);
	});

	it("adjustPoison cannot go below zero", () => {
		const deck = mockDeck(10);
		let state = createInitialState(deck, createTestRng());
		state = adjustPoison(state, 3);

		state = adjustPoison(state, -10);

		expect(state.player.poison).toBe(0);
	});
});
