import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useState } from "react";

interface DeleteListDialogProps {
	listName: string;
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isDeleting?: boolean;
}

export function DeleteListDialog({
	listName,
	isOpen,
	onClose,
	onConfirm,
	isDeleting = false,
}: DeleteListDialogProps) {
	const [confirmText, setConfirmText] = useState("");
	const titleId = useId();
	const inputId = useId();

	const isMatch = confirmText === listName;

	useEffect(() => {
		if (!isOpen) {
			setConfirmText("");
		}
	}, [isOpen]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isDeleting) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleKeyDown);
			return () => document.removeEventListener("keydown", handleKeyDown);
		}
	}, [isOpen, isDeleting, onClose]);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isMatch && !isDeleting) {
			onConfirm();
		}
	};

	return (
		<>
			<div
				className="fixed inset-0 bg-black/50 z-40"
				onClick={isDeleting ? undefined : onClose}
				aria-hidden="true"
			/>

			<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-md w-full pointer-events-auto border border-gray-300 dark:border-zinc-600"
				>
					<div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-zinc-700">
						<div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
							<AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
						</div>
						<h2
							id={titleId}
							className="text-xl font-bold text-gray-900 dark:text-white"
						>
							Delete list
						</h2>
					</div>

					<form onSubmit={handleSubmit} className="p-6 space-y-4">
						<p className="text-gray-600 dark:text-zinc-300">
							This action <strong>cannot</strong> be undone. This will
							permanently delete the list.
						</p>

						<div>
							<label
								htmlFor={inputId}
								className="block text-sm text-gray-700 dark:text-zinc-300 mb-2"
							>
								Please type{" "}
								<span className="font-mono font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
									{listName}
								</span>{" "}
								to confirm.
							</label>
							<input
								id={inputId}
								type="text"
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								disabled={isDeleting}
								autoComplete="off"
								className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="List name"
							/>
						</div>

						<div className="flex items-center justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={onClose}
								disabled={isDeleting}
								className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={!isMatch || isDeleting}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
							>
								{isDeleting ? "Deleting..." : "Delete this list"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}
