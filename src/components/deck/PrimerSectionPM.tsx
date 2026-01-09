import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useState } from "react";
import { DocRenderer } from "@/components/richtext/DocRenderer";
import { ProseMirrorEditor } from "@/components/richtext/ProseMirrorEditor";
import { type PMDocJSON, useProseMirror } from "@/lib/useProseMirror";

interface PrimerSectionPMProps {
	initialDoc?: PMDocJSON;
	onSave?: (doc: PMDocJSON) => void;
	isSaving?: boolean;
	readOnly?: boolean;
}

const COLLAPSED_LINES = 8;
const LINE_HEIGHT = 1.5;

function getDocText(doc: PMDocJSON | undefined): string {
	if (!doc?.content) return "";
	return doc.content
		.map((block) => {
			if (block.type === "paragraph" && block.content) {
				return block.content.map((node) => node.text ?? "").join("");
			}
			return "";
		})
		.join("\n");
}

export function PrimerSectionPM({
	initialDoc,
	onSave,
	isSaving,
	readOnly = false,
}: PrimerSectionPMProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	const { doc, docJSON, onChange, isDirty } = useProseMirror({
		initialDoc,
		onSave,
		saveDebounceMs: 1500,
	});

	const plainText = getDocText(docJSON);
	const hasContent = plainText.trim().length > 0;
	const lineCount = plainText.split("\n").length;
	const needsTruncation = lineCount > COLLAPSED_LINES;

	if (isEditing && !readOnly) {
		return (
			<div className="space-y-3">
				<ProseMirrorEditor
					defaultValue={doc}
					onChange={onChange}
					placeholder="Write about your deck's strategy, key combos, card choices..."
				/>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
						{isSaving && <span>Saving...</span>}
						{!isSaving && isDirty && <span>Unsaved changes</span>}
						{!isSaving && !isDirty && hasContent && <span>Saved</span>}
					</div>
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
					<DocRenderer
						doc={docJSON}
						className="text-gray-700 dark:text-gray-300"
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
