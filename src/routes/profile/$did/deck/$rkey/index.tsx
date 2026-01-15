import type { Did } from "@atcute/lexicons";
import { type DragEndEvent, useDndMonitor } from "@dnd-kit/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { CardDragOverlay } from "@/components/deck/CardDragOverlay";
import { CardModal } from "@/components/deck/CardModal";
import { CardPreviewPane } from "@/components/deck/CardPreviewPane";
import { CardSearchAutocomplete } from "@/components/deck/CardSearchAutocomplete";
import { CommonTagsOverlay } from "@/components/deck/CommonTagsOverlay";
import { DeckActionsMenu } from "@/components/deck/DeckActionsMenu";
import { DeckHeader } from "@/components/deck/DeckHeader";
import { DeckSection } from "@/components/deck/DeckSection";
import { DeckStats } from "@/components/deck/DeckStats";
import { DragDropProvider } from "@/components/deck/DragDropProvider";
import type { DragData } from "@/components/deck/DraggableCard";
import { GoldfishView } from "@/components/deck/GoldfishView";
import { StatsCardList } from "@/components/deck/stats/StatsCardList";
import { TrashDropZone } from "@/components/deck/TrashDropZone";
import { ViewControls } from "@/components/deck/ViewControls";
import { RichtextSection } from "@/components/richtext/RichtextSection";
import { SocialStats } from "@/components/social/SocialStats";
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
import { formatDisplayName } from "@/lib/format-utils";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { documentToPlainText } from "@/lib/richtext-convert";
import type { ScryfallId } from "@/lib/scryfall-types";
import { getImageUri } from "@/lib/scryfall-utils";
import { getSelectedCards, type StatsSelection } from "@/lib/stats-selection";
import { useAuth } from "@/lib/useAuth";
import { useDeckStats } from "@/lib/useDeckStats";
import { usePersistedState } from "@/lib/usePersistedState";

export const Route = createFileRoute("/profile/$did/deck/$rkey/")({
	component: DeckEditorPage,
	loader: async ({ context, params }) => {
		// Prefetch deck data during SSR
		const { deck } = await context.queryClient.ensureQueryData(
			getDeckQueryOptions(params.did as Did, asRkey(params.rkey)),
		);

		const cardIds = deck.cards.map((card) => card.scryfallId);
		await prefetchCards(context.queryClient, cardIds);

		return deck;
	},
	head: ({ loaderData: deck }) => {
		if (!deck) {
			return { meta: [{ title: "Deck Not Found | DeckBelcher" }] };
		}

		const format = formatDisplayName(deck.format);
		const title = format
			? `${deck.name} (${format}) | DeckBelcher`
			: `${deck.name} | DeckBelcher`;

		const ogTitle = format ? `${deck.name} (${format})` : deck.name;

		const cardCount = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
		const primerText = deck.primer
			? documentToPlainText(deck.primer)
			: undefined;
		const description = primerText
			? `${primerText.slice(0, 150)}${primerText.length > 150 ? "..." : ""}`
			: `${cardCount} card${cardCount === 1 ? "" : "s"}`;

		// Use first commander's image, or first card if no commanders
		const commanders = deck.cards.filter((c) => c.section === "commander");
		const featuredCard = commanders[0] ?? deck.cards[0];
		const cardImageUrl = featuredCard
			? getImageUri(featuredCard.scryfallId, "large")
			: undefined;

		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: ogTitle },
				{ property: "og:description", content: description },
				...(cardImageUrl
					? [
							{ property: "og:image", content: cardImageUrl },
							{ property: "og:image:width", content: "672" },
							{ property: "og:image:height", content: "936" },
						]
					: []),
				{ property: "og:type", content: "website" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: ogTitle },
				{ name: "twitter:description", content: description },
				...(cardImageUrl
					? [{ name: "twitter:image", content: cardImageUrl }]
					: []),
			],
		};
	},
});

