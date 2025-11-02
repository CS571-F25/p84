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
import { getCardWithPrintingsQueryOptions } from "@/lib/queries";
import { asScryfallId, type ScryfallId } from "@/lib/scryfall-types";

// Test deck card IDs (TODO: remove when ATProto persistence is implemented)
const TEST_CARD_IDS = [
	asScryfallId("adc7f8f3-140d-4dd0-aacc-b81b2b93eb67"),
	asScryfallId("77c6fa74-5543-42ac-9ead-0e890b188e99"),
	asScryfallId("7ee610ee-7711-4a6b-b441-d6c73e6ef2b4"),
] as const;

export const Route = createFileRoute("/deck/$id")({
	component: DeckEditorPage,
	loader: async ({ context }) => {
		// Prefetch card data for test deck cards during SSR
		await Promise.all(
			TEST_CARD_IDS.map((id) =>
				context.queryClient.ensureQueryData(
					getCardWithPrintingsQueryOptions(id),
				),
			),
		);
	},
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
					scryfallId: TEST_CARD_IDS[0],
					quantity: 1,
					section: "commander",
					tags: [],
				},
				{
					scryfallId: TEST_CARD_IDS[1],
					quantity: 1,
					section: "mainboard",
					tags: ["removal", "instant"],
				},
				{
					scryfallId: TEST_CARD_IDS[2],
					quantity: 1,
					section: "mainboard",
					tags: ["ramp"],
				},
				{
					scryfallId: asScryfallId("eb6d8d1c-8d23-4273-9c9b-f3b71eb0e105"),
					quantity: 2,
					section: "sideboard",
					tags: ["would taste good fried"],
				},
				{
					scryfallId: asScryfallId("77c1a141-3955-47f9-bd22-b642728724ab"),
					quantity: 1,
					section: "sideboard",
					tags: ["illegal"],
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
