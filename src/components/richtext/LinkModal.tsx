import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface LinkModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (url: string, text?: string) => void;
	initialUrl?: string;
	initialText?: string;
	showTextInput?: boolean;
}

export function LinkModal({
	isOpen,
	onClose,
	onSubmit,
	initialUrl = "",
	initialText = "",
	showTextInput = false,
}: LinkModalProps) {
	const [url, setUrl] = useState(initialUrl);
	const [text, setText] = useState(initialText);
	const urlInputRef = useRef<HTMLInputElement>(null);
	const id = useId();
	const urlId = `${id}-url`;
	const textId = `${id}-text`;

	useEffect(() => {
		if (isOpen) {
			setUrl(initialUrl);
			setText(initialText);
			setTimeout(() => urlInputRef.current?.focus(), 0);
		}
	}, [isOpen, initialUrl, initialText]);

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (!url.trim()) return;
			onSubmit(
				url.trim(),
				showTextInput ? text.trim() || url.trim() : undefined,
			);
			onClose();
		},
		[url, text, showTextInput, onSubmit, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		},
		[onClose],
	);

	if (!isOpen) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${id}-title`}
			className="fixed inset-0 z-50 flex items-center justify-center"
			onKeyDown={handleKeyDown}
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/50 cursor-default"
				onClick={onClose}
				aria-label="Close modal"
			/>
			<div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 w-full max-w-md mx-4">
				<div className="flex items-center justify-between mb-4">
					<h3
						id={`${id}-title`}
						className="text-lg font-semibold text-gray-900 dark:text-white"
					>
						{initialUrl ? "Edit Link" : "Insert Link"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor={urlId}
							className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							URL
						</label>
						<input
							ref={urlInputRef}
							id={urlId}
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="example.com"
							className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{showTextInput && (
						<div>
							<label
								htmlFor={textId}
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Link Text
							</label>
							<input
								id={textId}
								type="text"
								value={text}
								onChange={(e) => setText(e.target.value)}
								placeholder="Display text (optional)"
								className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					)}

					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!url.trim()}
							className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md"
						>
							{initialUrl ? "Save" : "Insert"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
