import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Deck } from "@/lib/deck-types";
import { asScryfallId, type ScryfallId } from "@/lib/scryfall-types";
import { DeckHeader } from "@/components/deck/DeckHeader";
import { CardPreviewPane } from "@/components/deck/CardPreviewPane";
import { DeckSection } from "@/components/deck/DeckSection";
import { getCardsInSection } from "@/lib/deck-types";

export const Route = createFileRoute("/deck/$id")({
	component: DeckEditorPage,
});

function DeckEditorPage() {
	// Initialize deck with some test data
	const [deck, setDeck] = useState<Deck>(() => {
		// TODO: Load from ATProto when persistence is implemented
		// For now, create test deck with hardcoded cards
		return {
			$type: "com.deckbelcher.deck.list",
			name: "Test Commander Deck",
			format: "commander",
			cards: [
				{
					scryfallId: asScryfallId("c73ae1f0-60b6-4c4a-975b-13e659a33f50"),
					quantity: 1,
					section: "commander",
					tags: [],
				},
				{
					scryfallId: asScryfallId("35d73022-46ed-402b-90a1-e3e4a281ce1e"),
					quantity: 1,
					section: "mainboard",
					tags: ["removal", "instant"],
				},
				{
					scryfallId: asScryfallId("2adc7dd4-d9c4-47ce-ac94-bb56dbf4044e"),
					quantity: 1,
					section: "mainboard",
					tags: ["ramp"],
				},
			],
			createdAt: new Date().toISOString(),
		};
	});

	const [hoveredCard, setHoveredCard] = useState<ScryfallId | null>(null);

	const handleNameChange = (name: string) => {
		setDeck((prev) => ({ ...prev, name, updatedAt: new Date().toISOString() }));
	};

	const handleFormatChange = (format: string) => {
		setDeck((prev) => ({
			...prev,
			format,
			updatedAt: new Date().toISOString(),
		}));
	};

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-7xl mx-auto px-6 py-8">
				<DeckHeader
					name={deck.name}
					format={deck.format}
					onNameChange={handleNameChange}
					onFormatChange={handleFormatChange}
				/>

				<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
					{/* Left pane: Card preview (40%) */}
					<div className="lg:col-span-2">
						<CardPreviewPane cardId={hoveredCard} />
					</div>

					{/* Right pane: Deck sections (60%) */}
					<div className="lg:col-span-3">
						<DeckSection
							section="commander"
							cards={getCardsInSection(deck, "commander")}
							onCardHover={setHoveredCard}
						/>
						<DeckSection
							section="mainboard"
							cards={getCardsInSection(deck, "mainboard")}
							onCardHover={setHoveredCard}
						/>
						<DeckSection
							section="sideboard"
							cards={getCardsInSection(deck, "sideboard")}
							onCardHover={setHoveredCard}
						/>
						<DeckSection
							section="maybeboard"
							cards={getCardsInSection(deck, "maybeboard")}
							onCardHover={setHoveredCard}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
