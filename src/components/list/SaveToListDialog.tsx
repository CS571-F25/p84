import type { Did } from "@atcute/lexicons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { Rkey } from "@/lib/atproto-client";
import {
	listUserCollectionListsQueryOptions,
	useCreateCollectionListMutation,
	useUpdateCollectionListMutation,
} from "@/lib/collection-list-queries";
import {
	addCardToList,
	addDeckToList,
	type CollectionList,
	hasCard,
	hasDeck,
	type SaveItem,
} from "@/lib/collection-list-types";
import { getConstellationQueryKeys } from "@/lib/constellation-queries";
import { toOracleUri } from "@/lib/scryfall-types";

interface SaveToListDialogProps {
	item: SaveItem;
	itemName?: string;
	userDid: Did;
	isOpen: boolean;
	onClose: () => void;
}

export function SaveToListDialog({
	item,
	itemName,
	userDid,
	isOpen,
	onClose,
}: SaveToListDialogProps) {
	const titleId = useId();
	const inputId = useId();
	const [newListName, setNewListName] = useState("");

	const { data: listsData, isLoading } = useInfiniteQuery({
		...listUserCollectionListsQueryOptions(userDid),
		enabled: isOpen,
	});

	const createMutation = useCreateCollectionListMutation();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!isOpen) {
			setNewListName("");
		}
	}, [isOpen]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const handleCreateList = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newListName.trim()) return;

		const itemUri =
			item.type === "card"
				? toOracleUri(item.oracleId)
				: (item.deckUri as `at://${string}`);
		const queryKeys = getConstellationQueryKeys(itemUri, userDid);

		const previousSaved = queryClient.getQueryData<boolean>(
			queryKeys.userSaved,
		);
		const previousCount = queryClient.getQueryData<number>(queryKeys.saveCount);

		queryClient.setQueryData<boolean>(queryKeys.userSaved, true);
		queryClient.setQueryData<number>(
			queryKeys.saveCount,
			(old) => (old ?? 0) + 1,
		);

		createMutation.mutate(
			{ name: newListName.trim(), initialItem: item },
			{
				onError: () => {
					queryClient.setQueryData<boolean>(queryKeys.userSaved, previousSaved);
					queryClient.setQueryData<number>(queryKeys.saveCount, previousCount);
				},
				onSuccess: () => {
					setNewListName("");
					onClose();
				},
			},
		);
	};

	const lists = listsData?.pages.flatMap((p) => p.records) ?? [];

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Dialog */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto border border-gray-300 dark:border-slate-700"
				>
					{/* Header */}
					<div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-slate-800">
						<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
							<Bookmark className="w-5 h-5 text-blue-600 dark:text-blue-400" />
						</div>
						<h2
							id={titleId}
							className="text-xl font-bold text-gray-900 dark:text-white"
						>
							Save to list
						</h2>
					</div>

					{/* Body */}
					<div className="p-6 space-y-4">
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
							</div>
						) : lists.length === 0 ? (
							<p className="text-gray-600 dark:text-gray-400 text-center py-4">
								You don't have any lists yet. Create one below!
							</p>
						) : (
							<div className="space-y-2 max-h-64 overflow-y-auto">
								{lists.map((record) => (
									<ListRow
										key={record.uri}
										list={record.value}
										rkey={record.uri.split("/").pop() ?? ""}
										item={item}
										itemName={itemName}
										userDid={userDid}
										onClose={onClose}
									/>
								))}
							</div>
						)}

						{/* Create new list */}
						<form
							onSubmit={handleCreateList}
							className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-slate-800"
						>
							<input
								id={inputId}
								type="text"
								value={newListName}
								onChange={(e) => setNewListName(e.target.value)}
								disabled={createMutation.isPending}
								placeholder="New list name..."
								className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
							/>
							<button
								type="submit"
								disabled={!newListName.trim() || createMutation.isPending}
								className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
							>
								{createMutation.isPending ? (
									<Loader2 className="w-5 h-5 animate-spin" />
								) : (
									<Plus className="w-5 h-5" />
								)}
							</button>
						</form>
					</div>

					{/* Footer */}
					<div className="flex items-center justify-end gap-3 p-6 pt-0">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg transition-colors"
						>
							Done
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

interface ListRowProps {
	list: CollectionList;
	rkey: string;
	item: SaveItem;
	itemName?: string;
	userDid: Did;
	onClose: () => void;
}

function ListRow({
	list,
	rkey,
	item,
	itemName,
	userDid,
	onClose,
}: ListRowProps) {
	const queryClient = useQueryClient();
	const updateMutation = useUpdateCollectionListMutation(userDid, rkey as Rkey);

	const alreadySaved =
		item.type === "card"
			? hasCard(list, item.scryfallId)
			: hasDeck(list, item.deckUri);

	const handleClick = () => {
		if (alreadySaved) return;

		const updatedList =
			item.type === "card"
				? addCardToList(list, item.scryfallId, item.oracleId)
				: addDeckToList(list, item.deckUri);

		const itemUri =
			item.type === "card"
				? toOracleUri(item.oracleId)
				: (item.deckUri as `at://${string}`);
		const queryKeys = getConstellationQueryKeys(itemUri, userDid);

		const previousSaved = queryClient.getQueryData<boolean>(
			queryKeys.userSaved,
		);
		const previousCount = queryClient.getQueryData<number>(queryKeys.saveCount);

		queryClient.setQueryData<boolean>(queryKeys.userSaved, true);
		queryClient.setQueryData<number>(
			queryKeys.saveCount,
			(old) => (old ?? 0) + 1,
		);

		updateMutation.mutate(updatedList, {
			onError: () => {
				queryClient.setQueryData<boolean>(queryKeys.userSaved, previousSaved);
				queryClient.setQueryData<number>(queryKeys.saveCount, previousCount);
			},
			onSuccess: () => {
				const what = itemName ?? (item.type === "card" ? "Card" : "Deck");
				toast.success(`Saved ${what} to ${list.name}`);
				onClose();
			},
		});
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={alreadySaved || updateMutation.isPending}
			className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:hover:bg-gray-50 dark:disabled:hover:bg-slate-800 rounded-lg transition-colors disabled:cursor-not-allowed"
		>
			<span className="font-medium text-gray-900 dark:text-white">
				{list.name}
			</span>
			<span className="text-sm text-gray-500 dark:text-gray-400">
				{alreadySaved ? (
					"Already saved"
				) : updateMutation.isPending ? (
					<Loader2 className="w-4 h-4 animate-spin" />
				) : (
					`${list.items.length} items`
				)}
			</span>
		</button>
	);
}
