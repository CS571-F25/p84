import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardImage } from "@/components/CardImage";
import { ClientDate } from "@/components/ClientDate";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { formatDisplayName } from "@/lib/format-utils";
import type { ScryfallId } from "@/lib/scryfall-types";

export interface DeckData {
	name: string;
	format?: string;
	cards: Array<{ scryfallId: string; quantity: number; section: string }>;
	createdAt: string;
	updatedAt?: string;
}

export interface DeckPreviewProps {
	did: Did;
	rkey: Rkey | string;
	deck: DeckData;
	/** Whether to show handle row (fetches DID document, with skeleton while loading) */
	showHandle?: boolean;
	/** Whether to show section counts like "100 main · 15 side" (default: true) */
	showCounts?: boolean;
}

function getSectionCounts(cards: { quantity: number; section: string }[]) {
	const counts: Record<string, number> = {};
	for (const card of cards) {
		counts[card.section] = (counts[card.section] ?? 0) + card.quantity;
	}
	return counts;
}

function formatSectionCounts(counts: Record<string, number>): string {
	const parts: string[] = [];

	if (counts.commander) {
		parts.push(`${counts.commander} cmdr`);
	}
	if (counts.mainboard) {
		parts.push(`${counts.mainboard} main`);
	}
	if (counts.sideboard) {
		parts.push(`${counts.sideboard} side`);
	}
	if (counts.maybeboard) {
		parts.push(`${counts.maybeboard} maybe`);
	}

	for (const [section, count] of Object.entries(counts)) {
		if (
			!["commander", "mainboard", "sideboard", "maybeboard"].includes(section)
		) {
			parts.push(`${count} ${section}`);
		}
	}

	return parts.join(" · ");
}

function getThumbnailId(
	cards: { scryfallId: string; section: string }[],
): ScryfallId | null {
	const commander = cards.find((c) => c.section === "commander");
	if (commander) return commander.scryfallId as ScryfallId;

	const mainboard = cards.find((c) => c.section === "mainboard");
	if (mainboard) return mainboard.scryfallId as ScryfallId;

	return cards[0]?.scryfallId as ScryfallId | null;
}

export function DeckPreview({
	did,
	rkey,
	deck,
	showHandle = false,
	showCounts = true,
}: DeckPreviewProps) {
	const { data: didDocument } = useQuery({
		...didDocumentQueryOptions(did),
		enabled: showHandle,
	});
	const handle = showHandle ? extractHandle(didDocument ?? null) : null;

	const sectionString = showCounts
		? formatSectionCounts(getSectionCounts(deck.cards))
		: "";
	const dateString = deck.updatedAt ?? deck.createdAt;
	const thumbnailId = getThumbnailId(deck.cards);

	return (
		<Link
			to="/profile/$did/deck/$rkey"
			params={{ did, rkey: asRkey(rkey) }}
			className="grid grid-cols-[auto_1fr] grid-rows-[auto_auto_auto_auto_auto] gap-x-4 p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors"
		>
			{thumbnailId && (
				<CardImage
					card={{ id: thumbnailId, name: deck.name }}
					size="small"
					className="row-span-5 h-0 min-h-full w-auto rounded"
				/>
			)}

			{showHandle &&
				(handle ? (
					<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
						@{handle}
					</p>
				) : (
					<div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
				))}

			<h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
				{deck.name}
			</h2>
			{deck.format && (
				<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
					{formatDisplayName(deck.format)}
				</p>
			)}
			{sectionString && (
				<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
					{sectionString}
				</p>
			)}
			<p className="text-sm text-gray-500 dark:text-gray-500">
				Updated <ClientDate dateString={dateString} />
			</p>
		</Link>
	);
}
