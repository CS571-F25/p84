import { Bold, Code, Italic, Link } from "lucide-react";
import { toggleMark } from "prosemirror-commands";
import type { MarkType } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

interface ToolbarProps {
	view: EditorView | null;
}

export function Toolbar({ view }: ToolbarProps) {
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

	const insertLink = () => {
		const { from, to } = state.selection;
		const selectedText = state.doc.textBetween(from, to);
		const url = prompt("Enter URL:", "https://");
		if (!url) return;

		const linkMark = schema.marks.link.create({ href: url });
		const tr = state.tr;

		if (selectedText) {
			tr.addMark(from, to, linkMark);
		} else {
			const linkText = prompt("Enter link text:", url) || url;
			tr.insertText(linkText, from);
			tr.addMark(from, from + linkText.length, linkMark);
		}

		view.dispatch(tr);
		view.focus();
	};

	return (
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
				onClick={insertLink}
				active={isMarkActive(schema.marks.link)}
				title="Insert Link"
			>
				<Link className="w-4 h-4" />
			</ToolbarButton>
		</div>
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
