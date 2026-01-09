import {
	type RefObject,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type ParseResult, parseMarkdown } from "./richtext";
import { useImperativeDebounce, useImperativeThrottle } from "./useDebounce";

export interface UseRichTextOptions {
	initialValue?: string;
	onSave?: (parsed: ParseResult) => void | Promise<void>;
	/** How often to update preview during typing (ms) */
	previewThrottleMs?: number;
	/** How long to wait after typing stops before saving (ms) */
	saveDebounceMs?: number;
}

export interface UseRichTextResult {
	inputRef: RefObject<HTMLTextAreaElement | null>;
	onInput: () => void;
	defaultValue: string;
	parsed: ParseResult;
	isDirty: boolean;
	save: () => void;
}

export function useRichText({
	initialValue = "",
	onSave,
	previewThrottleMs = 100,
	saveDebounceMs = 1500,
}: UseRichTextOptions = {}): UseRichTextResult {
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const savedValueRef = useRef(initialValue);
	const onSaveRef = useRef(onSave);

	// State only updates on throttle/debounce boundaries, not every keystroke
	const [previewMarkdown, setPreviewMarkdown] = useState(initialValue);
	const [saveState, setSaveState] = useState<"saved" | "dirty">("saved");

	onSaveRef.current = onSave;

	// Throttle for preview (update every N ms during typing)
	const throttle = useImperativeThrottle(
		initialValue,
		previewThrottleMs,
		(value) => {
			// Low-priority update - React can interrupt for user input
			startTransition(() => {
				setPreviewMarkdown(value);
				// Mark dirty when preview updates (throttle boundary)
				if (value !== savedValueRef.current) {
					setSaveState("dirty");
				}
			});
		},
	);

	// Debounce for save (wait N ms after typing stops)
	const debounce = useImperativeDebounce(
		initialValue,
		saveDebounceMs,
		(value) => {
			if (value !== savedValueRef.current && onSaveRef.current) {
				onSaveRef.current(parseMarkdown(value));
				savedValueRef.current = value;
			}
			setSaveState("saved");
		},
	);

	const parsed = useMemo(
		() => parseMarkdown(previewMarkdown),
		[previewMarkdown],
	);

	const onInput = useCallback(() => {
		const value = inputRef.current?.value ?? "";
		throttle.update(value);
		debounce.update(value);
		// No setState here - dirty state updates on throttle boundary
	}, [throttle, debounce]);

	const save = useCallback(() => {
		throttle.flush();
		debounce.flush();
	}, [throttle, debounce]);

	// Sync with external initialValue changes (e.g., deck reload)
	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.value = initialValue;
		}
		setPreviewMarkdown(initialValue);
		savedValueRef.current = initialValue;
		setSaveState("saved");
	}, [initialValue]);

	return {
		inputRef,
		onInput,
		defaultValue: initialValue,
		parsed,
		isDirty: saveState === "dirty",
		save,
	};
}
