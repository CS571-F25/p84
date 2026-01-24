import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardSpread } from "@/components/CardSpread";
import { ClientDate } from "@/components/ClientDate";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import {
	type CollectionList,
	isCardItem,
	isDeckItem,
} from "@/lib/collection-list-types";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";

export interface ListPreviewProps {
	did: Did;
	rkey: Rkey | string;
	list: CollectionList;
	showHandle?: boolean;
}

function getItemSummary(list: CollectionList): string {
	const cardCount = list.items.filter(isCardItem).length;
	const deckCount = list.items.filter(isDeckItem).length;

	const parts: string[] = [];
	if (cardCount > 0) {
		parts.push(`${cardCount} ${cardCount === 1 ? "card" : "cards"}`);
	}
	if (deckCount > 0) {
		parts.push(`${deckCount} ${deckCount === 1 ? "deck" : "decks"}`);
	}

	return parts.length > 0 ? parts.join(" · ") : "Empty";
}

function getCardIds(list: CollectionList): string[] {
	// Reverse so newest cards appear first (on top of spread)
	return list.items
		.filter(isCardItem)
		.map((item) => item.scryfallId)
		.reverse();
}

export function ListPreview({
	did,
	rkey,
	list,
	showHandle = false,
}: ListPreviewProps) {
	const { data: didDocument } = useQuery({
		...didDocumentQueryOptions(did),
		enabled: showHandle,
	});
	const handle = showHandle ? extractHandle(didDocument ?? null) : null;

	const dateString = list.updatedAt ?? list.createdAt;
	const itemSummary = getItemSummary(list);
	const cardIds = getCardIds(list);

	return (
		<Link
			to="/profile/$did/list/$rkey"
			params={{ did, rkey: asRkey(rkey) }}
			className="group flex items-start gap-4 p-4 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 motion-safe:hover:shadow-lg transition-colors motion-safe:transition-shadow min-w-0"
		>
			<CardSpread cardIds={cardIds} />

			<div className="flex-1 min-w-0">
				{showHandle &&
					(handle ? (
						<p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
							@{handle}
						</p>
					) : (
						<div className="h-5 w-24 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
					))}

				<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate font-display">
					{list.name}
				</h2>
				<p className="text-sm text-gray-600 dark:text-zinc-300 truncate">
					{itemSummary}
				</p>
				<p className="text-sm text-gray-500 dark:text-zinc-400">
					Updated <ClientDate dateString={dateString} />
				</p>
			</div>
		</Link>
	);
}
