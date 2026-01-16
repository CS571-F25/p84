import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CardImage } from "@/components/CardImage";
import { ClientDate } from "@/components/ClientDate";
import { DeckPreview } from "@/components/DeckPreview";
import { ListActionsMenu } from "@/components/list/ListActionsMenu";
import { ManaCost } from "@/components/ManaCost";
import { OracleText } from "@/components/OracleText";
import { RichtextSection } from "@/components/richtext/RichtextSection";
import { SetSymbol } from "@/components/SetSymbol";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import { getPrimaryFace } from "@/lib/card-faces";
import {
	getCollectionListQueryOptions,
	useToggleListItemMutation,
	useUpdateCollectionListMutation,
} from "@/lib/collection-list-queries";
import {
	isCardItem,
	isDeckItem,
	type ListCardItem,
	type ListDeckItem,
	type SaveItem,
} from "@/lib/collection-list-types";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { documentToPlainText } from "@/lib/richtext-convert";
import { getImageUri } from "@/lib/scryfall-utils";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/profile/$did/list/$rkey/")({
	component: ListDetailPage,
	loader: async ({ context, params }) => {
		const list = await context.queryClient.ensureQueryData(
			getCollectionListQueryOptions(params.did as Did, asRkey(params.rkey)),
		);
		return list;
	},
	head: ({ loaderData: list }) => {
		if (!list) {
			return { meta: [{ title: "List Not Found | DeckBelcher" }] };
		}

		const title = `${list.name} | DeckBelcher`;
		const cardCount = list.items.filter(isCardItem).length;
		const deckCount = list.items.filter(isDeckItem).length;

		const parts: string[] = [];
		if (cardCount > 0)
			parts.push(`${cardCount} card${cardCount === 1 ? "" : "s"}`);
		if (deckCount > 0)
			parts.push(`${deckCount} deck${deckCount === 1 ? "" : "s"}`);
		const itemSummary = parts.length > 0 ? parts.join(", ") : "Empty list";

		const descriptionText = list.description
			? documentToPlainText(list.description)
			: undefined;
		const description = descriptionText
			? `${descriptionText.slice(0, 150)}${descriptionText.length > 150 ? "..." : ""}`
			: itemSummary;

		const firstCard = list.items.find(isCardItem);
		const cardImageUrl = firstCard
			? getImageUri(firstCard.scryfallId, "large")
			: undefined;

		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: list.name },
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
				{ name: "twitter:title", content: list.name },
				{ name: "twitter:description", content: description },
				...(cardImageUrl
					? [{ name: "twitter:image", content: cardImageUrl }]
					: []),
			],
		};
	},
});

function ListDetailPage() {
	const { did, rkey } = Route.useParams();
	const { session } = useAuth();
	const { data: list, isLoading } = useQuery(
		getCollectionListQueryOptions(did as Did, asRkey(rkey)),
	);
	const { data: didDocument } = useQuery(didDocumentQueryOptions(did as Did));
	const handle = extractHandle(didDocument ?? null);

	const mutation = useUpdateCollectionListMutation(did as Did, asRkey(rkey));
	const toggleMutation = useToggleListItemMutation(did as Did, asRkey(rkey));
	const isOwner = session?.info.sub === did;

	const [isEditingName, setIsEditingName] = useState(false);
	const [editedName, setEditedName] = useState("");

	if (isLoading || !list) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-gray-600 dark:text-gray-400">Loading list...</p>
			</div>
		);
	}

	const handleRemoveCard = (item: ListCardItem) => {
		const saveItem: SaveItem = {
			type: "card",
			scryfallId: item.scryfallId,
			oracleId: item.oracleId,
		};
		toggleMutation.mutate({ list, item: saveItem });
	};

	const handleRemoveDeck = (item: ListDeckItem) => {
		const saveItem: SaveItem = {
			type: "deck",
			uri: item.ref.uri,
			cid: item.ref.cid,
		};
		toggleMutation.mutate({ list, item: saveItem });
	};

	const handleNameClick = () => {
		if (!isOwner) return;
		setEditedName(list.name);
		setIsEditingName(true);
	};

	const handleNameSubmit = () => {
		const newName = editedName.trim() || "Untitled List";
		if (newName !== list.name) {
			mutation.mutate({ ...list, name: newName });
		}
		setIsEditingName(false);
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleNameSubmit();
		} else if (e.key === "Escape") {
			setEditedName(list.name);
			setIsEditingName(false);
		}
	};

	const handleDescriptionSave = (doc: Document) => {
		if (!isOwner) return;
		mutation.mutate({ ...list, description: doc });
	};

	const dateString = list.updatedAt ?? list.createdAt;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-4xl mx-auto px-6 py-8">
				<div className="flex items-start justify-between gap-4 mb-2">
					<div className="flex-1 min-w-0">
						{isEditingName ? (
							<input
								type="text"
								value={editedName}
								onChange={(e) => setEditedName(e.target.value)}
								onBlur={handleNameSubmit}
								onKeyDown={handleNameKeyDown}
								className="text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-cyan-500 focus:outline-none w-full font-display"
							/>
						) : (
							<h1
								className={`text-3xl font-bold text-gray-900 dark:text-white truncate font-display ${isOwner ? "cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors" : ""}`}
								onClick={handleNameClick}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										handleNameClick();
									}
								}}
								tabIndex={isOwner ? 0 : undefined}
								role={isOwner ? "button" : undefined}
							>
								{list.name}
							</h1>
						)}
					</div>
					{isOwner && (
						<ListActionsMenu listName={list.name} rkey={asRkey(rkey)} />
					)}
				</div>

				<p className="text-sm text-gray-500 dark:text-gray-500 mb-1">
					{handle ? (
						<>
							by{" "}
							<Link
								to="/profile/$did"
								params={{ did }}
								className="hover:text-cyan-600 dark:hover:text-cyan-400"
							>
								@{handle}
							</Link>
						</>
					) : (
						<span className="inline-block h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded animate-pulse align-middle" />
					)}
				</p>
				<p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
					Updated <ClientDate dateString={dateString} />
				</p>

				<div className="mb-8">
					<ErrorBoundary fallback={null}>
						<RichtextSection
							document={list.description}
							onSave={handleDescriptionSave}
							isSaving={mutation.isPending}
							readOnly={!isOwner}
							placeholder="Describe what this list is about..."
						/>
					</ErrorBoundary>
				</div>

				{list.items.length === 0 ? (
					<p className="text-gray-600 dark:text-gray-400 text-center py-12">
						This list is empty.
					</p>
				) : (
					<div className="space-y-4">
						{list.items.map((item) =>
							isCardItem(item) ? (
								<CardListItem
									key={item.scryfallId}
									item={item}
									onRemove={isOwner ? handleRemoveCard : undefined}
								/>
							) : isDeckItem(item) ? (
								<DeckListItem
									key={item.ref.uri}
									item={item}
									onRemove={isOwner ? handleRemoveDeck : undefined}
								/>
							) : null,
						)}
					</div>
				)}
			</div>
		</div>
	);
}

