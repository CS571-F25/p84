# Custom React Hooks

This project includes several custom hooks with non-trivial behavior. Understanding these is critical for maintaining and extending the codebase.

## usePersistedState

**Location**: `src/lib/usePersistedState.ts`

SSR-safe localStorage hook with cross-tab synchronization.

**Key behaviors:**
- Server render: Always uses `defaultValue` (no localStorage access)
- Client hydration: Initially uses `defaultValue` to match server HTML
- After mount: Reads from localStorage and updates if different
- Cross-tab sync via `storage` event listener

**Constraints:**
- Key must be prefixed with `deckbelcher:` (enforced by type)
- Value cannot be `null` (used internally to detect missing keys)

**Custom serialization:**
```typescript
const [tags, setTags] = usePersistedState(
  "deckbelcher:tags",
  new Map<string, number>(),
  {
    serialize: (map) => JSON.stringify(Array.from(map.entries())),
    deserialize: (str) => new Map(JSON.parse(str)),
  }
);
```

## useMutationWithToast

**Location**: `src/lib/useMutationWithToast.ts`

Wrapper around TanStack Query's `useMutation` that automatically shows error toasts via Sonner.

**Use this for all mutations** to ensure consistent error handling across the app.

**Options:**
- `errorMessage`: String or function `(error) => string` for custom error messages
- All other `useMutation` options pass through

```typescript
const mutation = useMutationWithToast({
  mutationFn: updateDeck,
  errorMessage: (err) => `Failed to save: ${err.message}`,
  onSuccess: () => navigate("/decks"),
});
```

## useSeededRandom

**Location**: `src/lib/useSeededRandom.tsx`

SSR-safe seeded PRNG that maintains consistent randomization across server render and hydration.

**How it works:**
1. On SSR: Generates random seed, embeds it in a hidden `<span data-seed="...">`
2. On hydration: Reads seed from DOM element
3. On client-only: Generates fresh seed

**Usage:**
```tsx
function ShuffledCards({ cards }) {
  const { rng, SeedEmbed } = useSeededRandom();
  const shuffled = seededShuffle(cards, rng);

  return (
    <>
      <SeedEmbed />  {/* Must render this! */}
      {shuffled.map(card => <Card key={card.id} {...card} />)}
    </>
  );
}
```

**Exports:**
- `useSeededRandom()` - Hook returning `{ seed, rng, SeedEmbed }`
- `createSeededRng(stateRef)` - Create RNG from mutable ref (mulberry32)
- `seededShuffle(array, rng)` - Fisher-Yates shuffle with provided RNG

## useWorkerStatus

**Location**: `src/lib/useWorkerStatus.ts`

Tracks Web Worker initialization for visual indication only.

**Important:** DO NOT use this as a gate for queries. Always check `query.isLoading` and `query.data` in components that depend on card data.

```typescript
const { isLoaded } = useWorkerStatus();
// Use for showing loading spinner in header, NOT for gating data access
```

The underlying `initializeWorker()` is idempotent—safe to call multiple times.

## useDebounce

**Location**: `src/lib/useDebounce.ts`

Standard debounce hook. Value updates are delayed by specified milliseconds.

```typescript
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);
```

## useCommonTags

**Location**: `src/lib/useCommonTags.ts`

Extracts the N most common tags from a deck's cards with stable memoization.

```typescript
const commonTags = useCommonTags(deck.cards, 10);
// Returns: ["ramp", "removal", "draw", ...]
```

## useAuth

**Location**: `src/lib/useAuth.tsx`

OAuth context hook for accessing session state and ATProto agent.

```typescript
const { session, agent, isLoading } = useAuth();
if (session) {
  // User is authenticated, agent is available
}
```

## useDeckStats

**Location**: `src/lib/useDeckStats.ts`

Aggregates deck statistics (mana curve, type distribution, land speeds) using TanStack Query.

Returns memoized stats that update when deck cards change.

## useTheme

**Location**: `src/lib/useTheme.tsx`

Theme context hook. Uses `usePersistedState` under the hood.

```typescript
const { theme, setTheme, resolvedTheme } = useTheme();
// theme: "light" | "dark" | "system"
// resolvedTheme: "light" | "dark" (actual applied theme)
```