function DeckEditorPage() {
	const { did, rkey } = Route.useParams();
	const { session } = useAuth();
	const { data: deckRecord } = useSuspenseQuery(
		getDeckQueryOptions(did as Did, asRkey(rkey)),
	);
	const deck = deckRecord.deck;

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
	const [statsSelection, setStatsSelection] = useState<StatsSelection>(null);
	const [highlightedCards, setHighlightedCards] = useState<Set<ScryfallId>>(
		new Set(),
	);

	const statsCards = useMemo(
		() => [
			...getCardsInSection(deck, "commander"),
			...getCardsInSection(deck, "mainboard"),
		],
		[deck],
	);
	const stats = useDeckStats(statsCards);
	const selectedCards = useMemo(
		() => getSelectedCards(statsSelection, stats),
		[statsSelection, stats],
	);

	// All unique tags in the deck (for autocomplete)
	const allTags = useMemo(
		() => Array.from(new Set(deck.cards.flatMap((c) => c.tags ?? []))),
		[deck],
	);

	const mutation = useUpdateDeckMutation(did as Did, asRkey(rkey));
	const queryClient = Route.useRouteContext().queryClient;

	// Check if current user is the owner
	const isOwner = session?.info.sub === did;

	// Primer save handler
	const handlePrimerSave = useCallback(
		(doc: Document) => {
			if (!isOwner) return;
			mutation.mutate({ ...deck, primer: doc });
		},
		[isOwner, mutation, deck],
	);

	// Helper to update deck via mutation
	const updateDeck = async (updater: (prev: Deck) => Deck) => {
		if (!isOwner) return;
		const updated = updater(deck);
		await mutation.mutateAsync(updated);
	};

	// Highlight cards that were changed - clear after render so it can trigger again
	const handleCardsChanged = (changedIds: Set<ScryfallId>) => {
		setHighlightedCards(changedIds);
		setTimeout(() => setHighlightedCards(new Set()), 0);
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

		if (!cardData?.oracle_id) {
			toast.error("Failed to add card: could not get card data");
			return;
		}

		await toast.promise(
			updateDeck((prev) =>
				addCardToDeck(prev, cardId, cardData.oracle_id, "mainboard", 1),
			),
			{
				loading: "Adding card...",
				success: `Added ${cardData.name}`,
				error: (err) => `Failed to add card: ${err.message}`,
			},
		);
		handleCardsChanged(new Set([cardId]));
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
				deckCid={deckRecord.cid}
				groupBy={groupBy}
				sortBy={sortBy}
				previewCard={previewCard}
				modalCard={modalCard}
				draggedCardId={draggedCardId}
				isDragging={isDragging}
				isOwner={isOwner}
				stats={stats}
				statsSelection={statsSelection}
				selectedCards={selectedCards}
				setStatsSelection={setStatsSelection}
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
				allTags={allTags}
				updateDeck={updateDeck}
				highlightedCards={highlightedCards}
				handleCardsChanged={handleCardsChanged}
				primer={deck.primer}
				onPrimerSave={handlePrimerSave}
				isSaving={mutation.isPending}
			/>
		</DragDropProvider>
	);
}

interface DeckEditorInnerProps {
	did: string;
	rkey: string;
	deck: Deck;
	deckCid: string;
	groupBy: GroupBy;
	sortBy: SortBy;
	previewCard: ScryfallId;
	modalCard: DeckCard | null;
	draggedCardId: ScryfallId | null;
	isDragging: boolean;
	isOwner: boolean;
	stats: ReturnType<typeof useDeckStats>;
	statsSelection: StatsSelection;
	selectedCards: ReturnType<typeof getSelectedCards>;
	setStatsSelection: (selection: StatsSelection) => void;
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
	allTags: string[];
	updateDeck: (updater: (prev: Deck) => Deck) => Promise<void>;
	highlightedCards: Set<ScryfallId>;
	handleCardsChanged: (changedIds: Set<ScryfallId>) => void;
	primer?: Document;
	onPrimerSave: (doc: Document) => void;
	isSaving: boolean;
}

