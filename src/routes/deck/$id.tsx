import { type DragEndEvent, useDndMonitor } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CardDragOverlay } from "@/components/deck/CardDragOverlay";
import { CardModal } from "@/components/deck/CardModal";
import { CardPreviewPane } from "@/components/deck/CardPreviewPane";
import { CardSearchAutocomplete } from "@/components/deck/CardSearchAutocomplete";
import { CommonTagsOverlay } from "@/components/deck/CommonTagsOverlay";
import { DeckHeader } from "@/components/deck/DeckHeader";
import { DeckSection } from "@/components/deck/DeckSection";
import { DragDropProvider } from "@/components/deck/DragDropProvider";
import type { DragData } from "@/components/deck/DraggableCard";
import { TrashDropZone } from "@/components/deck/TrashDropZone";
import { ViewControls } from "@/components/deck/ViewControls";
import type { Deck, GroupBy, Section, SortBy } from "@/lib/deck-types";
import {
	addCardToDeck,
	type DeckCard,
	getCardsInSection,
	moveCardToSection,
	removeCardFromDeck,
	updateCardQuantity,
	updateCardTags,
} from "@/lib/deck-types";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { asScryfallId, type ScryfallId } from "@/lib/scryfall-types";

// Test deck card IDs (TODO: remove when ATProto persistence is implemented)
const TEST_CARD_IDS = [
	asScryfallId("adc7f8f3-140d-4dd0-aacc-b81b2b93eb67"),
	asScryfallId("77c6fa74-5543-42ac-9ead-0e890b188e99"),
	asScryfallId("7ee610ee-7711-4a6b-b441-d6c73e6ef2b4"),
	asScryfallId("eb6d8d1c-8d23-4273-9c9b-f3b71eb0e105"),
	asScryfallId("77c1a141-3955-47f9-bd22-b642728724ab"),
] as const;

export const Route = createFileRoute("/deck/$id")({
	component: DeckEditorPage,
	loader: async ({ context }) => {
		// Prefetch card data during SSR for grouping/sorting and display
		await Promise.all(
			TEST_CARD_IDS.map((id) =>
				context.queryClient.ensureQueryData(getCardByIdQueryOptions(id)),
			),
		);
	},
});

const VIEW_CONFIG_KEY = "deckbelcher:viewConfig";

interface ViewConfig {
	groupBy: GroupBy;
	sortBy: SortBy;
}

