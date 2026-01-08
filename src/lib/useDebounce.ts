import { useCallback, useEffect, useRef, useState } from "react";

export interface UseDebounceResult<T> {
	value: T;
	flush: () => T;
	isPending: boolean;
}

export function useDebounce<T>(value: T, delay: number): UseDebounceResult<T> {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestValueRef = useRef(value);

	latestValueRef.current = value;

	const isPending = value !== debouncedValue;

	const flush = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setDebouncedValue(latestValueRef.current);
		return latestValueRef.current;
	}, []);

	useEffect(() => {
		timeoutRef.current = setTimeout(() => {
			setDebouncedValue(value);
			timeoutRef.current = null;
		}, delay);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [value, delay]);

	return { value: debouncedValue, flush, isPending };
}
