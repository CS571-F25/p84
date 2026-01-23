import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ProseMirrorEditor } from "@/components/richtext/ProseMirrorEditor";
import { RichtextRenderer } from "@/components/richtext/RichtextRenderer";
import { schema } from "@/components/richtext/schema";
import type { Document } from "@/lib/lexicons/types/com/deckbelcher/richtext";
import { lexiconToTree, treeToLexicon } from "@/lib/richtext-convert";
import { type PMDocJSON, useProseMirror } from "@/lib/useProseMirror";

type Block = NonNullable<Document["content"]>[number];

function getBlockPlainText(block: Block): string {
	switch (block.$type) {
		case "com.deckbelcher.richtext#headingBlock":
		case "com.deckbelcher.richtext#paragraphBlock":
			return block.text ?? "";
		case "com.deckbelcher.richtext#codeBlock":
			return block.text;
		case "com.deckbelcher.richtext#bulletListBlock":
		case "com.deckbelcher.richtext#orderedListBlock":
			return block.items.map((item) => item.text ?? "").join("\n");
		case "com.deckbelcher.richtext#horizontalRuleBlock":
			return "---";
		default:
			return "";
	}
}

interface RichtextSectionProps {
	document?: Document;
	onSave?: (doc: Document) => void;
	isSaving?: boolean;
	readOnly?: boolean;
	placeholder?: string;
	emptyText?: string;
	availableTags?: string[];
}

const COLLAPSED_LINES = 8;
const LINE_HEIGHT = 1.5;

export function RichtextSection({
	document,
	onSave,
	isSaving,
	readOnly = false,
	placeholder = "Write something...",
	emptyText = "Add a description...",
	availableTags,
}: RichtextSectionProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	// Convert lexicon to PM tree for editing
	const initialPMDoc = useMemo(() => {
		if (!document) return undefined;
		return lexiconToTree(document).toJSON();
	}, [document]);

	// Wrap onSave to convert PM tree back to lexicon
	const handleSave = useCallback(
		(pmDocJSON: PMDocJSON) => {
			if (!onSave) return;
			const pmNode = schema.nodeFromJSON(pmDocJSON);
			const lexicon = treeToLexicon(pmNode);
			onSave(lexicon);
		},
		[onSave],
	);

	const { doc, onChange, isDirty } = useProseMirror({
		initialDoc: initialPMDoc,
		onSave: handleSave,
		saveDebounceMs: 1500,
	});

	// Get plain text for content check and line count
	const plainText = useMemo(() => {
		if (!document?.content) return "";
		return document.content.map(getBlockPlainText).join("\n");
	}, [document]);

	const hasContent = plainText.trim().length > 0;
	const lineCount = plainText.split("\n").length;
	const needsTruncation = lineCount > COLLAPSED_LINES;

	if (isEditing && !readOnly) {
		return (
			<div className="space-y-3">
				<ProseMirrorEditor
					defaultValue={doc}
					onChange={onChange}
					placeholder={placeholder}
					availableTags={availableTags}
				/>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-300">
						{isSaving && <span>Saving...</span>}
						{!isSaving && isDirty && <span>Unsaved changes</span>}
						{!isSaving && !isDirty && hasContent && <span>Saved</span>}
					</div>
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
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
				className="text-sm text-gray-400 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 italic"
			>
				{emptyText}
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
					<RichtextRenderer
						doc={document}
						className="text-gray-700 dark:text-zinc-300"
					/>
				</div>

				{needsTruncation && !isExpanded && (
					<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent pointer-events-none" />
				)}
			</div>

			<div className="flex items-center gap-2 mt-2">
				{needsTruncation && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
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
						className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
					>
						<Pencil className="w-4 h-4" />
						Edit
					</button>
				)}
			</div>
		</div>
	);
}
