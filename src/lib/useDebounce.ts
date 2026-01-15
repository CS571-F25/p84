import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseDebounceResult<T> {
	value: T;
	flush: () => T;
	isPending: boolean;
}

/**
 * When skipInitial is true, the debounced value starts as undefined and only
 * gets set after the debounce timer fires. Useful when you want to skip work
 * on initial render entirely.
 */
export function useDebounce<T>(
	value: T,
	delay: number,
	options: { skipInitial: true },
): UseDebounceResult<T | undefined>;
export function useDebounce<T>(
	value: T,
	delay: number,
	options?: { skipInitial?: false },
): UseDebounceResult<T>;
export function useDebounce<T>(
	value: T,
	delay: number,
	options?: { skipInitial?: boolean },
): UseDebounceResult<T | undefined> {
	const skipInitial = options?.skipInitial ?? false;
	const [debouncedValue, setDebouncedValue] = useState<T | undefined>(
		skipInitial ? undefined : value,
	);
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

export interface UseThrottleResult<T> {
	value: T;
	flush: () => T;
	isPending: boolean;
}

/**
 * Throttle: emits value at most once per `interval` ms.
 * Unlike debounce, this guarantees periodic updates during continuous input.
 */
export function useThrottle<T>(
	value: T,
	interval: number,
): UseThrottleResult<T> {
	const [throttledValue, setThrottledValue] = useState<T>(value);
	const lastEmitRef = useRef<number>(Date.now());
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestValueRef = useRef(value);

	latestValueRef.current = value;

	const isPending = value !== throttledValue;

	const flush = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setThrottledValue(latestValueRef.current);
		lastEmitRef.current = Date.now();
		return latestValueRef.current;
	}, []);

	useEffect(() => {
		const now = Date.now();
		const elapsed = now - lastEmitRef.current;

		if (elapsed >= interval) {
			setThrottledValue(value);
			lastEmitRef.current = now;
		} else {
			// Schedule emit for remaining time
			timeoutRef.current = setTimeout(() => {
				setThrottledValue(latestValueRef.current);
				lastEmitRef.current = Date.now();
				timeoutRef.current = null;
			}, interval - elapsed);
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [value, interval]);

	return { value: throttledValue, flush, isPending };
}

export interface ImperativeThrottle<T> {
	/** Call with new value - will emit on throttle boundary */
	update: (value: T) => void;
	/** Force emit current value immediately */
	flush: () => void;
	/** Get current throttled value */
	getValue: () => T;
}

/**
 * Imperative throttle: call update() on every input, emits via callback at most once per interval.
 * Unlike the hook version, this doesn't require state as input - you control when to call update().
 */
export function useImperativeThrottle<T>(
	initialValue: T,
	interval: number,
	onEmit: (value: T) => void,
): ImperativeThrottle<T> {
	const latestValueRef = useRef(initialValue);
	const emittedValueRef = useRef(initialValue);
	const lastEmitRef = useRef<number>(0);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onEmitRef = useRef(onEmit);

	onEmitRef.current = onEmit;

	return useMemo(() => {
		const emit = () => {
			const value = latestValueRef.current;
			if (value !== emittedValueRef.current) {
				emittedValueRef.current = value;
				onEmitRef.current(value);
			}
			lastEmitRef.current = Date.now();
		};

		return {
			update: (value: T) => {
				latestValueRef.current = value;

				const now = Date.now();
				const elapsed = now - lastEmitRef.current;

				if (elapsed >= interval) {
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
						timeoutRef.current = null;
					}
					emit();
				} else if (!timeoutRef.current) {
					timeoutRef.current = setTimeout(() => {
						timeoutRef.current = null;
						emit();
					}, interval - elapsed);
				}
			},
			flush: () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
				emit();
			},
			getValue: () => latestValueRef.current,
		};
	}, [interval]);
}

export interface ImperativeDebounce<T> {
	/** Call with new value - will emit after delay of inactivity */
	update: (value: T) => void;
	/** Force emit current value immediately */
	flush: () => void;
	/** Get current value */
	getValue: () => T;
}

/**
 * Imperative debounce: call update() on every input, emits via callback after delay of inactivity.
 */
export function useImperativeDebounce<T>(
	initialValue: T,
	delay: number,
	onEmit: (value: T) => void,
): ImperativeDebounce<T> {
	const latestValueRef = useRef(initialValue);
	const emittedValueRef = useRef(initialValue);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onEmitRef = useRef(onEmit);

	onEmitRef.current = onEmit;

	return useMemo(() => {
		const emit = () => {
			const value = latestValueRef.current;
			if (value !== emittedValueRef.current) {
				emittedValueRef.current = value;
				onEmitRef.current(value);
			}
		};

		return {
			update: (value: T) => {
				latestValueRef.current = value;

				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}
				timeoutRef.current = setTimeout(() => {
					timeoutRef.current = null;
					emit();
				}, delay);
			},
			flush: () => {
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
					timeoutRef.current = null;
				}
				emit();
			},
			getValue: () => latestValueRef.current,
		};
	}, [delay]);
}
