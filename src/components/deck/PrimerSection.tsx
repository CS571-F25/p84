import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { RefObject } from "react";
import { useState } from "react";
import { RichTextEditor } from "@/components/richtext/RichTextEditor";
import { type ParseResult, RichText } from "@/lib/richtext";

interface PrimerSectionProps {
	inputRef: RefObject<HTMLTextAreaElement | null>;
	onInput: () => void;
	defaultValue: string;
	parsed: ParseResult;
	isDirty?: boolean;
	isSaving?: boolean;
	readOnly?: boolean;
}

const COLLAPSED_LINES = 8;
const LINE_HEIGHT = 1.5;

export function PrimerSection({
	inputRef,
	onInput,
	defaultValue,
	parsed,
	isDirty,
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
				<RichTextEditor
					inputRef={inputRef}
					onInput={onInput}
					defaultValue={defaultValue}
					parsed={parsed}
					isDirty={isDirty}
					isSaving={isSaving}
					placeholder="Write about your deck's strategy, key combos, card choices..."
				/>
				<div className="flex justify-end">
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
					>
						Done
					</button>
				</div>
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
		<div>
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
					<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
				)}
			</div>

			<div className="flex items-center gap-2 mt-2">
				{needsTruncation && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
					>
						{isExpanded ? (
							<>
								<ChevronUp className="w-4 h-4" />
								Show less
							</>
						) : (
							<>
								<ChevronDown className="w-4 h-4" />
								Show more
							</>
						)}
					</button>
				)}
				{!readOnly && (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
					>
						<Pencil className="w-4 h-4" />
						Edit
					</button>
				)}
			</div>
		</div>
	);
}
