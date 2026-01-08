import type { ParseResult } from "@/lib/richtext";
import { RichText } from "@/lib/richtext";

type SaveState = "saved" | "dirty" | "saving";

function getSaveState({
	isDirty,
	isPending,
	isSaving,
}: {
	isDirty?: boolean;
	isPending?: boolean;
	isSaving?: boolean;
}): SaveState {
	if (isSaving) return "saving";
	// isPending (debounce buffering) or isDirty both show as "dirty"
	if (isPending || isDirty) return "dirty";
	return "saved";
}

function SaveIndicator({ state }: { state: SaveState }) {
	const colors: Record<SaveState, string> = {
		saving: "text-blue-400 dark:text-blue-500",
		dirty: "text-amber-500 dark:text-amber-400",
		saved: "text-green-500 dark:text-green-400",
	};

	const labels: Record<SaveState, string> = {
		saving: "Saving",
		dirty: "Unsaved",
		saved: "Saved",
	};

	return (
		<svg
			className={`w-3 h-3 ${colors[state]}`}
			viewBox="0 0 24 24"
			fill="currentColor"
			role="img"
			aria-label={labels[state]}
		>
			<circle cx="12" cy="12" r="6" />
		</svg>
	);
}

export interface RichTextEditorProps {
	markdown: string;
	setMarkdown: (value: string) => void;
	parsed: ParseResult;
	isDirty?: boolean;
	isPending?: boolean;
	isSaving?: boolean;
	placeholder?: string;
	className?: string;
}

export function RichTextEditor({
	markdown,
	setMarkdown,
	parsed,
	isDirty,
	isPending,
	isSaving,
	placeholder = "Write something...",
	className,
}: RichTextEditorProps) {
	const saveState = getSaveState({ isDirty, isPending, isSaving });

	return (
		<div className={className}>
			<div className="grid grid-cols-2 gap-4">
				<div className="relative">
					<textarea
						value={markdown}
						onChange={(e) => setMarkdown(e.target.value)}
						placeholder={placeholder}
						className="w-full h-64 p-3 pr-8 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-y font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
					/>
					<div className="absolute top-2 right-2">
						<SaveIndicator state={saveState} />
					</div>
				</div>
				<div className="p-3 border border-gray-300 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/50 min-h-64 overflow-auto">
					{parsed.text ? (
						<RichText
							text={parsed.text}
							facets={parsed.facets}
							className="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap"
						/>
					) : (
						<span className="text-gray-400 dark:text-gray-500">
							{placeholder}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
