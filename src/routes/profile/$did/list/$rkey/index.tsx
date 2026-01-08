import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { ClientDate } from "@/components/ClientDate";
import { type DeckData, DeckPreview } from "@/components/DeckPreview";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import {
	getCollectionListQueryOptions,
	useUpdateCollectionListMutation,
} from "@/lib/collection-list-queries";
import {
	isCardItem,
	isDeckItem,
	type ListCardItem,
	type ListDeckItem,
	removeCardFromList,
	removeDeckFromList,
} from "@/lib/collection-list-types";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import { getCardByIdQueryOptions } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/profile/$did/list/$rkey/")({
	component: ListDetailPage,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			getCollectionListQueryOptions(params.did as Did, asRkey(params.rkey)),
		);
	},
	head: () => ({
		meta: [{ title: "List | DeckBelcher" }],
	}),
});

function ListDetailPage() {
	const { did, rkey } = Route.useParams();
	const { session } = useAuth();
	const { data: list, isLoading } = useQuery(
		getCollectionListQueryOptions(did as Did, asRkey(rkey)),
	);

	const mutation = useUpdateCollectionListMutation(did as Did, asRkey(rkey));
	const isOwner = session?.info.sub === did;

	if (isLoading || !list) {
		return (
			<div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
				<p className="text-gray-600 dark:text-gray-400">Loading list...</p>
			</div>
		);
	}

	const handleRemoveCard = (item: ListCardItem) => {
		const updated = removeCardFromList(list, item.scryfallId);
		mutation.mutate(updated);
	};

	const handleRemoveDeck = (item: ListDeckItem) => {
		const updated = removeDeckFromList(list, item.deckUri);
		mutation.mutate(updated);
	};

	const dateString = list.updatedAt ?? list.createdAt;

	return (
		<div className="min-h-screen bg-white dark:bg-slate-900">
			<div className="max-w-4xl mx-auto px-6 py-8">
				<Link
					to="/profile/$did"
					params={{ did }}
					className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
				>
					<ArrowLeft className="w-4 h-4" />
					Back to profile
				</Link>

				<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
					{list.name}
				</h1>
				<p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
					Updated <ClientDate dateString={dateString} />
				</p>

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
									key={item.deckUri}
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
		<div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
			<Link to="/card/$id" params={{ id: item.scryfallId }}>
				<CardImage
					card={{ id: item.scryfallId, name: card.name }}
					size="small"
					className="w-16 h-auto rounded"
				/>
			</Link>

			<div className="flex-1 min-w-0">
				<Link
					to="/card/$id"
					params={{ id: item.scryfallId }}
					className="font-bold text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 truncate block"
				>
					{card.name}
				</Link>
				<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
					{card.type_line}
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

interface DeckListItemProps {
	item: ListDeckItem;
	onRemove?: (item: ListDeckItem) => void;
}

function DeckListItem({ item, onRemove }: DeckListItemProps) {
	const parts = item.deckUri.split("/");
	const deckDid = parts[2] as Did;
	const deckRkey = parts[4] as Rkey;

	const { data: deck, isError } = useQuery({
		...getDeckQueryOptions(deckDid, deckRkey),
		retry: false,
	});

	if (isError || !deck) {
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

	const deckData: DeckData = {
		name: deck.name,
		format: deck.format,
		cards: deck.cards.map((c) => ({
			scryfallId: c.scryfallId as string,
			quantity: c.quantity,
			section: c.section,
		})),
		createdAt: deck.createdAt,
		updatedAt: deck.updatedAt,
	};

	return (
		<div className="flex items-center gap-4">
			<div className="flex-1">
				<DeckPreview did={deckDid} rkey={deckRkey} deck={deckData} />
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
