import { useState } from "react";
import { RichTextEditor } from "@/components/richtext/RichTextEditor";
import { type ParseResult, RichText } from "@/lib/richtext";

interface PrimerSectionProps {
	markdown: string;
	setMarkdown: (value: string) => void;
	parsed: ParseResult;
	isDirty?: boolean;
	isPending?: boolean;
	isSaving?: boolean;
	readOnly?: boolean;
}

const COLLAPSED_LINES = 4;
const LINE_HEIGHT = 1.5;

export function PrimerSection({
	markdown,
	setMarkdown,
	parsed,
	isDirty,
	isPending,
	isSaving,
	readOnly = false,
}: PrimerSectionProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	const hasContent = parsed.text.trim().length > 0;
	const lineCount = parsed.text.split("\n").length;
	const needsTruncation = lineCount > COLLAPSED_LINES;

	if (isEditing && !readOnly) {
		return (
			<div className="space-y-3">
				<div className="flex justify-end">
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
					>
						Done
					</button>
				</div>
				<RichTextEditor
					markdown={markdown}
					setMarkdown={setMarkdown}
					parsed={parsed}
					isDirty={isDirty}
					isPending={isPending}
					isSaving={isSaving}
					placeholder="Write about your deck's strategy, key combos, card choices..."
				/>
			</div>
		);
	}

	if (!hasContent && readOnly) {
		return null;
	}

	if (!hasContent) {
		return (
			<button
				type="button"
				onClick={() => setIsEditing(true)}
				className="text-sm text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 italic"
			>
				Add a description...
			</button>
		);
	}

	return (
		<div className="relative">
			<div
				className={
					!isExpanded && needsTruncation ? "overflow-hidden" : undefined
				}
				style={
					!isExpanded && needsTruncation
						? { maxHeight: `${COLLAPSED_LINES * LINE_HEIGHT}em` }
						: undefined
				}
			>
				<RichText
					text={parsed.text}
					facets={parsed.facets}
					className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
				/>
			</div>

			{needsTruncation && !isExpanded && (
				<div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
			)}

			<div className="flex items-center gap-3 mt-1">
				{needsTruncation && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
					>
						{isExpanded ? "Show less" : "Show more"}
					</button>
				)}
				{!readOnly && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
					>
						Edit
					</button>
				)}
			</div>
		</div>
	);
}
