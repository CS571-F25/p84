import { Bookmark, Heart, Layers } from "lucide-react";
import { useState } from "react";
import type { SaveItem } from "@/lib/collection-list-types";
import type { SocialItemUri } from "@/lib/constellation-queries";
import { useItemSocialStats } from "@/lib/constellation-queries";
import { useLikeMutation } from "@/lib/like-queries";
import { toOracleUri } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";
import { SaveToListDialog } from "../list/SaveToListDialog";
import { BacklinkModal } from "./BacklinkModal";
import type { BacklinkType } from "./BacklinkRow";

interface SocialStatsProps {
	item: SaveItem;
	itemName?: string;
	showCount?: boolean;
	className?: string;
}

function getItemUri(item: SaveItem): SocialItemUri {
	return item.type === "card" ? toOracleUri(item.oracleId) : item.uri;
}

export function SocialStats({
	item,
	itemName,
	showCount = true,
	className = "",
}: SocialStatsProps) {
	const { session } = useAuth();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [openModal, setOpenModal] = useState<BacklinkType | null>(null);
	const likeMutation = useLikeMutation();

	const itemUri = getItemUri(item);
	const {
		isSavedByUser,
		saveCount,
		isSaveLoading,
		isLikedByUser,
		likeCount,
		isLikeLoading,
		deckCount,
		isDeckCountLoading,
	} = useItemSocialStats(itemUri, item.type);

	const handleSaveClick = () => {
		if (session) {
			setIsDialogOpen(true);
		}
	};

	const handleLikeClick = () => {
		if (!session) return;
		likeMutation.mutate({
			item,
			isLiked: isLikedByUser,
			itemName,
		});
	};

	const statBase = "flex items-center gap-1 p-2 rounded-lg";
	const buttonBase = `${statBase} transition-colors ${
		session
			? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
			: "cursor-default opacity-75"
	}`;

	return (
		<div className={`flex items-center ${className}`}>
			{/* Like button */}
			<div className="flex items-center">
				<button
					type="button"
					onClick={handleLikeClick}
					disabled={!session || likeMutation.isPending}
					className={buttonBase}
					aria-label={isLikedByUser ? "Unlike" : "Like"}
					title={
						session ? (isLikedByUser ? "Unlike" : "Like") : "Sign in to like"
					}
				>
					<Heart
						className={`w-5 h-5 ${
							isLikedByUser
								? "text-rose-400 dark:text-red-400"
								: "text-gray-600 dark:text-gray-400"
						}`}
						fill={isLikedByUser ? "currentColor" : "none"}
					/>
				</button>
				{showCount && (
					<button
						type="button"
						onClick={() => likeCount > 0 && setOpenModal("likes")}
						disabled={likeCount === 0}
						className={`text-sm tabular-nums px-1 py-2 rounded ${isLikeLoading ? "opacity-50" : ""} ${
							isLikedByUser
								? "text-rose-400 dark:text-red-400"
								: "text-gray-600 dark:text-gray-400"
						} ${likeCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
						title={likeCount > 0 ? "See who liked this" : undefined}
					>
						{likeCount}
					</button>
				)}
			</div>

			{/* Save button */}
			<div className="flex items-center">
				<button
					type="button"
					onClick={handleSaveClick}
					disabled={!session}
					className={buttonBase}
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
				</button>
				{showCount && (
					<button
						type="button"
						onClick={() => saveCount > 0 && setOpenModal("saves")}
						disabled={saveCount === 0}
						className={`text-sm tabular-nums px-1 py-2 rounded ${isSaveLoading ? "opacity-50" : ""} ${
							isSavedByUser
								? "text-blue-500 dark:text-blue-400"
								: "text-gray-600 dark:text-gray-400"
						} ${saveCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
						title={saveCount > 0 ? "See lists with this item" : undefined}
					>
						{saveCount}
					</button>
				)}
			</div>

			{/* Deck count (cards only) */}
			{item.type === "card" && showCount && (
				<div className="flex items-center">
					<div
						className={`${statBase} text-gray-600 dark:text-gray-400`}
						title="Decks containing this card"
					>
						<Layers className="w-5 h-5" />
					</div>
					<button
						type="button"
						onClick={() => deckCount > 0 && setOpenModal("decks")}
						disabled={deckCount === 0}
						className={`text-sm tabular-nums px-1 py-2 rounded text-gray-600 dark:text-gray-400 ${isDeckCountLoading ? "opacity-50" : ""} ${deckCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
						title={deckCount > 0 ? "See decks with this card" : undefined}
					>
						{deckCount}
					</button>
				</div>
			)}

			{session && (
				<SaveToListDialog
					item={item}
					itemName={itemName}
					userDid={session.info.sub}
					isOpen={isDialogOpen}
					onClose={() => setIsDialogOpen(false)}
				/>
			)}

			{openModal && (
				<BacklinkModal
					isOpen={openModal !== null}
					onClose={() => setOpenModal(null)}
					type={openModal}
					itemUri={itemUri}
					itemType={item.type}
					total={
						openModal === "likes"
							? likeCount
							: openModal === "saves"
								? saveCount
								: deckCount
					}
				/>
			)}
		</div>
	);
}
