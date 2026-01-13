import autocomplete, {
	ActionKind,
	type AutocompleteAction,
	closeAutocomplete,
} from "prosemirror-autocomplete";
import type { Plugin } from "prosemirror-state";
import type { AutocompleteCallbacks } from "./useEditorAutocomplete";

export interface MentionOption {
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

export function filterHandles(query: string): MentionOption[] {
	if (!query) return MOCK_HANDLES.slice(0, 5);
	const lower = query.toLowerCase();
	return MOCK_HANDLES.filter((h) =>
		h.handle.toLowerCase().includes(lower),
	).slice(0, 5);
}

export function createMentionPlugin(
	callbacks: AutocompleteCallbacks<MentionOption>,
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
					return false;

				case ActionKind.enter:
					return false; // Let hook handle selection

				case ActionKind.close:
					callbacks.onStateChange(null);
					return true;

				default:
					return false;
			}
		},
	});
}

interface MentionPopupContentProps {
	options: MentionOption[];
	selectedIndex: number;
	onSelectIndex: (i: number) => void;
	onSelect: (option: MentionOption) => void;
	position: { top: number; left: number };
}

export function MentionPopupContent({
	options,
	selectedIndex,
	onSelectIndex,
	onSelect,
	position,
}: MentionPopupContentProps) {
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
							e.preventDefault();
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
