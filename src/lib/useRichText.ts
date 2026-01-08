import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ParseResult, parseMarkdown } from "./richtext";
import { useDebounce } from "./useDebounce";

export interface UseRichTextOptions {
	initialValue?: string;
	onSave?: (parsed: ParseResult) => void | Promise<void>;
	debounceMs?: number;
}

export interface UseRichTextResult {
	markdown: string;
	setMarkdown: (value: string) => void;
	parsed: ParseResult;
	isDirty: boolean;
	isPending: boolean; // debounce pending (keystrokes buffered)
	save: () => void;
}

export function useRichText({
	initialValue = "",
	onSave,
	debounceMs = 1500,
}: UseRichTextOptions = {}): UseRichTextResult {
	const [markdown, setMarkdownRaw] = useState(initialValue);
	const savedValueRef = useRef(initialValue);
	const onSaveRef = useRef(onSave);
	const prevDebouncedRef = useRef(initialValue);

	onSaveRef.current = onSave;

	const {
		value: debouncedMarkdown,
		flush,
		isPending,
	} = useDebounce(markdown, debounceMs);

	const parsed = useMemo(() => parseMarkdown(markdown), [markdown]);

	const isDirty = markdown !== savedValueRef.current;

	// Call onSave when debounced value changes (not on every render)
	if (debouncedMarkdown !== prevDebouncedRef.current) {
		prevDebouncedRef.current = debouncedMarkdown;
		if (debouncedMarkdown !== savedValueRef.current && onSaveRef.current) {
			onSaveRef.current(parseMarkdown(debouncedMarkdown));
			savedValueRef.current = debouncedMarkdown;
		}
	}

	const setMarkdown = useCallback((value: string) => {
		setMarkdownRaw(value);
	}, []);

	const save = useCallback(() => {
		const current = flush();
		if (current !== savedValueRef.current && onSaveRef.current) {
			onSaveRef.current(parseMarkdown(current));
			savedValueRef.current = current;
		}
	}, [flush]);

	// Sync with external initialValue changes (e.g., deck reload)
	useEffect(() => {
		setMarkdownRaw(initialValue);
		savedValueRef.current = initialValue;
		prevDebouncedRef.current = initialValue;
	}, [initialValue]);

	return {
		markdown,
		setMarkdown,
		parsed,
		isDirty,
		isPending,
		save,
	};
}