interface CardListItemProps {
	item: ListCardItem;
	onRemove?: (item: ListCardItem) => void;
}

function CardListItem({ item, onRemove }: CardListItemProps) {
	const { data: card, isLoading } = useQuery(
		getCardByIdQueryOptions(item.scryfallId),
	);

	if (isLoading || !card) {
		return (
			<div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg animate-pulse">
				<div className="w-16 h-22 bg-gray-300 dark:bg-slate-700 rounded" />
				<div className="flex-1">
					<div className="h-5 w-32 bg-gray-300 dark:bg-slate-700 rounded mb-2" />
					<div className="h-4 w-24 bg-gray-200 dark:bg-slate-600 rounded" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-4">
			<Link
				to="/card/$id"
				params={{ id: item.scryfallId }}
				className="group flex-1 flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 motion-safe:hover:shadow-lg transition-colors motion-safe:transition-shadow"
			>
				<CardImage
					card={{ id: item.scryfallId, name: card.name }}
					size="small"
					className="w-16 h-auto rounded"
				/>

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-3">
						<span className="font-bold text-gray-900 dark:text-white truncate">
							{card.name}
						</span>
						{getPrimaryFace(card).mana_cost && (
							<ManaCost
								cost={getPrimaryFace(card).mana_cost ?? ""}
								size="small"
							/>
						)}
					</div>
					<div className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
						<span className="truncate">{card.type_line}</span>
						{card.set && (
							<SetSymbol setCode={card.set} rarity={card.rarity} size="small" />
						)}
					</div>
					{getPrimaryFace(card).oracle_text && (
						<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-tight">
							<OracleText
								text={getPrimaryFace(card).oracle_text ?? ""}
								symbolSize="text"
							/>
						</p>
					)}
				</div>
			</Link>
			{onRemove && (
				<button
					type="button"
					onClick={() => onRemove(item)}
					className="p-2 text-gray-400 hover:text-red-500 transition-colors"
					aria-label="Remove from list"
				>
					<Trash2 className="w-5 h-5" />
				</button>
			)}
		</div>
	);
}

interface DeckListItemProps {
	item: ListDeckItem;
	onRemove?: (item: ListDeckItem) => void;
}

function DeckListItem({ item, onRemove }: DeckListItemProps) {
	const parts = item.ref.uri.split("/");
	const deckDid = parts[2] as Did;
	const deckRkey = parts[4] as Rkey;

	const { data, isError } = useQuery({
		...getDeckQueryOptions(deckDid, deckRkey),
		retry: false,
	});

	if (isError || !data) {
		return (
			<div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg opacity-50">
				<div className="flex-1">
					<p className="text-gray-600 dark:text-gray-400">
						Deck no longer exists
					</p>
				</div>
				{onRemove && (
					<button
						type="button"
						onClick={() => onRemove(item)}
						className="p-2 text-gray-400 hover:text-red-500 transition-colors"
						aria-label="Remove from list"
					>
						<Trash2 className="w-5 h-5" />
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-4">
			<div className="flex-1">
				<DeckPreview did={deckDid} rkey={deckRkey} deck={data.deck} />
			</div>
			{onRemove && (
				<button
					type="button"
					onClick={() => onRemove(item)}
					className="p-2 text-gray-400 hover:text-red-500 transition-colors"
					aria-label="Remove from list"
				>
					<Trash2 className="w-5 h-5" />
				</button>
			)}
		</div>
	);
}
