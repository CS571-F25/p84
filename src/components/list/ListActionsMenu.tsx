import { MoreVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Rkey } from "@/lib/atproto-client";
import { useDeleteCollectionListMutation } from "@/lib/collection-list-queries";
import { DeleteListDialog } from "./DeleteListDialog";

interface ListActionsMenuProps {
	listName: string;
	rkey: Rkey;
}

export function ListActionsMenu({ listName, rkey }: ListActionsMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const deleteMutation = useDeleteCollectionListMutation(rkey);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="p-2 text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
				aria-label="List actions"
				aria-expanded={isOpen}
			>
				<MoreVertical size={16} />
			</button>

			{isOpen && (
				<div className="absolute left-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg overflow-hidden z-50">
					<button
						type="button"
						onClick={() => {
							setIsOpen(false);
							setShowDeleteDialog(true);
						}}
						className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
					>
						<Trash2 size={14} />
						Delete list
					</button>
				</div>
			)}

			<DeleteListDialog
				listName={listName}
				isOpen={showDeleteDialog}
				onClose={() => setShowDeleteDialog(false)}
				onConfirm={() => deleteMutation.mutate()}
				isDeleting={deleteMutation.isPending}
			/>
		</div>
	);
}
