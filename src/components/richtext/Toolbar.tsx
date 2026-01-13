import { Bold, Code, Italic, Link } from "lucide-react";
import { toggleMark } from "prosemirror-commands";
import type { MarkType } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { useCallback, useState } from "react";
import { LinkModal } from "./LinkModal";

interface ToolbarProps {
	view: EditorView | null;
}

export function Toolbar({ view }: ToolbarProps) {
	const [linkModalOpen, setLinkModalOpen] = useState(false);
	const [linkModalState, setLinkModalState] = useState({
		initialUrl: "",
		initialText: "",
		showTextInput: false,
		// Range of existing link being edited, if any
		linkRange: null as { from: number; to: number } | null,
	});

	const handleLinkSubmit = useCallback(
		(url: string, text?: string) => {
			if (!view) return;
			// Default to https:// if no protocol provided
			const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
			const linkMark = view.state.schema.marks.link.create({ href });
			const tr = view.state.tr;

			if (linkModalState.linkRange) {
				// Editing existing link - remove old mark first, then add new one
				const { from, to } = linkModalState.linkRange;
				tr.removeMark(from, to, view.state.schema.marks.link);
				tr.addMark(from, to, linkMark);
			} else {
				// New link
				const { from, to } = view.state.selection;
				const selectedText = view.state.doc.textBetween(from, to);

				if (selectedText) {
					tr.addMark(from, to, linkMark);
				} else {
					const linkText = text || url;
					tr.insertText(linkText, from);
					tr.addMark(from, from + linkText.length, linkMark);
				}
			}

			view.dispatch(tr);
			view.focus();
		},
		[view, linkModalState.linkRange],
	);

	if (!view) return null;

	const { state } = view;
	const { schema } = state;

	const isMarkActive = (markType: MarkType) => {
		const { from, $from, to, empty } = state.selection;
		if (empty) {
			return !!markType.isInSet(state.storedMarks || $from.marks());
		}
		return state.doc.rangeHasMark(from, to, markType);
	};

	const toggleMarkCommand = (markType: MarkType) => {
		return () => {
			toggleMark(markType)(state, view.dispatch, view);
			view.focus();
		};
	};

	const openLinkModal = () => {
		const { from, to, $from } = state.selection;
		const selectedText = state.doc.textBetween(from, to);

		// Check for existing link mark - either at cursor or in selection
		let linkMark = schema.marks.link.isInSet($from.marks());
		let existingUrl = linkMark?.attrs.href as string | undefined;

		// If selection spans text, check if it contains a link
		if (!linkMark && from !== to) {
			state.doc.nodesBetween(from, to, (node) => {
				if (linkMark) return false; // Already found one
				const mark = schema.marks.link.isInSet(node.marks);
				if (mark) {
					linkMark = mark;
					existingUrl = mark.attrs.href as string;
					return false;
				}
			});
		}

		// Find the full extent of the link mark if editing
		let linkRange: { from: number; to: number } | null = null;
		if (linkMark) {
			// Walk through parent's inline content to find link boundaries
			// We check actual node marks, not insertion marks (which differ for non-inclusive marks)
			const $pos = from !== to ? state.doc.resolve(from + 1) : $from;
			const parent = $pos.parent;
			const parentOffset = $pos.start();

			let linkStart: number | null = null;
			let linkEnd: number | null = null;
			let pos = parentOffset;
			let foundEnd = false;

			parent.forEach((node) => {
				if (foundEnd) return;

				const nodeEnd = pos + node.nodeSize;
				const nodeLinkMark = schema.marks.link.isInSet(node.marks);

				if (nodeLinkMark?.attrs.href === existingUrl) {
					if (linkStart === null) linkStart = pos;
					linkEnd = nodeEnd;
				} else if (linkStart !== null) {
					foundEnd = true;
				}

				pos = nodeEnd;
			});

			if (linkStart !== null && linkEnd !== null) {
				linkRange = { from: linkStart, to: linkEnd };
			}
		}

		setLinkModalState({
			initialUrl: existingUrl ?? "",
			initialText: selectedText,
			showTextInput: !selectedText && !existingUrl,
			linkRange,
		});
		setLinkModalOpen(true);
	};

	return (
		<>
			<div className="flex items-center gap-1 p-2 border-b border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
				<ToolbarButton
					onClick={toggleMarkCommand(schema.marks.strong)}
					active={isMarkActive(schema.marks.strong)}
					title="Bold (Cmd+B)"
				>
					<Bold className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={toggleMarkCommand(schema.marks.em)}
					active={isMarkActive(schema.marks.em)}
					title="Italic (Cmd+I)"
				>
					<Italic className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={toggleMarkCommand(schema.marks.code)}
					active={isMarkActive(schema.marks.code)}
					title="Code (Cmd+`)"
				>
					<Code className="w-4 h-4" />
				</ToolbarButton>
				<div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />
				<ToolbarButton
					onClick={openLinkModal}
					active={isMarkActive(schema.marks.link)}
					title={isMarkActive(schema.marks.link) ? "Edit Link" : "Insert Link"}
				>
					<Link className="w-4 h-4" />
				</ToolbarButton>
			</div>
			<LinkModal
				isOpen={linkModalOpen}
				onClose={() => setLinkModalOpen(false)}
				onSubmit={handleLinkSubmit}
				initialUrl={linkModalState.initialUrl}
				initialText={linkModalState.initialText}
				showTextInput={linkModalState.showTextInput}
			/>
		</>
	);
}

interface ToolbarButtonProps {
	onClick: () => void;
	active: boolean;
	title: string;
	children: React.ReactNode;
}

function ToolbarButton({
	onClick,
	active,
	title,
	children,
}: ToolbarButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`p-1.5 rounded transition-colors ${
				active
					? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
					: "hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400"
			}`}
		>
			{children}
		</button>
	);
}
