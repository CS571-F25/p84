import type { Did } from "@atcute/lexicons";
import { type DragEndEvent, useDndMonitor } from "@dnd-kit/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardDragOverlay } from "@/components/deck/CardDragOverlay";
import { CardModal } from "@/components/deck/CardModal";
import { CardPreviewPane } from "@/components/deck/CardPreviewPane";
import { CardSearchAutocomplete } from "@/components/deck/CardSearchAutocomplete";
import { CommonTagsOverlay } from "@/components/deck/CommonTagsOverlay";
import { DeckHeader } from "@/components/deck/DeckHeader";
import { DeckSection } from "@/components/deck/DeckSection";
import { DeckStats } from "@/components/deck/DeckStats";
import { DragDropProvider } from "@/components/deck/DragDropProvider";
import type { DragData } from "@/components/deck/DraggableCard";
import { TrashDropZone } from "@/components/deck/TrashDropZone";
import { ViewControls } from "@/components/deck/ViewControls";
import { asRkey } from "@/lib/atproto-client";
import { prefetchCards } from "@/lib/card-prefetch";
import { getDeckQueryOptions, useUpdateDeckMutation } from "@/lib/deck-queries";
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
import type { ScryfallId } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";
import { usePersistedState } from "@/lib/usePersistedState";

export const Route = createFileRoute("/profile/$did/deck/$rkey/")({
	component: DeckEditorPage,
	loader: async ({ context, params }) => {
		// Prefetch deck data during SSR
		const deck = await context.queryClient.ensureQueryData(
			getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
		);

		const cardIds = deck.cards.map((card) => card.scryfallId);
		await prefetchCards(context.queryClient, cardIds);
	},
});

