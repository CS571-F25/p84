import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckCard } from "@/lib/deck-types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import { useSeededRandom } from "@/lib/useSeededRandom";
import * as engine from "./engine";
import type { GameState, Zone } from "./types";

export interface GoldfishActions {
	draw: () => void;
	mulligan: () => void;
	reset: () => void;
	tap: (instanceId: number) => void;
	untap: (instanceId: number) => void;
	toggleTap: (instanceId: number) => void;
	untapAll: () => void;
	cycleFace: (instanceId: number, maxFaces: number) => void;
	toggleFaceDown: (instanceId: number) => void;
	moveCard: (
		instanceId: number,
		toZone: Zone,
		position?: { x: number; y: number },
	) => void;
	setHoveredCard: (instanceId: number | null) => void;
	addCounter: (
		instanceId: number,
		counterType: string,
		amount?: number,
	) => void;
	removeCounter: (
		instanceId: number,
		counterType: string,
		amount?: number,
	) => void;
	setCounter: (instanceId: number, counterType: string, value: number) => void;
	clearCounters: (instanceId: number) => void;
	adjustLife: (amount: number) => void;
	adjustPoison: (amount: number) => void;
}

export interface UseGoldfishGameOptions {
	startingLife?: number;
	cardLookup?: (id: ScryfallId) => Card | undefined;
}

export interface UseGoldfishGameResult {
	state: GameState;
	actions: GoldfishActions;
	SeedEmbed: () => React.ReactElement;
}

export function useGoldfishGame(
	deck: DeckCard[],
	options: UseGoldfishGameOptions = {},
): UseGoldfishGameResult {
	const { startingLife = 20, cardLookup } = options;
	const { rng, SeedEmbed } = useSeededRandom();

	const [state, setState] = useState<GameState>(() =>
		engine.createInitialState(deck, rng, startingLife),
	);

	const actions: GoldfishActions = useMemo(
		() => ({
			draw: () => setState((s) => engine.draw(s)),
			mulligan: () => setState((s) => engine.mulligan(s, rng, startingLife)),
			reset: () => setState(engine.createInitialState(deck, rng, startingLife)),
			tap: (id) => setState((s) => engine.tap(s, id)),
			untap: (id) => setState((s) => engine.untap(s, id)),
			toggleTap: (id) => setState((s) => engine.toggleTap(s, id)),
			untapAll: () => setState((s) => engine.untapAll(s)),
			cycleFace: (id, maxFaces) =>
				setState((s) => engine.cycleFace(s, id, maxFaces)),
			toggleFaceDown: (id) => setState((s) => engine.toggleFaceDown(s, id)),
			moveCard: (id, zone, pos) =>
				setState((s) => engine.moveCard(s, id, zone, pos)),
			setHoveredCard: (id) => setState((s) => engine.setHoveredCard(s, id)),
			addCounter: (id, type, amount) =>
				setState((s) => engine.addCounter(s, id, type, amount)),
			removeCounter: (id, type, amount) =>
				setState((s) => engine.removeCounter(s, id, type, amount)),
			setCounter: (id, type, value) =>
				setState((s) => engine.setCounter(s, id, type, value)),
			clearCounters: (id) => setState((s) => engine.clearCounters(s, id)),
			adjustLife: (amount) => setState((s) => engine.adjustLife(s, amount)),
			adjustPoison: (amount) => setState((s) => engine.adjustPoison(s, amount)),
		}),
		[deck, rng, startingLife],
	);

	const getFaceCount = useCallback(
		(cardId: ScryfallId): number => {
			if (!cardLookup) return 1;
			const card = cardLookup(cardId);
			if (!card) return 1;
			return card.card_faces?.length ?? 1;
		},
		[cardLookup],
	);

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			const hoveredId = state.hoveredId;

			switch (e.key.toLowerCase()) {
				case "d":
					e.preventDefault();
					actions.draw();
					break;
				case "u":
					e.preventDefault();
					actions.untapAll();
					break;
				case "t":
				case " ":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.toggleTap(hoveredId);
					}
					break;
				case "f":
					if (hoveredId !== null) {
						e.preventDefault();
						const card = [
							...state.hand,
							...state.battlefield,
							...state.graveyard,
							...state.exile,
						].find((c) => c.instanceId === hoveredId);
						if (card) {
							actions.cycleFace(hoveredId, getFaceCount(card.cardId));
						}
					}
					break;
				case "m":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.toggleFaceDown(hoveredId);
					}
					break;
				case "g":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.moveCard(hoveredId, "graveyard");
					}
					break;
				case "e":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.moveCard(hoveredId, "exile");
					}
					break;
				case "h":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.moveCard(hoveredId, "hand");
					}
					break;
				case "b":
					if (hoveredId !== null) {
						e.preventDefault();
						actions.moveCard(hoveredId, "battlefield");
					}
					break;
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		state.hoveredId,
		state.hand,
		state.battlefield,
		state.graveyard,
		state.exile,
		actions,
		getFaceCount,
	]);

	return { state, actions, SeedEmbed };
}
