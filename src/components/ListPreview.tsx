import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { ClientDate } from "@/components/ClientDate";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import {
	type CollectionList,
	isCardItem,
	isDeckItem,
} from "@/lib/collection-list-types";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import type { ScryfallId } from "@/lib/scryfall-types";

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
	return list.items.filter(isCardItem).map((item) => item.scryfallId);
}

function CardSpread({ cardIds }: { cardIds: string[] }) {
	const cards = cardIds.slice(-3);

	if (cards.length === 0) {
		return (
			<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
				<Bookmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
			</div>
		);
	}

	const layouts: Record<
		number,
		{
			rotations: number[];
			xPercents: number[];
			hoverRotations: number[];
			hoverZ: number;
		}
	> = {
		1: {
			rotations: [0],
			xPercents: [20],
			hoverRotations: [90],
			hoverZ: 8,
		},
		2: {
			rotations: [-8, 8],
			xPercents: [12, 28],
			hoverRotations: [-11, 11],
			hoverZ: 8,
		},
		3: {
			rotations: [-12, 0, 12],
			xPercents: [10, 22, 34],
			hoverRotations: [-14, 0, 14],
			hoverZ: 8,
		},
	};

	const layout = layouts[cards.length] ?? layouts[3];

	return (
		<div
			className="relative shrink-0 w-24 h-[90px]"
			style={{ perspective: "150px" }}
		>
			{cards.map((id, i) => (
				<div
					key={id}
					className={`absolute w-3/5 shadow-md motion-safe:transition-all motion-safe:ease-out motion-safe:group-hover:shadow-xl ${cards.length === 1 ? "origin-center motion-safe:duration-[350ms]" : "origin-bottom motion-safe:duration-200"}`}
					style={
						{
							left: `${layout.xPercents[i]}%`,
							bottom: "5%",
							transform: `rotate(${layout.rotations[i]}deg)`,
							zIndex: i,
							"--base-rotate": `${layout.rotations[i]}deg`,
							"--hover-rotate": `${layout.hoverRotations[i]}deg`,
							"--hover-z": `${layout.hoverZ}px`,
						} as React.CSSProperties
					}
				>
					<CardImage
						card={{ id: id as ScryfallId, name: "" }}
						size="small"
						className="rounded"
					/>
				</div>
			))}
			<style>{`
				.group:hover [style*="--hover-rotate"] {
					transform: rotate(var(--hover-rotate)) translateZ(var(--hover-z)) !important;
				}
				@media (prefers-reduced-motion: reduce) {
					.group:hover [style*="--hover-rotate"] {
						transform: rotate(var(--base-rotate)) !important;
					}
				}
			`}</style>
		</div>
	);
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
			className="group flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 motion-safe:hover:shadow-lg transition-colors motion-safe:transition-shadow"
		>
			<CardSpread cardIds={cardIds} />

			<div className="flex-1 min-w-0">
				{showHandle &&
					(handle ? (
						<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
							@{handle}
						</p>
					) : (
						<div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
					))}

				<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate font-display">
					{list.name}
				</h2>
				<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
					{itemSummary}
				</p>
				<p className="text-sm text-gray-500 dark:text-gray-500">
					Updated <ClientDate dateString={dateString} />
				</p>
			</div>
		</Link>
	);
}
