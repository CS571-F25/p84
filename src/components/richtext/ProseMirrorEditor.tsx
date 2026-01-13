import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import {
	liftListItem,
	sinkListItem,
	splitListItem,
} from "prosemirror-schema-list";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type ActorSearchResult,
	searchActorsQueryOptions,
} from "@/lib/actor-search";
import { buildInputRules } from "./inputRules";
import {
	createMentionPlugin,
	type MentionOption,
	MentionPopupContent,
} from "./MentionAutocomplete";
import { createUpdatePlugin } from "./plugins";
import { schema } from "./schema";
import { Toolbar } from "./Toolbar";
import { useEditorAutocomplete } from "./useEditorAutocomplete";

export interface ProseMirrorEditorProps {
	defaultValue?: ProseMirrorNode;
	onChange?: (doc: ProseMirrorNode) => void;
	placeholder?: string;
	className?: string;
	showToolbar?: boolean;
}

export function ProseMirrorEditor({
	defaultValue,
	onChange,
	placeholder = "Write something...",
	className,
	showToolbar = true,
}: ProseMirrorEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	// Force toolbar re-render on selection/state changes
	const [, setUpdateCounter] = useState(0);
	const forceUpdate = useCallback(() => setUpdateCounter((c) => c + 1), []);

	// Capture initial values - don't recreate editor on prop changes
	const initialDocRef = useRef(defaultValue);
	const initialPlaceholderRef = useRef(placeholder);
	const wrapperRef = useRef<HTMLDivElement>(null);

	// Mention autocomplete
	const handleMentionSelect = useCallback(
		(
			option: MentionOption,
			state: { range: { from: number; to: number } },
			view: EditorView,
		) => {
			const mentionNode = schema.nodes.mention.create({
				handle: option.handle,
				did: option.did,
			});

			const tr = view.state.tr
				.delete(state.range.from, state.range.to)
				.insert(state.range.from, mentionNode)
				.insertText(" ", state.range.from + 1);

			view.dispatch(tr);
			view.focus();
		},
		[],
	);

	const getMentionQueryOptions = useCallback(
		(query: string) => ({
			...searchActorsQueryOptions(query),
			select: (actors: ActorSearchResult[]): MentionOption[] =>
				actors.map((a) => ({ handle: a.handle, did: a.did })),
		}),
		[],
	);

	const mention = useEditorAutocomplete({
		viewRef,
		containerRef: wrapperRef,
		getQueryOptions: getMentionQueryOptions,
		onSelect: handleMentionSelect,
		renderPopup: (props) => <MentionPopupContent {...props} />,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: editor created once on mount
	useEffect(() => {
		if (!containerRef.current) return;

		const state = EditorState.create({
			doc:
				initialDocRef.current ??
				schema.node("doc", null, [schema.node("paragraph")]),
			schema,
			plugins: [
				...createMentionPlugin(mention.callbacks),
				buildInputRules(schema),
				history(),
				keymap({
					"Mod-z": undo,
					"Mod-Shift-z": redo,
					"Mod-y": redo,
					"Mod-b": toggleMark(schema.marks.strong),
					"Mod-i": toggleMark(schema.marks.em),
					"Mod-`": toggleMark(schema.marks.code),
				}),
				// List keybindings - must come before baseKeymap
				keymap({
					Enter: splitListItem(schema.nodes.list_item),
					Tab: sinkListItem(schema.nodes.list_item),
					"Shift-Tab": liftListItem(schema.nodes.list_item),
				}),
				keymap(baseKeymap),
				// Trigger React re-render on state changes for toolbar updates
				createUpdatePlugin(forceUpdate),
			],
		});

		const view = new EditorView(containerRef.current, {
			state,
			dispatchTransaction(tr) {
				const newState = view.state.apply(tr);
				view.updateState(newState);
				if (tr.docChanged) {
					onChangeRef.current?.(newState.doc);
				}
			},
			attributes: {
				class:
					"focus:outline-none min-h-[8rem] p-3 text-gray-900 dark:text-gray-100",
				"data-placeholder": initialPlaceholderRef.current,
			},
		});

		viewRef.current = view;

		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	return (
		<div ref={wrapperRef} className={`relative ${className ?? ""}`}>
			<div className="prosemirror-editor border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
				{showToolbar && <Toolbar view={viewRef.current} />}
				<div ref={containerRef} />
			</div>
			{mention.popup}
		</div>
	);
}
