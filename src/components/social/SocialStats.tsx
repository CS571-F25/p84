import { Bookmark, Heart, MessageSquare, Rows3 } from "lucide-react";
import { useState } from "react";
import { useItemSocialStats } from "@/lib/constellation-queries";
import { useLikeMutation } from "@/lib/like-queries";
import {
	hasDeckCount,
	isSaveable,
	type SocialItem,
} from "@/lib/social-item-types";
import { useAuth } from "@/lib/useAuth";
import { SaveToListDialog } from "../list/SaveToListDialog";
import { BacklinkModal } from "./BacklinkModal";
import type { BacklinkType } from "./BacklinkRow";

interface SocialStatsProps {
	item: SocialItem;
	itemName?: string;
	showCount?: boolean;
	className?: string;
	/** Show comment/reply button - clicking invokes this handler */
	onCommentClick?: () => void;
}

export function SocialStats({
	item,
	itemName,
	showCount = true,
	className = "",
	onCommentClick,
}: SocialStatsProps) {
	const { session } = useAuth();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [openModal, setOpenModal] = useState<BacklinkType | null>(null);
	const likeMutation = useLikeMutation();

	const itemIsSaveable = isSaveable(item);
	const itemHasDeckCount = hasDeckCount(item);

	const {
		isSavedByUser,
		saveCount,
		isSaveLoading,
		isLikedByUser,
		likeCount,
		isLikeLoading,
		isInUserDeck,
		deckCount,
		isDeckCountLoading,
		commentOrReplyCount,
		isCommentOrReplyCountLoading,
	} = useItemSocialStats(item);

	const handleSaveClick = () => {
		if (session && itemIsSaveable) {
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
			? "hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
			: "cursor-default opacity-75"
	}`;

	return (
		<div className={`flex items-center ${className}`}>
			{/* Like button - always visible for all item types */}
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
								: "text-gray-600 dark:text-zinc-300"
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
								: "text-gray-600 dark:text-zinc-300"
						} ${likeCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
						title={likeCount > 0 ? "See who liked this" : undefined}
					>
						{likeCount}
					</button>
				)}
			</div>

			{/* Save button - only for saveable items (cards/decks) */}
			{itemIsSaveable && (
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
									: "text-gray-600 dark:text-zinc-300"
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
									: "text-gray-600 dark:text-zinc-300"
							} ${saveCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
							title={saveCount > 0 ? "See lists with this item" : undefined}
						>
							{saveCount}
						</button>
					)}
				</div>
			)}

			{/* Deck count - only for cards */}
			{itemHasDeckCount && showCount && (
				<div className="flex items-center">
					<div
						className={`${statBase} ${
							isInUserDeck
								? "text-purple-500 dark:text-purple-400"
								: "text-gray-600 dark:text-zinc-300"
						}`}
						title={isInUserDeck ? "In your deck" : "Decks containing this card"}
					>
						<Rows3
							className="w-5 h-5"
							fill={isInUserDeck ? "currentColor" : "none"}
						/>
					</div>
					<button
						type="button"
						onClick={() => deckCount > 0 && setOpenModal("decks")}
						disabled={deckCount === 0}
						className={`text-sm tabular-nums px-1 py-2 rounded ${isDeckCountLoading ? "opacity-50" : ""} ${
							isInUserDeck
								? "text-purple-500 dark:text-purple-400"
								: "text-gray-600 dark:text-zinc-300"
						} ${deckCount > 0 ? "hover:underline cursor-pointer" : "cursor-default"}`}
						title={deckCount > 0 ? "See decks with this card" : undefined}
					>
						{deckCount}
					</button>
				</div>
			)}

			{/* Comments/Replies button - shown if handler provided */}
			{onCommentClick && (
				<div className="flex items-center">
					<button
						type="button"
						onClick={onCommentClick}
						className={`${statBase} text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors`}
						aria-label={
							item.type === "comment" || item.type === "reply"
								? "Replies"
								: "Comments"
						}
						title={
							item.type === "comment" || item.type === "reply"
								? "Replies"
								: "Comments"
						}
					>
						<MessageSquare className="w-5 h-5" />
					</button>
					{showCount && (
						<span
							className={`text-sm tabular-nums px-1 py-2 text-gray-600 dark:text-zinc-300 ${isCommentOrReplyCountLoading ? "opacity-50" : ""}`}
						>
							{commentOrReplyCount}
						</span>
					)}
				</div>
			)}

			{/* Save dialog - only for saveable items */}
			{session && itemIsSaveable && (
				<SaveToListDialog
					item={item}
					itemName={itemName}
					userDid={session.info.sub}
					isOpen={isDialogOpen}
					onClose={() => setIsDialogOpen(false)}
				/>
			)}

			{/* Backlink modal for viewing who liked/saved/decked */}
			{openModal && (
				<BacklinkModal
					isOpen={openModal !== null}
					onClose={() => setOpenModal(null)}
					type={openModal}
					item={item}
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
