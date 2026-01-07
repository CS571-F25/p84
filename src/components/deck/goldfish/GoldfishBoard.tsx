import type { DragEndEvent } from "@dnd-kit/core";
import { useCallback, useRef } from "react";
import { CardImage } from "@/components/CardImage";
import type { DeckCard } from "@/lib/deck-types";
import { useGoldfishGame } from "@/lib/goldfish";
import type { CardInstance, Zone } from "@/lib/goldfish/types";
import type { Card, ScryfallId } from "@/lib/scryfall-types";
import {
	type DragPosition,
	GoldfishDragDropProvider,
} from "../GoldfishDragDropProvider";
import { GoldfishBattlefield } from "./GoldfishBattlefield";
import { GoldfishHand } from "./GoldfishHand";
import { GoldfishSidebar } from "./GoldfishSidebar";

interface GoldfishBoardProps {
	deck: DeckCard[];
	cardLookup: (id: ScryfallId) => Card | undefined;
	startingLife?: number;
}

export function GoldfishBoard({
	deck,
	cardLookup,
	startingLife = 20,
}: GoldfishBoardProps) {
	const { state, actions, SeedEmbed } = useGoldfishGame(deck, {
		startingLife,
		cardLookup,
	});

	const battlefieldRef = useRef<HTMLDivElement>(null);

	const handleDragEnd = useCallback(
		(event: DragEndEvent, lastPosition: DragPosition | null) => {
			const { active, over, delta } = event;

			if (!over) return;

			const cardData = active.data.current as
				| { instance: CardInstance; fromLibrary?: boolean }
				| undefined;
			if (!cardData?.instance) return;

			const instance = cardData.instance;
			const instanceId = instance.instanceId;
			const fromLibrary = cardData.fromLibrary ?? false;
			const targetZone = (over.data.current as { zone: Zone } | undefined)
				?.zone;

			if (!targetZone) return;

			if (targetZone === "battlefield") {
				const battlefieldRect = battlefieldRef.current?.getBoundingClientRect();

				if (battlefieldRect) {
					let x: number;
					let y: number;

					if (instance.position) {
						// Card is already on battlefield - just add delta
						x = instance.position.x + delta.x;
						y = instance.position.y + delta.y;
					} else if (lastPosition?.translated) {
						// Card coming from another zone - use tracked translated position
						// (rect.current.translated is null in onDragEnd, so we track it in onDragMove)
						x = lastPosition.translated.left - battlefieldRect.left;
						y = lastPosition.translated.top - battlefieldRect.top;
					} else {
						// Fallback: center of battlefield
						x = battlefieldRect.width / 2;
						y = battlefieldRect.height / 2;
					}

					actions.moveCard(instanceId, targetZone, {
						position: { x, y },
						faceDown: fromLibrary ? true : undefined,
					});
				} else {
					actions.moveCard(instanceId, targetZone, {
						faceDown: fromLibrary ? true : undefined,
					});
				}
			} else {
				actions.moveCard(instanceId, targetZone, {
					faceDown: fromLibrary ? true : undefined,
				});
			}
		},
		[actions],
	);

	const hoveredCard = state.hoveredId
		? [
				...state.hand,
				...state.battlefield,
				...state.graveyard,
				...state.exile,
			].find((c) => c.instanceId === state.hoveredId)
		: null;

	const hoveredCardData = hoveredCard ? cardLookup(hoveredCard.cardId) : null;

	return (
		<GoldfishDragDropProvider onDragEnd={handleDragEnd}>
			<SeedEmbed />
			<div className="flex h-full gap-4 p-4 bg-white dark:bg-slate-950">
				{/* Left: Card Preview */}
				<div className="w-64 flex-shrink-0">
					{hoveredCardData ? (
						<CardImage
							card={hoveredCardData}
							size="large"
							className="w-full aspect-[5/7] rounded-lg shadow-lg"
							isFlipped={
								hoveredCard?.faceIndex ? hoveredCard.faceIndex > 0 : false
							}
						/>
					) : (
						<div className="w-full aspect-[5/7] rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
							Hover a card
						</div>
					)}
				</div>

				{/* Center: Battlefield + Hand */}
				<div className="flex-1 flex flex-col gap-4 min-w-0">
					<GoldfishBattlefield
						ref={battlefieldRef}
						cards={state.battlefield}
						cardLookup={cardLookup}
						onHover={actions.setHoveredCard}
						onClick={actions.toggleTap}
					/>
					<GoldfishHand
						cards={state.hand}
						cardLookup={cardLookup}
						onHover={actions.setHoveredCard}
						onClick={(id) => actions.moveCard(id, "battlefield")}
					/>
				</div>

				{/* Right: Sidebar */}
				<GoldfishSidebar
					library={state.library}
					graveyard={state.graveyard}
					exile={state.exile}
					player={state.player}
					cardLookup={cardLookup}
					onHover={actions.setHoveredCard}
					onClick={actions.toggleTap}
					onDraw={actions.draw}
					onUntapAll={actions.untapAll}
					onMulligan={actions.mulligan}
					onReset={actions.reset}
					onAdjustLife={actions.adjustLife}
					onAdjustPoison={actions.adjustPoison}
				/>
			</div>
		</GoldfishDragDropProvider>
	);
}
