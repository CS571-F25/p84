import {
	type DefaultError,
	type QueryKey,
	type UseQueryOptions,
	useQuery,
} from "@tanstack/react-query";
import type { FromTo } from "prosemirror-autocomplete";
import type { EditorView } from "prosemirror-view";
import type { ReactNode, RefObject } from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useDebounce } from "@/lib/useDebounce";

export interface AutocompleteState {
	active: boolean;
	query: string;
	range: FromTo;
}

export interface AutocompleteCallbacks<T> {
	onStateChange: (state: AutocompleteState | null) => void;
	getSelectedIndex: () => number;
	getOptions: () => T[];
}

export interface UseEditorAutocompleteConfig<
	T,
	TQueryFnData = unknown,
	TError = DefaultError,
	TQueryKey extends QueryKey = QueryKey,
> {
	viewRef: RefObject<EditorView | null>;
	containerRef: RefObject<HTMLElement | null>;
	getQueryOptions: (
		query: string,
	) => UseQueryOptions<TQueryFnData, TError, T[], TQueryKey>;
	minQueryLength?: number;
	debounceMs?: number;
	onSelect: (option: T, state: AutocompleteState, view: EditorView) => void;
	renderPopup: (props: {
		options: T[];
		selectedIndex: number;
		onSelectIndex: (i: number) => void;
		onSelect: (option: T) => void;
		position: { top: number; left: number };
	}) => ReactNode;
}

export interface UseEditorAutocompleteReturn<T> {
	state: AutocompleteState | null;
	callbacks: AutocompleteCallbacks<T>;
	popup: ReactNode;
}

export function useEditorAutocomplete<
	T,
	TQueryFnData = unknown,
	TError = DefaultError,
	TQueryKey extends QueryKey = QueryKey,
>({
	viewRef,
	containerRef,
	getQueryOptions,
	minQueryLength = 2,
	debounceMs = 150,
	onSelect,
	renderPopup,
}: UseEditorAutocompleteConfig<
	T,
	TQueryFnData,
	TError,
	TQueryKey
>): UseEditorAutocompleteReturn<T> {
	const [state, setState] = useState<AutocompleteState | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [position, setPosition] = useState({ top: 0, left: 0 });

	const { value: debouncedQuery } = useDebounce(state?.query || "", debounceMs);

	const { data: options = [] } = useQuery({
		...getQueryOptions(debouncedQuery),
		enabled: debouncedQuery.length >= minQueryLength,
	});

	// Refs for stable access in callbacks
	const stateRef = useRef(state);
	const selectedIndexRef = useRef(selectedIndex);
	const optionsRef = useRef(options);
	const onSelectRef = useRef(onSelect);

	stateRef.current = state;
	selectedIndexRef.current = selectedIndex;
	optionsRef.current = options;
	onSelectRef.current = onSelect;

	// Reset selection when query changes
	useEffect(() => {
		if (state?.query !== undefined) {
			setSelectedIndex(0);
		}
	}, [state?.query]);

	// Update position when state changes (useLayoutEffect to avoid flash at wrong position)
	useLayoutEffect(() => {
		const view = viewRef.current;
		const container = containerRef.current;
		if (!state || !view || !container) return;

		try {
			const coords = view.coordsAtPos(state.range.from);
			const containerRect = container.getBoundingClientRect();
			setPosition({
				top: coords.bottom - containerRect.top + 4,
				left: coords.left - containerRect.left,
			});
		} catch {
			// Position might be invalid
		}
	}, [state, viewRef, containerRef]);

	// Handle selection
	const handleSelect = useCallback(
		(option: T) => {
			const view = viewRef.current;
			const currentState = stateRef.current;
			if (!view || !currentState) return;

			onSelectRef.current(option, currentState, view);
			setState(null);
		},
		[viewRef],
	);

	// Keyboard navigation
	useEffect(() => {
		if (!state) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			const currentOptions = optionsRef.current;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					e.stopPropagation();
					setSelectedIndex((i) => Math.min(i + 1, currentOptions.length - 1));
					break;
				case "ArrowUp":
					e.preventDefault();
					e.stopPropagation();
					setSelectedIndex((i) => Math.max(i - 1, 0));
					break;
				case "Enter":
				case "Tab": {
					const selected = currentOptions[selectedIndexRef.current];
					if (selected) {
						e.preventDefault();
						e.stopPropagation();
						const view = viewRef.current;
						const currentState = stateRef.current;
						if (view && currentState) {
							onSelectRef.current(selected, currentState, view);
							setState(null);
						}
					}
					break;
				}
				case "Escape":
					e.preventDefault();
					e.stopPropagation();
					setState(null);
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [state, viewRef]);

	// Stable callbacks for plugin
	const callbacks = useRef<AutocompleteCallbacks<T>>({
		onStateChange: (s) => setState(s),
		getSelectedIndex: () => selectedIndexRef.current,
		getOptions: () => optionsRef.current,
	}).current;

	// Render popup
	const popup = state
		? renderPopup({
				options,
				selectedIndex,
				onSelectIndex: setSelectedIndex,
				onSelect: handleSelect,
				position,
			})
		: null;

	return { state, callbacks, popup };
}