function DeckEditorPage() {
	const { did, rkey } = Route.useParams();
	const { session } = useAuth();
	const { data: deck } = useSuspenseQuery(
		getDeckQueryOptions(did as Did, asRkey(rkey)),
	);

	const [groupBy, setGroupBy] = usePersistedState<GroupBy>(
		"deckbelcher:viewConfig:groupBy",
		"typeAndTags",
	);
	const [sortBy, setSortBy] = usePersistedState<SortBy>(
		"deckbelcher:viewConfig:sortBy",
		"name",
	);

	const [previewCard, setPreviewCard] = useState<ScryfallId>(
		deck.cards?.[0]?.scryfallId,
	);
	const [modalCard, setModalCard] = useState<DeckCard | null>(null);
	const [draggedCardId, setDraggedCardId] = useState<ScryfallId | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const mutation = useUpdateDeckMutation(did as Did, asRkey(rkey));
	const queryClient = Route.useRouteContext().queryClient;

	// Check if current user is the owner
	const isOwner = session?.info.sub === did;

	// Helper to update deck via mutation
	const updateDeck = async (updater: (prev: Deck) => Deck) => {
		if (!isOwner) return;
		const updated = updater(deck);
		await mutation.mutateAsync(updated);
	};

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
		updateDeck((prev) =>
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
		updateDeck((prev) =>
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
		updateDeck((prev) =>
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
		const cardToDelete = modalCard;
		const toastId = toast.loading("Removing card...");

		updateDeck((prev) =>
			removeCardFromDeck(
				prev,
				modalCard.scryfallId,
				modalCard.section as Section,
			),
		)
			.then(() => {
				// Close modal after successful delete
				setModalCard(null);

				// Update to success with undo action
				toast.success("Card removed from deck", {
					id: toastId,
					action: {
						label: "Undo",
						onClick: () => {
							toast.promise(
								updateDeck((prev) => ({
									...prev,
									cards: [...prev.cards, cardToDelete],
								})),
								{
									loading: "Undoing...",
									success: "Card restored",
									error: "Failed to restore card",
								},
							);
						},
					},
				});
			})
			.catch((err) => {
				toast.error(`Failed to remove card: ${err.message}`, { id: toastId });
			});
	};

	const handleNameChange = (name: string) => {
		updateDeck((prev) => ({ ...prev, name }));
	};

	const handleFormatChange = (format: string) => {
		updateDeck((prev) => ({ ...prev, format }));
	};

	const handleCardSelect = async (cardId: ScryfallId) => {
		await queryClient.prefetchQuery(getCardByIdQueryOptions(cardId));
		const cardData = queryClient.getQueryData(
			getCardByIdQueryOptions(cardId).queryKey,
		);

		await toast.promise(
			updateDeck((prev) => addCardToDeck(prev, cardId, "mainboard", 1)),
			{
				loading: "Adding card...",
				success: cardData ? `Added ${cardData.name}` : "Card added to deck",
				error: (err) => `Failed to add card: ${err.message}`,
			},
		);
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

			// Show loading toast and track mutation
			const toastId = toast.loading("Removing card...");

			updateDeck((prev) =>
				removeCardFromDeck(
					prev,
					dragData.scryfallId,
					dragData.section as Section,
				),
			)
				.then(() => {
					// Update to success with undo action
					if (cardToDelete) {
						toast.success("Card removed from deck", {
							id: toastId,
							action: {
								label: "Undo",
								onClick: () => {
									// Re-insert the exact card that was deleted
									toast.promise(
										updateDeck((prev) => ({
											...prev,
											cards: [...prev.cards, cardToDelete],
										})),
										{
											loading: "Undoing...",
											success: "Card restored",
											error: "Failed to restore card",
										},
									);
								},
							},
						});
					} else {
						toast.success("Card removed from deck", { id: toastId });
					}
				})
				.catch((err) => {
					toast.error(`Failed to remove card: ${err.message}`, { id: toastId });
				});

			return;
		}

		// Handle section drop
		if (dropData.type === "section") {
			if (dropData.section === dragData.section) return; // No-op if same section

			updateDeck((prev) =>
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
			updateDeck((prev) =>
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
				did={did}
				rkey={rkey}
				deck={deck}
				groupBy={groupBy}
				sortBy={sortBy}
				previewCard={previewCard}
				modalCard={modalCard}
				draggedCardId={draggedCardId}
				isDragging={isDragging}
				isOwner={isOwner}
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
	did: string;
	rkey: string;
	deck: Deck;
	groupBy: GroupBy;
	sortBy: SortBy;
	previewCard: ScryfallId;
	modalCard: DeckCard | null;
	draggedCardId: ScryfallId | null;
	isDragging: boolean;
	isOwner: boolean;
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
	did,
	rkey,
	deck,
	groupBy,
	sortBy,
	previewCard,
	modalCard,
	draggedCardId,
	isDragging,
	isOwner,
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
			{/* Deck name and format */}
			<div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-6 pt-8 pb-4">
				<DeckHeader
					name={deck.name}
					format={deck.format}
					onNameChange={handleNameChange}
					onFormatChange={handleFormatChange}
					readOnly={!isOwner}
				/>
			</div>

			{/* Sticky header with search */}
			{isOwner && (
				<div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm">
					<div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-6 py-3 flex items-center justify-between gap-4">
						<Link
							to="/profile/$did/deck/$rkey/bulk-edit"
							params={{ did, rkey }}
							className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
						>
							Bulk Edit
						</Link>
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
			)}

			{/* Trash drop zone - only show while dragging, hide on mobile */}
			<div className="hidden md:block">
				{isOwner && <TrashDropZone isDragging={isDragging} />}
			</div>

			{/* Common tags overlay - only show while dragging, hide on mobile */}
			<div className="hidden md:block">
				{isOwner && <CommonTagsOverlay deck={deck} isDragging={isDragging} />}
			</div>

			{/* Main content */}
			<div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-6 py-8">
				<div className="flex flex-col md:flex-row gap-6">
					{/* Left pane: Card preview (fixed width) */}
					<div className="hidden md:block md:w-48 lg:w-60 xl:w-80 md:flex-shrink-0">
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
							readOnly={!isOwner}
						/>
						<DeckSection
							section="mainboard"
							cards={getCardsInSection(deck, "mainboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
							readOnly={!isOwner}
						/>
						<DeckSection
							section="sideboard"
							cards={getCardsInSection(deck, "sideboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
							readOnly={!isOwner}
						/>
						<DeckSection
							section="maybeboard"
							cards={getCardsInSection(deck, "maybeboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
							readOnly={!isOwner}
						/>

						<DeckStats
							cards={[
								...getCardsInSection(deck, "commander"),
								...getCardsInSection(deck, "mainboard"),
							]}
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
					readOnly={!isOwner}
				/>
			)}

			{/* Drag overlay */}
			<CardDragOverlay draggedCardId={draggedCardId} />
		</div>
	);
}
