import { useEffect, useState } from "react";

/**
 * Storage key type - enforces "deckbelcher:" namespace prefix
 */
type DeckbelcherStorageKey = `deckbelcher:${string}`;

/**
 * Serialization options for custom types
 */
interface PersistedStateOptions<T> {
	/**
	 * Custom serializer (defaults to JSON.stringify)
	 * Useful for types like Map, Set, Date, etc.
	 */
	serialize?: (value: T) => string;

	/**
	 * Custom deserializer (defaults to JSON.parse)
	 * Useful for types like Map, Set, Date, etc.
	 */
	deserialize?: (value: string) => T;
}

/**
 * Hook for state that persists to localStorage with proper SSR handling
 *
 * SSR Behavior:
 * - Server render: Always uses defaultValue (no localStorage access)
 * - Client hydration: Initially uses defaultValue to match server HTML
 * - After mount: Reads from localStorage and updates if different
 * - This prevents hydration mismatches while still loading persisted state
 *
 * Cross-tab sync:
 * - Changes in one tab automatically sync to other tabs via storage event
 * - Only syncs when other tabs make changes (not same-tab updates)
 *
 * Type constraints:
 * - T cannot be null (we use null internally to check if key exists)
 * - Key must be prefixed with "deckbelcher:" for namespacing
 *
 * Custom serialization:
 * - Provide serialize/deserialize for non-JSON types (Map, Set, Date, etc.)
 * - Example: Map<string, number> with custom serialization to/from array
 *
 * @param key - localStorage key (must start with "deckbelcher:")
 * @param defaultValue - Default value to use on server and before localStorage loads
 * @param options - Optional custom serialize/deserialize functions
 * @returns Tuple of [value, setValue] similar to useState
 *
 * @example
 * ```tsx
 * // Simple boolean
 * const [theme, setTheme] = usePersistedState("deckbelcher:theme", "light");
 *
 * // Boolean toggle
 * const [filterEnabled, setFilterEnabled] = usePersistedState("deckbelcher:filter", true);
 *
 * // Complex type with custom serialization
 * const [tags, setTags] = usePersistedState(
 *   "deckbelcher:tags",
 *   new Map<string, number>(),
 *   {
 *     serialize: (map) => JSON.stringify(Array.from(map.entries())),
 *     deserialize: (str) => new Map(JSON.parse(str)),
 *   }
 * );
 * ```
 */
export function usePersistedState<T extends NonNullable<unknown>>(
	key: DeckbelcherStorageKey,
	defaultValue: T,
	options?: PersistedStateOptions<T>,
): [T, (value: T) => void] {
	const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
	const deserialize =
		options?.deserialize ?? ((s: string) => JSON.parse(s) as T);

	// Start with default to match server render (avoids hydration mismatch)
	const [value, setValue] = useState<T>(defaultValue);

	// Load from localStorage after mount (client-only)
	useEffect(() => {
		try {
			const stored = localStorage.getItem(key);
			if (stored !== null) {
				const parsed = deserialize(stored);
				setValue(parsed);
			}
		} catch {
			// Ignore parse/storage errors, keep default
		}
	}, [key, deserialize]);

	// Sync changes across tabs via storage event
	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === key && e.newValue !== null) {
				try {
					const parsed = deserialize(e.newValue);
					setValue(parsed);
				} catch {
					// Ignore parse errors
				}
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, [key, deserialize]);

	// Wrapped setter that persists to localStorage
	const setPersistedValue = (newValue: T) => {
		setValue(newValue);
		try {
			localStorage.setItem(key, serialize(newValue));
		} catch {
			// Ignore storage errors (quota exceeded, private mode, etc.)
		}
	};

	return [value, setPersistedValue];
}
