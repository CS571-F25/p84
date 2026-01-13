import autocomplete, {
	ActionKind,
	type AutocompleteAction,
	closeAutocomplete,
	type FromTo,
} from "prosemirror-autocomplete";
import type { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import { schema } from "./schema";

export interface MentionState {
	active: boolean;
	query: string;
	range: FromTo;
}

interface MentionOption {
	handle: string;
	did?: string;
}

const MOCK_HANDLES: MentionOption[] = [
	{ handle: "alice.test" },
	{ handle: "bob.test" },
	{ handle: "charlie.test" },
	{ handle: "dana.example" },
	{ handle: "eve.example" },
];

function filterHandles(query: string): MentionOption[] {
	if (!query) return MOCK_HANDLES.slice(0, 5);
	const lower = query.toLowerCase();
	return MOCK_HANDLES.filter((h) =>
		h.handle.toLowerCase().includes(lower),
	).slice(0, 5);
}

interface MentionPluginCallbacks {
	onStateChange: (state: MentionState | null) => void;
	getSelectedIndex: () => number;
	getOptions: () => MentionOption[];
}

export function createMentionPlugin(
	callbacks: MentionPluginCallbacks,
): Plugin[] {
	return autocomplete({
		triggers: [{ name: "mention", trigger: "@" }],
		reducer: (action: AutocompleteAction) => {
			switch (action.kind) {
				case ActionKind.open:
					callbacks.onStateChange({
						active: true,
						query: action.filter || "",
						range: action.range,
					});
					return true;

				case ActionKind.filter: {
					const query = action.filter || "";
					// Close on space - handles don't have spaces
					if (query.includes(" ")) {
						closeAutocomplete(action.view);
						return true;
					}
					callbacks.onStateChange({
						active: true,
						query,
						range: action.range,
					});
					return true;
				}

				case ActionKind.up:
				case ActionKind.down:
					// Let the React component handle arrow keys via document listener
					return false;

				case ActionKind.enter: {
					const options = callbacks.getOptions();
					const selectedIndex = callbacks.getSelectedIndex();
					const selected = options[selectedIndex];

					if (selected) {
						insertMention(action.view, action.range, selected);
						callbacks.onStateChange(null);
						return true;
					}
					return false;
				}

				case ActionKind.close:
					callbacks.onStateChange(null);
					return true;

				default:
					return false;
			}
		},
	});
}

function insertMention(
	view: EditorView,
	range: FromTo,
	option: MentionOption,
): void {
	const mentionNode = schema.nodes.mention.create({
		handle: option.handle,
		did: option.did || null,
	});

	const tr = view.state.tr
		.delete(range.from, range.to)
		.insert(range.from, mentionNode)
		.insertText(" ", range.from + 1);

	view.dispatch(tr);
	view.focus();
}

interface MentionPopupProps {
	view: EditorView;
	state: MentionState;
	selectedIndex: number;
	onSelectIndex: (index: number) => void;
	onSelect: (option: MentionOption) => void;
	onClose: () => void;
	containerRef: RefObject<HTMLDivElement | null>;
}

export function MentionPopup({
	view,
	state,
	selectedIndex,
	onSelectIndex,
	onSelect,
	onClose,
	containerRef,
}: MentionPopupProps) {
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});

	const options = filterHandles(state.query);

	// Position the popup relative to the container
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		try {
			const coords = view.coordsAtPos(state.range.from);
			const containerRect = container.getBoundingClientRect();
			setPosition({
				top: coords.bottom - containerRect.top + 4,
				left: coords.left - containerRect.left,
			});
		} catch {
			// Position might be invalid during rapid typing
		}
	}, [view, state.range.from, containerRef]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					e.stopPropagation();
					onSelectIndex(Math.min(selectedIndex + 1, options.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					e.stopPropagation();
					onSelectIndex(Math.max(selectedIndex - 1, 0));
					break;
				case "Enter":
				case "Tab":
					if (options[selectedIndex]) {
						e.preventDefault();
						e.stopPropagation();
						onSelect(options[selectedIndex]);
					}
					break;
				case "Escape":
					e.preventDefault();
					e.stopPropagation();
					onClose();
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [options, selectedIndex, onSelectIndex, onSelect, onClose]);

	return (
		<div
			className="absolute z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg py-1 w-56"
			style={{ top: position.top, left: position.left }}
			role="listbox"
		>
			{options.length === 0 ? (
				<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
					No matches
				</div>
			) : (
				options.map((option, i) => (
					<button
						key={option.handle}
						type="button"
						role="option"
						aria-selected={i === selectedIndex}
						className={`w-full px-3 py-2 text-left text-sm ${
							i === selectedIndex
								? "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100"
								: "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
						}`}
						onMouseEnter={() => onSelectIndex(i)}
						onMouseDown={(e) => {
							e.preventDefault(); // Prevent blur
							onSelect(option);
						}}
					>
						<span className="truncate">@{option.handle}</span>
					</button>
				))
			)}
		</div>
	);
}

export { filterHandles, type MentionOption };
