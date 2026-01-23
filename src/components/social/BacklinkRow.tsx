import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DeckPreview } from "@/components/DeckPreview";
import { ListPreview } from "@/components/ListPreview";
import { asRkey, type Rkey } from "@/lib/atproto-client";
import { getCollectionListQueryOptions } from "@/lib/collection-list-queries";
import type { BacklinkRecord } from "@/lib/constellation-client";
import { getDeckQueryOptions } from "@/lib/deck-queries";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";

export type BacklinkType = "likes" | "saves" | "decks";

interface BacklinkRowProps {
	type: BacklinkType;
	record: BacklinkRecord;
}

export function BacklinkRow({ type, record }: BacklinkRowProps) {
	const did = record.did as Did;
	const rkey = asRkey(record.rkey);

	if (type === "likes") {
		return <LikeRow did={did} />;
	}

	if (type === "saves") {
		return <SaveRow did={did} rkey={rkey} />;
	}

	if (type === "decks") {
		return <DeckRow did={did} rkey={rkey} />;
	}

	return null;
}

function LikeRow({ did }: { did: Did }) {
	const { data: didDoc, isLoading } = useQuery(didDocumentQueryOptions(did));
	const handle = extractHandle(didDoc ?? null);

	return (
		<Link
			to="/profile/$did"
			params={{ did }}
			className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
		>
			{isLoading ? (
				<span className="inline-block w-24 h-4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
			) : (
				<span>@{handle ?? did.slice(0, 20)}</span>
			)}
		</Link>
	);
}

function SaveRow({ did, rkey }: { did: Did; rkey: Rkey }) {
	const {
		data: list,
		isLoading,
		isError,
	} = useQuery(getCollectionListQueryOptions(did, rkey));

	if (isLoading) {
		return <RowSkeleton />;
	}

	if (isError || !list) {
		return null;
	}

	return <ListPreview did={did} rkey={rkey} list={list} showHandle />;
}

function DeckRow({ did, rkey }: { did: Did; rkey: Rkey }) {
	const {
		data: deckRecord,
		isLoading,
		isError,
	} = useQuery(getDeckQueryOptions(did, rkey));

	if (isLoading) {
		return <RowSkeleton />;
	}

	if (isError || !deckRecord) {
		return null;
	}

	return (
		<DeckPreview did={did} rkey={rkey} deck={deckRecord.deck} showHandle />
	);
}

export function RowSkeleton() {
	return (
		<div className="p-4 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg">
			<div className="h-5 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mb-2" />
			<div className="h-4 w-48 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
		</div>
	);
}