function loadViewConfig(): ViewConfig {
	try {
		const stored = localStorage.getItem(VIEW_CONFIG_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (_e) {
		// Ignore parse errors
	}
	return { groupBy: "tag", sortBy: "name" };
}

function saveViewConfig(config: ViewConfig): void {
	try {
		localStorage.setItem(VIEW_CONFIG_KEY, JSON.stringify(config));
	} catch (_e) {
		// Ignore storage errors
	}
}

function DeckEditorPage() {
	// View configuration with localStorage persistence
	// Start with defaults to avoid SSR hydration mismatch
	const [groupBy, setGroupBy] = useState<GroupBy>("tag");
	const [sortBy, setSortBy] = useState<SortBy>("name");

	// Load from localStorage after mount (client-only)
	useEffect(() => {
		const config = loadViewConfig();
		setGroupBy(config.groupBy);
		setSortBy(config.sortBy);
	}, []);

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

	const [previewCard, setPreviewCard] = useState<ScryfallId>(
		deck.cards?.[0]?.scryfallId,
	);
	const [modalCard, setModalCard] = useState<DeckCard | null>(null);
	const [draggedCardId, setDraggedCardId] = useState<ScryfallId | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const queryClient = useQueryClient();

	// Save view config to localStorage when it changes
	useEffect(() => {
		saveViewConfig({ groupBy, sortBy });
	}, [groupBy, sortBy]);

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

	const handleCardSelect = async (cardId: ScryfallId) => {
		// Prefetch basic card data before adding to ensure it's in the cache
		// This prevents the card from jumping around during grouping/sorting
		// Printings data will load async in DeckCardRow
		await queryClient.prefetchQuery(getCardByIdQueryOptions(cardId));
		setDeck((prev) => addCardToDeck(prev, cardId, "mainboard", 1));
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over) return;

		const dragData = active.data.current as DragData;
		const dropData = over.data.current as
			| { type: "section"; section: Section }
			| { type: "tag"; tagName: string }
			| { type: "trash" }
			| undefined;

		if (!dropData || !dragData) return;

		// Handle trash drop
		if (dropData.type === "trash") {
			// Find the full card object before deleting
			const cardToDelete = deck.cards.find(
				(c) =>
					c.scryfallId === dragData.scryfallId &&
					c.section === dragData.section,
			);

			setDeck((prev) =>
				removeCardFromDeck(
					prev,
					dragData.scryfallId,
					dragData.section as Section,
				),
			);

			// Store the full card for undo
			if (cardToDelete) {
				toast.success("Card removed from deck", {
					action: {
						label: "Undo",
						onClick: () => {
							// Re-insert the exact card that was deleted
							setDeck((prev) => ({
								...prev,
								cards: [...prev.cards, cardToDelete],
								updatedAt: new Date().toISOString(),
							}));
						},
					},
				});
			}
			return;
		}

		// Handle section drop
		if (dropData.type === "section") {
			if (dropData.section === dragData.section) return; // No-op if same section

			setDeck((prev) =>
				moveCardToSection(
					prev,
					dragData.scryfallId,
					dragData.section as Section,
					dropData.section,
				),
			);
			return;
		}

		// Handle tag drop (additive only)
		if (dropData.type === "tag") {
			const newTag = dropData.tagName;
			if (dragData.tags.includes(newTag)) return; // Already has this tag

			const updatedTags = [...dragData.tags, newTag];
			setDeck((prev) =>
				updateCardTags(
					prev,
					dragData.scryfallId,
					dragData.section as Section,
					updatedTags,
				),
			);
		}
	};

	return (
		<DragDropProvider onDragEnd={handleDragEnd}>
			<DeckEditorInner
				deck={deck}
				groupBy={groupBy}
				sortBy={sortBy}
				previewCard={previewCard}
				modalCard={modalCard}
				draggedCardId={draggedCardId}
				isDragging={isDragging}
				setIsDragging={setIsDragging}
				setDraggedCardId={setDraggedCardId}
				handleCardHover={handleCardHover}
				handleCardClick={handleCardClick}
				handleModalClose={handleModalClose}
				handleUpdateQuantity={handleUpdateQuantity}
				handleUpdateTags={handleUpdateTags}
				handleMoveToSection={handleMoveToSection}
				handleDeleteCard={handleDeleteCard}
				handleNameChange={handleNameChange}
				handleFormatChange={handleFormatChange}
				handleCardSelect={handleCardSelect}
				setGroupBy={setGroupBy}
				setSortBy={setSortBy}
			/>
		</DragDropProvider>
	);
}

interface DeckEditorInnerProps {
	deck: Deck;
	groupBy: GroupBy;
	sortBy: SortBy;
	previewCard: ScryfallId;
	modalCard: DeckCard | null;
	draggedCardId: ScryfallId | null;
	isDragging: boolean;
	setIsDragging: (dragging: boolean) => void;
	setDraggedCardId: (id: ScryfallId | null) => void;
	handleCardHover: (cardId: ScryfallId | null) => void;
	handleCardClick: (card: DeckCard) => void;
	handleModalClose: () => void;
	handleUpdateQuantity: (quantity: number) => void;
	handleUpdateTags: (tags: string[]) => void;
	handleMoveToSection: (section: Section) => void;
	handleDeleteCard: () => void;
	handleNameChange: (name: string) => void;
	handleFormatChange: (format: string) => void;
	handleCardSelect: (cardId: ScryfallId) => Promise<void>;
	setGroupBy: (groupBy: GroupBy) => void;
	setSortBy: (sortBy: SortBy) => void;
}

function DeckEditorInner({
	deck,
	groupBy,
	sortBy,
	previewCard,
	modalCard,
	draggedCardId,
	isDragging,
	setIsDragging,
	setDraggedCardId,
	handleCardHover,
	handleCardClick,
	handleModalClose,
	handleUpdateQuantity,
	handleUpdateTags,
	handleMoveToSection,
	handleDeleteCard,
	handleNameChange,
	handleFormatChange,
	handleCardSelect,
	setGroupBy,
	setSortBy,
}: DeckEditorInnerProps) {
	// Track drag state globally (must be inside DndContext)
	useDndMonitor({
		onDragStart: (event) => {
			setIsDragging(true);
			const dragData = event.active.data.current as DragData | undefined;
			if (dragData) {
				setDraggedCardId(dragData.scryfallId);
			}
		},
		onDragEnd: () => {
			setIsDragging(false);
			setDraggedCardId(null);
		},
		onDragCancel: () => {
			setIsDragging(false);
			setDraggedCardId(null);
		},
	});

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
							deck={deck}
							format={deck.format}
							onCardSelect={handleCardSelect}
							onCardHover={handleCardHover}
						/>
					</div>
				</div>
			</div>

			{/* Trash drop zone - only show while dragging */}
			<TrashDropZone isDragging={isDragging} />

			{/* Common tags overlay - only show while dragging */}
			<CommonTagsOverlay deck={deck} isDragging={isDragging} />

			{/* Main content */}
			<div className="max-w-7xl mx-auto px-6 py-8">
				<div className="flex flex-col lg:flex-row gap-6">
					{/* Left pane: Card preview (fixed width) */}
					<div className="lg:w-80 lg:flex-shrink-0">
						<CardPreviewPane cardId={previewCard} />
					</div>

					{/* Right pane: Deck sections (fills remaining space) */}
					<div className="flex-1 min-w-0">
						<ViewControls
							groupBy={groupBy}
							sortBy={sortBy}
							onGroupByChange={setGroupBy}
							onSortByChange={setSortBy}
						/>

						<DeckSection
							section="commander"
							cards={getCardsInSection(deck, "commander")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
						/>
						<DeckSection
							section="mainboard"
							cards={getCardsInSection(deck, "mainboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
						/>
						<DeckSection
							section="sideboard"
							cards={getCardsInSection(deck, "sideboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
						/>
						<DeckSection
							section="maybeboard"
							cards={getCardsInSection(deck, "maybeboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
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

			{/* Drag overlay */}
			<CardDragOverlay draggedCardId={draggedCardId} />
		</div>
	);
}
