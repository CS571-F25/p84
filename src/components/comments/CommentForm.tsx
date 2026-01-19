import { useCallback, useMemo, useState } from "react";
import { ProseMirrorEditor } from "@/components/richtext/ProseMirrorEditor";
import { schema } from "@/components/richtext/schema";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import { lexiconToTree, treeToLexicon } from "@/lib/richtext-convert";
import { useProseMirror } from "@/lib/useProseMirror";

interface CommentFormProps {
	initialContent?: Document;
	onSubmit: (content: Document) => void;
	onCancel?: () => void;
	isPending?: boolean;
	placeholder?: string;
	submitLabel?: string;
	availableTags?: string[];
}

export function CommentForm({
	initialContent,
	onSubmit,
	onCancel,
	isPending,
	placeholder = "Write a comment...",
	submitLabel,
	availableTags,
}: CommentFormProps) {
	const isEditMode = !!initialContent;
	const [key, setKey] = useState(0);

	const initialPMDoc = useMemo(() => {
		if (!initialContent) return undefined;
		return lexiconToTree(initialContent).toJSON();
	}, [initialContent]);

	const { doc, onChange, isDirty } = useProseMirror({
		initialDoc: initialPMDoc,
	});

	const hasContent = doc.textContent.trim().length > 0;

	const handleSubmit = useCallback(() => {
		if (!hasContent || isPending) return;
		if (isEditMode && !isDirty) {
			onSubmit(initialContent);
			return;
		}
		const content = treeToLexicon(doc);
		onSubmit(content);
		if (!isEditMode) {
			setKey((k) => k + 1);
		}
	}, [
		doc,
		hasContent,
		isDirty,
		initialContent,
		isEditMode,
		isPending,
		onSubmit,
	]);

	const label = submitLabel ?? (isEditMode ? "Done" : "Post");

	return (
		<div className="space-y-1">
			<ProseMirrorEditor
				key={key}
				defaultValue={
					isEditMode
						? doc
						: schema.node("doc", null, [schema.node("paragraph")])
				}
				onChange={onChange}
				placeholder={placeholder}
				showToolbar
				availableTags={availableTags}
				className="text-sm"
			/>
			<div className="flex items-center justify-end gap-2">
				{isPending && (
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Saving...
					</span>
				)}
				{!isPending && isEditMode && isDirty && (
					<span className="text-sm text-gray-500 dark:text-gray-400">
						Unsaved changes
					</span>
				)}
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						disabled={isPending}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
					>
						Cancel
					</button>
				)}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!hasContent || isPending}
					className={`px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
						isEditMode
							? "bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
							: "bg-blue-600 hover:bg-blue-700 text-white"
					}`}
				>
					{isPending ? "Saving..." : label}
				</button>
			</div>
		</div>
	);
}
