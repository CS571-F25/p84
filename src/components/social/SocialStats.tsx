import { Bookmark, Heart } from "lucide-react";
import { useState } from "react";
import type { SaveItem } from "@/lib/collection-list-types";
import type { SocialItemUri } from "@/lib/constellation-queries";
import { useItemSocialStats } from "@/lib/constellation-queries";
import { useLikeMutation } from "@/lib/like-queries";
import { toOracleUri } from "@/lib/scryfall-types";
import { useAuth } from "@/lib/useAuth";
import { SaveToListDialog } from "../list/SaveToListDialog";

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
	const likeMutation = useLikeMutation();

	const itemUri = getItemUri(item);
	const {
		isSavedByUser,
		saveCount,
		isSaveLoading,
		isLikedByUser,
		likeCount,
		isLikeLoading,
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

	const buttonBase = `flex items-center gap-1 p-2 rounded-lg transition-colors ${
		session
			? "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
			: "cursor-default opacity-75"
	}`;

	return (
		<div className={`flex items-center ${className}`}>
			{/* Like button */}
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
				{showCount && (
					<span
						className={`text-sm tabular-nums ${isLikeLoading ? "opacity-50" : ""} ${
							isLikedByUser
								? "text-rose-400 dark:text-red-400"
								: "text-gray-600 dark:text-gray-400"
						}`}
					>
						{likeCount}
					</span>
				)}
			</button>

			{/* Save button */}
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
				{showCount && (
					<span
						className={`text-sm tabular-nums ${isSaveLoading ? "opacity-50" : ""} ${
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
		</div>
	);
}
