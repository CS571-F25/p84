import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CardModal } from "@/components/deck/CardModal";
import { CardPreviewPane } from "@/components/deck/CardPreviewPane";
import { CardSearchAutocomplete } from "@/components/deck/CardSearchAutocomplete";
import { DeckHeader } from "@/components/deck/DeckHeader";
import { DeckSection } from "@/components/deck/DeckSection";
import type { Deck, Section } from "@/lib/deck-types";
import {
	addCardToDeck,
	type DeckCard,
	getCardsInSection,
	moveCardToSection,
	removeCardFromDeck,
	updateCardQuantity,
	updateCardTags,
} from "@/lib/deck-types";
import { asScryfallId, type ScryfallId } from "@/lib/scryfall-types";

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

	const [previewCard, setPreviewCard] = useState<ScryfallId | null>(null);
	const [modalCard, setModalCard] = useState<DeckCard | null>(null);

	const handleCardHover = (cardId: ScryfallId | null) => {
		// Only update preview if we have a card (persistence - don't clear on null)
		if (cardId !== null) {
			setPreviewCard(cardId);
		}
	};

	const handleCardClick = (card: DeckCard) => {
		setModalCard(card);
	};

	const handleModalClose = () => {
		setModalCard(null);
	};

	const handleUpdateQuantity = (quantity: number) => {
		if (!modalCard) return;
		setDeck((prev) =>
			updateCardQuantity(
				prev,
				modalCard.scryfallId,
				modalCard.section as Section,
				quantity,
			),
		);
	};

	const handleUpdateTags = (tags: string[]) => {
		if (!modalCard) return;
		setDeck((prev) =>
			updateCardTags(
				prev,
				modalCard.scryfallId,
				modalCard.section as Section,
				tags,
			),
		);
	};

	const handleMoveToSection = (newSection: Section) => {
		if (!modalCard) return;
		setDeck((prev) =>
			moveCardToSection(
				prev,
				modalCard.scryfallId,
				modalCard.section as Section,
				newSection,
			),
		);
		setModalCard((prev) => (prev ? { ...prev, section: newSection } : null));
	};

	const handleDeleteCard = () => {
		if (!modalCard) return;
		setDeck((prev) =>
			removeCardFromDeck(
				prev,
				modalCard.scryfallId,
				modalCard.section as Section,
			),
		);
	};

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

	const handleCardSelect = (cardId: ScryfallId) => {
		setDeck((prev) => addCardToDeck(prev, cardId, "mainboard", 1));
	};

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			{/* Deck name and format (scrolls away) */}
			<div className="max-w-7xl mx-auto px-6 pt-8 pb-4">
				<DeckHeader
					name={deck.name}
					format={deck.format}
					onNameChange={handleNameChange}
					onFormatChange={handleFormatChange}
				/>
			</div>

			{/* Sticky header with search */}
			<div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm">
				<div className="max-w-7xl mx-auto px-6 py-3 flex justify-end">
					<div className="w-full max-w-md">
						<CardSearchAutocomplete
							format={deck.format}
							onCardSelect={handleCardSelect}
							onCardHover={handleCardHover}
						/>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
					{/* Left pane: Card preview (40%) */}
					<div className="lg:col-span-2">
						<CardPreviewPane cardId={previewCard} />
					</div>

					{/* Right pane: Deck sections (60%) */}
					<div className="lg:col-span-3">
						<DeckSection
							section="commander"
							cards={getCardsInSection(deck, "commander")}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
						/>
						<DeckSection
							section="mainboard"
							cards={getCardsInSection(deck, "mainboard")}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
						/>
						<DeckSection
							section="sideboard"
							cards={getCardsInSection(deck, "sideboard")}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
						/>
						<DeckSection
							section="maybeboard"
							cards={getCardsInSection(deck, "maybeboard")}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
						/>
					</div>
				</div>
			</div>

			{/* Card Modal */}
			{modalCard && (
				<CardModal
					card={modalCard}
					isOpen={true}
					onClose={handleModalClose}
					onUpdateQuantity={handleUpdateQuantity}
					onUpdateTags={handleUpdateTags}
					onMoveToSection={handleMoveToSection}
					onDelete={handleDeleteCard}
				/>
			)}
		</div>
	);
}
