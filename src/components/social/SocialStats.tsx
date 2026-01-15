import { Bookmark } from "lucide-react";
import { useState } from "react";
import type { DeckItemUri } from "@/lib/constellation-queries";
import { useItemSocialStats } from "@/lib/constellation-queries";
import type { OracleId, OracleUri, ScryfallId } from "@/lib/scryfall-types";
import { toOracleUri } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";
import { SaveToListDialog } from "../list/SaveToListDialog";

export type SocialItem =
	| { type: "card"; scryfallId: ScryfallId; oracleId: OracleId }
	| { type: "deck"; deckUri: DeckItemUri };

interface SocialStatsProps {
	item: SocialItem;
	itemName?: string;
	showCount?: boolean;
	className?: string;
}

function getItemUri(item: SocialItem): OracleUri | DeckItemUri {
	return item.type === "card" ? toOracleUri(item.oracleId) : item.deckUri;
}

export function SocialStats({
	item,
	itemName,
	showCount = true,
	className = "",
}: SocialStatsProps) {
	const { session } = useAuth();
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const itemUri = getItemUri(item);
	const { isSavedByUser, saveCount, isLoading } = useItemSocialStats(
		itemUri,
		item.type,
	);

	const handleClick = () => {
		if (session) {
			setIsDialogOpen(true);
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={handleClick}
				disabled={!session}
				className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${
					session
						? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
						: "cursor-default opacity-75"
				} ${className}`}
				aria-label={isSavedByUser ? "Saved to list" : "Save to list"}
				title={
					session
						? isSavedByUser
							? "Saved to list"
							: "Save to list"
						: "Sign in to save"
				}
			>
				<Bookmark
					className={`w-5 h-5 ${
						isSavedByUser
							? "text-blue-500 dark:text-blue-400"
							: "text-gray-600 dark:text-gray-400"
					}`}
					fill={isSavedByUser ? "currentColor" : "none"}
				/>
				{showCount && (
					<span
						className={`text-sm tabular-nums ${isLoading ? "opacity-50" : ""} ${
							isSavedByUser
								? "text-blue-500 dark:text-blue-400"
								: "text-gray-600 dark:text-gray-400"
						}`}
					>
						{saveCount}
					</span>
				)}
			</button>

			{session && (
				<SaveToListDialog
					item={item}
					itemName={itemName}
					userDid={session.info.sub}
					isOpen={isDialogOpen}
					onClose={() => setIsDialogOpen(false)}
				/>
			)}
		</>
	);
}
