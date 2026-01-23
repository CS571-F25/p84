import {
	Bold,
	Code,
	Hash,
	Heading1,
	Heading2,
	Italic,
	Link,
	List,
	ListOrdered,
	Minus,
	Redo,
	SquareCode,
	TextSearch,
	Undo,
} from "lucide-react";
import { openAutocomplete } from "prosemirror-autocomplete";
import { setBlockType, toggleMark } from "prosemirror-commands";
import { redo, undo } from "prosemirror-history";
import type { MarkType, NodeType } from "prosemirror-model";
import { liftListItem, wrapInList } from "prosemirror-schema-list";
import { TextSelection } from "prosemirror-state";
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
		linkRange: null as { from: number; to: number } | null,
	});

	const handleLinkSubmit = useCallback(
		(url: string, text?: string) => {
			if (!view) return;
			const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
			const linkMark = view.state.schema.marks.link.create({ href });
			const tr = view.state.tr;

			if (linkModalState.linkRange) {
				const { from, to } = linkModalState.linkRange;
				tr.removeMark(from, to, view.state.schema.marks.link);
				tr.addMark(from, to, linkMark);
			} else {
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

	if (!view) {
		// Render placeholder to reserve space and prevent layout shift
		// Height matches: p-2 (8px*2) + button p-1.5 (6px*2) + icon h-4 (16px) = 44px
		return (
			<div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50 min-h-11" />
		);
	}

	const { state } = view;
	const { schema } = state;

	// Mark helpers
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

	// Block type helpers
	const isBlockActive = (
		nodeType: NodeType,
		attrs?: Record<string, unknown>,
	) => {
		const { $from } = state.selection;
		for (let d = $from.depth; d > 0; d--) {
			const node = $from.node(d);
			if (node.type === nodeType) {
				if (!attrs) return true;
				return Object.entries(attrs).every(
					([key, value]) => node.attrs[key] === value,
				);
			}
		}
		return false;
	};

	const setBlock = (nodeType: NodeType, attrs?: Record<string, unknown>) => {
		return () => {
			// If already this block type, convert back to paragraph
			if (isBlockActive(nodeType, attrs)) {
				setBlockType(schema.nodes.paragraph)(state, view.dispatch);
			} else {
				setBlockType(nodeType, attrs)(state, view.dispatch);
			}
			view.focus();
		};
	};

	const toggleList = (listType: NodeType) => {
		return () => {
			const otherListType =
				listType === schema.nodes.bullet_list
					? schema.nodes.ordered_list
					: schema.nodes.bullet_list;

			if (isBlockActive(listType)) {
				// Already in this list type - lift out
				liftListItem(schema.nodes.list_item)(state, view.dispatch);
			} else if (isBlockActive(otherListType)) {
				// In the other list type - switch by changing the list node type
				const { $from } = state.selection;
				for (let d = $from.depth; d > 0; d--) {
					const node = $from.node(d);
					if (
						node.type === schema.nodes.bullet_list ||
						node.type === schema.nodes.ordered_list
					) {
						const pos = $from.before(d);
						const tr = state.tr.setNodeMarkup(pos, listType, node.attrs);
						view.dispatch(tr);
						break;
					}
				}
			} else {
				// Not in any list - wrap in new list
				wrapInList(listType)(state, view.dispatch);
			}
			view.focus();
		};
	};

	const insertHorizontalRule = () => {
		const tr = state.tr.replaceSelectionWith(
			schema.nodes.horizontal_rule.create(),
		);
		// Always insert a paragraph after HR and move cursor there
		const insertPos = tr.doc.content.size;
		tr.insert(insertPos, schema.nodes.paragraph.create());
		// Move selection to the new paragraph (position inside the paragraph)
		tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
		view.dispatch(tr);
		view.focus();
	};

	const insertCardTrigger = () => {
		openAutocomplete(view, "[[");
		view.focus();
	};

	const insertTagTrigger = () => {
		openAutocomplete(view, "#");
		view.focus();
	};

	// Link modal logic
	const openLinkModal = () => {
		const { from, to, $from } = state.selection;
		const selectedText = state.doc.textBetween(from, to);

		let linkMark = schema.marks.link.isInSet($from.marks());
		let existingUrl = linkMark?.attrs.href as string | undefined;

		if (!linkMark && from !== to) {
			state.doc.nodesBetween(from, to, (node) => {
				if (linkMark) return false;
				const mark = schema.marks.link.isInSet(node.marks);
				if (mark) {
					linkMark = mark;
					existingUrl = mark.attrs.href as string;
					return false;
				}
			});
		}

		let linkRange: { from: number; to: number } | null = null;
		if (linkMark) {
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

	const runUndo = () => {
		undo(state, view.dispatch);
		view.focus();
	};

	const runRedo = () => {
		redo(state, view.dispatch);
		view.focus();
	};

	return (
		<>
			<div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50">
				{/* History */}
				<ToolbarButton onClick={runUndo} active={false} title="Undo (Cmd+Z)">
					<Undo className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={runRedo}
					active={false}
					title="Redo (Cmd+Shift+Z)"
				>
					<Redo className="w-4 h-4" />
				</ToolbarButton>

				<ToolbarDivider />

				{/* Inline marks */}
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
					title="Inline Code (Cmd+`)"
				>
					<Code className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={openLinkModal}
					active={isMarkActive(schema.marks.link)}
					title={isMarkActive(schema.marks.link) ? "Edit Link" : "Insert Link"}
				>
					<Link className="w-4 h-4" />
				</ToolbarButton>

				<ToolbarDivider />

				{/* Block types */}
				<ToolbarButton
					onClick={setBlock(schema.nodes.heading, { level: 1 })}
					active={isBlockActive(schema.nodes.heading, { level: 1 })}
					title="Heading 1"
				>
					<Heading1 className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={setBlock(schema.nodes.heading, { level: 2 })}
					active={isBlockActive(schema.nodes.heading, { level: 2 })}
					title="Heading 2"
				>
					<Heading2 className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={setBlock(schema.nodes.code_block)}
					active={isBlockActive(schema.nodes.code_block)}
					title="Code Block"
				>
					<SquareCode className="w-4 h-4" />
				</ToolbarButton>

				<ToolbarDivider />

				{/* Lists */}
				<ToolbarButton
					onClick={toggleList(schema.nodes.bullet_list)}
					active={isBlockActive(schema.nodes.bullet_list)}
					title="Bullet List"
				>
					<List className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={toggleList(schema.nodes.ordered_list)}
					active={isBlockActive(schema.nodes.ordered_list)}
					title="Numbered List"
				>
					<ListOrdered className="w-4 h-4" />
				</ToolbarButton>

				<ToolbarDivider />

				{/* Insert */}
				<ToolbarButton
					onClick={insertHorizontalRule}
					active={false}
					title="Horizontal Rule"
				>
					<Minus className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={insertCardTrigger}
					active={false}
					title="Insert Card Reference ([[)"
				>
					<TextSearch className="w-4 h-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={insertTagTrigger}
					active={false}
					title="Insert Tag (#)"
				>
					<Hash className="w-4 h-4" />
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

function ToolbarDivider() {
	return <div className="w-px h-5 bg-gray-300 dark:bg-zinc-600 mx-1" />;
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
					: "hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300"
			}`}
		>
			{children}
		</button>
	);
}
