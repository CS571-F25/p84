import autocomplete, {
	ActionKind,
	type AutocompleteAction,
	closeAutocomplete,
} from "prosemirror-autocomplete";
import type { Plugin } from "prosemirror-state";
import type { OracleId, ScryfallId } from "@/lib/scryfall-types";
import type { AutocompleteCallbacks } from "./useEditorAutocomplete";

export interface MentionOption {
	handle: string;
	did: string;
}

export interface CardOption {
	name: string;
	scryfallId: ScryfallId;
	oracleId: OracleId;
}

export interface TagOption {
	tag: string;
}

export type CombinedOption = MentionOption | CardOption | TagOption;
export type AutocompleteType = "mention" | "card" | "tag";

export interface CombinedCallbacks {
	mention: AutocompleteCallbacks<MentionOption>;
	card: AutocompleteCallbacks<CardOption>;
	tag: AutocompleteCallbacks<TagOption>;
}

export function createCombinedAutocompletePlugin(
	callbacks: CombinedCallbacks,
): Plugin[] {
	return autocomplete({
		triggers: [
			{ name: "mention", trigger: "@" },
			{ name: "card", trigger: "[[" },
			{ name: "tag", trigger: "#" },
		],
		reducer: (action: AutocompleteAction) => {
			// Determine trigger type from action.type, or fall back to trigger string
			// (openAutocomplete sets type: null, so we need this fallback)
			const triggerName: AutocompleteType | undefined =
				(action.type?.name as AutocompleteType) ||
				(action.trigger === "[["
					? "card"
					: action.trigger === "@"
						? "mention"
						: action.trigger === "#"
							? "tag"
							: undefined);

			switch (action.kind) {
				case ActionKind.open: {
					const cb =
						triggerName === "card"
							? callbacks.card
							: triggerName === "tag"
								? callbacks.tag
								: callbacks.mention;
					cb.onStateChange({
						active: true,
						query: action.filter || "",
						range: action.range,
					});
					return true;
				}

				case ActionKind.filter: {
					const query = action.filter || "";

					if (triggerName === "mention") {
						if (query.includes(" ")) {
							closeAutocomplete(action.view);
							return true;
						}
						callbacks.mention.onStateChange({
							active: true,
							query,
							range: action.range,
						});
					} else if (triggerName === "card") {
						if (query.includes("]]")) {
							closeAutocomplete(action.view);
							return true;
						}
						callbacks.card.onStateChange({
							active: true,
							query,
							range: action.range,
						});
					} else if (triggerName === "tag") {
						// Tags can have spaces, no early close
						callbacks.tag.onStateChange({
							active: true,
							query,
							range: action.range,
						});
					}
					return true;
				}

				case ActionKind.up:
				case ActionKind.down:
					return false;

				case ActionKind.enter:
					return false;

				case ActionKind.close: {
					callbacks.mention.onStateChange(null);
					callbacks.card.onStateChange(null);
					callbacks.tag.onStateChange(null);
					return true;
				}

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

interface CardPopupContentProps {
	options: CardOption[];
	selectedIndex: number;
	onSelectIndex: (i: number) => void;
	onSelect: (option: CardOption) => void;
	position: { top: number; left: number };
}

export function CardPopupContent({
	options,
	selectedIndex,
	onSelectIndex,
	onSelect,
	position,
}: CardPopupContentProps) {
	return (
		<div
			className="absolute z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg py-1 w-64 max-h-64 overflow-y-auto"
			style={{ top: position.top, left: position.left }}
			role="listbox"
		>
			{options.length === 0 ? (
				<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
					No cards found
				</div>
			) : (
				options.map((option, i) => (
					<button
						key={option.scryfallId}
						type="button"
						role="option"
						aria-selected={i === selectedIndex}
						className={`w-full px-3 py-2 text-left text-sm ${
							i === selectedIndex
								? "bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100"
								: "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
						}`}
						onMouseEnter={() => onSelectIndex(i)}
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(option);
						}}
					>
						<span className="truncate">{option.name}</span>
					</button>
				))
			)}
		</div>
	);
}

interface TagPopupContentProps {
	options: TagOption[];
	selectedIndex: number;
	onSelectIndex: (i: number) => void;
	onSelect: (option: TagOption) => void;
	position: { top: number; left: number };
}

export function TagPopupContent({
	options,
	selectedIndex,
	onSelectIndex,
	onSelect,
	position,
}: TagPopupContentProps) {
	return (
		<div
			className="absolute z-50 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-lg py-1 w-56 max-h-64 overflow-y-auto"
			style={{ top: position.top, left: position.left }}
			role="listbox"
		>
			{options.length === 0 ? (
				<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
					No tags found
				</div>
			) : (
				options.map((option, i) => (
					<button
						key={option.tag}
						type="button"
						role="option"
						aria-selected={i === selectedIndex}
						className={`w-full px-3 py-2 text-left text-sm ${
							i === selectedIndex
								? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100"
								: "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
						}`}
						onMouseEnter={() => onSelectIndex(i)}
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(option);
						}}
					>
						<span className="truncate">#{option.tag}</span>
					</button>
				))
			)}
		</div>
	);
}