function DeckEditorInner({
	did,
	rkey,
	deck,
	deckCid,
	groupBy,
	sortBy,
	previewCard,
	modalCard,
	draggedCardId,
	isDragging,
	isOwner,
	stats,
	statsSelection,
	selectedCards,
	setStatsSelection,
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
	allTags,
	updateDeck,
	highlightedCards,
	handleCardsChanged,
	primer,
	onPrimerSave,
	isSaving,
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
			<div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-6 pt-8 pb-4 space-y-4">
				<DeckHeader
					name={deck.name}
					format={deck.format}
					onNameChange={handleNameChange}
					onFormatChange={handleFormatChange}
					readOnly={!isOwner}
				/>
				<ErrorBoundary fallback={null}>
					<RichtextSection
						document={primer}
						onSave={onPrimerSave}
						isSaving={isSaving}
						readOnly={!isOwner}
						placeholder="Write about your deck's strategy, key combos, card choices..."
						availableTags={allTags}
					/>
				</ErrorBoundary>
			</div>

			{/* Sticky header with search */}
			<div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm">
				<div className="max-w-7xl 2xl:max-w-[96rem] mx-auto px-6 py-3 flex items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<DeckActionsMenu
							deck={deck}
							did={did}
							rkey={asRkey(rkey)}
							onUpdateDeck={isOwner ? updateDeck : undefined}
							onCardsChanged={handleCardsChanged}
							readOnly={!isOwner}
						/>
						<SocialStats
							item={{
								type: "deck",
								uri: `at://${did}/com.deckbelcher.deck.list/${rkey}`,
								cid: deckCid,
							}}
							itemName={deck.name}
						/>
						{isOwner && (
							<Link
								to="/profile/$did/deck/$rkey/bulk-edit"
								params={{ did, rkey }}
								className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
							>
								Bulk Edit
							</Link>
						)}
					</div>
					{isOwner && (
						<div className="w-full max-w-md">
							<CardSearchAutocomplete
								deck={deck}
								format={deck.format}
								onCardSelect={handleCardSelect}
								onCardHover={handleCardHover}
							/>
						</div>
					)}
				</div>
			</div>

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
					{/* Left pane: Card preview + stats card list (fixed width) */}
					<div className="hidden md:block md:w-48 lg:w-60 xl:w-80 md:flex-shrink-0">
						<div className="sticky top-20 max-h-[calc(100vh-6rem)] flex flex-col">
							<CardPreviewPane cardId={previewCard} />
							{selectedCards.cards.length > 0 && (
								<div className="min-h-0 flex-1 overflow-y-auto mt-8">
									<StatsCardList
										title={selectedCards.title}
										cards={selectedCards.cards}
										onCardHover={handleCardHover}
										onCardClick={handleCardClick}
									/>
								</div>
							)}
						</div>
					</div>

					{/* Right pane: Deck sections (fills remaining space) */}
					<div className="flex-1 min-w-0">
						<ViewControls
							groupBy={groupBy}
							sortBy={sortBy}
							onGroupByChange={setGroupBy}
							onSortByChange={setSortBy}
						/>

						{(deck.format === "commander" ||
							deck.format === "paupercommander" ||
							deck.cards.some((card) => card.section === "commander")) && (
							<DeckSection
								section="commander"
								cards={getCardsInSection(deck, "commander")}
								groupBy={groupBy}
								sortBy={sortBy}
								onCardHover={handleCardHover}
								onCardClick={handleCardClick}
								isDragging={isDragging}
								readOnly={!isOwner}
								highlightedCards={highlightedCards}
							/>
						)}
						<DeckSection
							section="mainboard"
							cards={getCardsInSection(deck, "mainboard")}
							groupBy={groupBy}
							sortBy={sortBy}
							onCardHover={handleCardHover}
							onCardClick={handleCardClick}
							isDragging={isDragging}
							readOnly={!isOwner}
							highlightedCards={highlightedCards}
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
							highlightedCards={highlightedCards}
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
							highlightedCards={highlightedCards}
						/>

						<DeckStats
							stats={stats}
							selection={statsSelection}
							onSelect={setStatsSelection}
						/>

						<GoldfishView
							cards={[
								...getCardsInSection(deck, "commander"),
								...getCardsInSection(deck, "mainboard"),
							]}
							onCardHover={handleCardHover}
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
					allTags={allTags}
				/>
			)}

			{/* Drag overlay */}
			<CardDragOverlay draggedCardId={draggedCardId} />
		</div>
	);
}
