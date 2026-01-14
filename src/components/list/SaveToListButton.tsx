import { useInfiniteQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useMemo, useState } from "react";
import { listUserCollectionListsQueryOptions } from "@/lib/collection-list-queries";
import { hasCard, hasDeck } from "@/lib/collection-list-types";
import { useAuth } from "@/lib/useAuth";
import { type SaveItem, SaveToListDialog } from "./SaveToListDialog";

interface SaveToListButtonProps {
	item: SaveItem;
	itemName?: string;
	className?: string;
}

export function SaveToListButton({
	item,
	itemName,
	className = "",
}: SaveToListButtonProps) {
	const { session } = useAuth();
	const [isOpen, setIsOpen] = useState(false);

	const { data: listsData } = useInfiniteQuery({
		...listUserCollectionListsQueryOptions(session?.info.sub ?? ("" as never)),
		enabled: !!session,
	});

	const lists = listsData?.pages.flatMap((p) => p.records) ?? [];

	const isSaved = useMemo(() => {
		return lists.some((record) =>
			item.type === "card"
				? hasCard(record.value, item.scryfallId)
				: hasDeck(record.value, item.deckUri),
		);
	}, [lists, item]);

	if (!session) {
		return null;
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
				aria-label={isSaved ? "Saved to list" : "Save to list"}
				title={isSaved ? "Saved to list" : "Save to list"}
			>
				<Bookmark
					className={`w-5 h-5 ${isSaved ? "text-blue-500 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}
					fill={isSaved ? "currentColor" : "none"}
				/>
			</button>

			<SaveToListDialog
				item={item}
				itemName={itemName}
				userDid={session.info.sub}
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
			/>
		</>
	);
}
