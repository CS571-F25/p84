# Card Data Architecture

The app loads the full Scryfall card database for instant client-side search. This document explains the data pipeline and provider architecture.

## Overview

```
Scryfall Bulk Data (~300MB compressed)
       ↓
download-scryfall.ts (build time)
       ↓
┌─────────────────────────────────────────┐
│  public/data/                           │
│  ├── cards/                             │
│  │   └── cards-NNN-HASH.json (~5MB ea)  │  (4096 cards per chunk)
│  ├── cards-byteindex.bin                │  (byte-range index for SSR)
│  ├── migrations.json                    │  (oracle ID mappings)
│  └── version.json                       │  (data version)
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│  CardDataProvider (isomorphic)          │
│  ├── ClientCardProvider (Web Worker)    │
│  └── ServerCardProvider (byte-range)    │
└─────────────────────────────────────────┘
```

## Data Pipeline (`scripts/download-scryfall.ts`)

Run with `npm run download:scryfall` (not part of normal build).

**What it does:**
1. Downloads Scryfall bulk data (`default_cards.json`)
2. Filters to kept fields (see `src/lib/scryfall-types.ts`)
3. Sorts by release date (oldest first) so new cards append to later chunks
4. Chunks cards into files of 4096 cards each (~5MB per chunk)
5. Generates byte-range index (`cards-byteindex.bin`) for SSR lookups
6. Creates oracle ID migration mappings
7. Downloads mana symbol SVGs to `public/symbols/`

**Chunk naming:** `cards-NNN-HASH.json` where NNN is chunk index and HASH is content hash for cache busting.

**Offline mode:** `--offline` flag reprocesses cached data without re-downloading.

## Provider Architecture

### `CardDataProvider` Interface

Located in `src/lib/card-data-provider.ts`. Unified interface for both environments.

```typescript
interface CardDataProvider {
  getCardById(id: ScryfallId): Promise<Card | undefined>;
  getPrintingsByOracleId(oracleId: OracleId): Promise<ScryfallId[]>;
  getCanonicalPrinting(oracleId: OracleId): Promise<ScryfallId | undefined>;
  getMetadata(): Promise<{ version: string; cardCount: number }>;
  getVolatileData(id: ScryfallId): Promise<VolatileData | null>;

  // Optional - client-only
  searchCards?(query, restrictions?, maxResults?): Promise<Card[]>;
  syntaxSearch?(query, maxResults?): Promise<Result<Card[]>>;
  unifiedSearch?(query, restrictions?, maxResults?): Promise<UnifiedSearchResult>;
}
```

### `getCardDataProvider()`

Isomorphic function (TanStack Start `createIsomorphicFn`):
- **Client:** Returns `ClientCardProvider`
- **Server:** Returns `ServerCardProvider`

Provider is singleton—safe to call multiple times.

### ClientCardProvider (`src/lib/cards-client-provider.ts`)

Uses Web Worker to load and search full card dataset off main thread.

**Worker selection:**
- Desktop: SharedWorker (shared across tabs, single memory footprint)
- Mobile/unsupported: Regular Worker (per-tab, falls back gracefully)
- Dev mode (`import.meta.env.DEV`): Regular Worker only (SharedWorker HMR issues)

**Initialization:**
1. Worker loads all card chunks in parallel
2. Builds in-memory indexes (by ID, by oracle ID)
3. Volatile data loaded lazily on first access

**Communication:** Uses Comlink for RPC-style calls to worker.

### ServerCardProvider (`src/lib/cards-server-provider.ts`)

Optimized for SSR—doesn't load full dataset into memory.

**Byte-range index (`cards-byteindex.bin`):**
- 25 bytes per record: 16 (UUID) + 1 (chunk index) + 4 (offset) + 4 (length)
- Sorted by card ID for binary search
- Slice only needed bytes from chunk file

**Cloudflare Workers:** Uses `env.ASSETS` for file access when deployed.

## Worker Architecture (`src/workers/cards.worker.ts`)

The worker handles:
- Loading chunked card data
- Building search indexes
- Fuzzy search (MiniSearch)
- Syntax search (parser + matcher)
- Volatile data loading

**Key exports (via Comlink):**
```typescript
{
  getCardById(id): Card | undefined;
  searchCards(query, restrictions?, maxResults?): Card[];
  syntaxSearch(query, maxResults?): Result<Card[]>;
  unifiedSearch(query, restrictions?, maxResults?): UnifiedSearchResult;
  // ... etc
}
```

## Multi-Face Cards

Located in `src/lib/card-faces.ts`. Handles transform, MDFC, split, flip, adventure, meld cards.

**Layout categories:**
- `MODAL_LAYOUTS` - Both faces castable (MDFC, split, adventure)
- `TRANSFORM_IN_PLAY_LAYOUTS` - Only front castable (transform, flip, meld)
- `HAS_BACK_IMAGE_LAYOUTS` - Back face has distinct image

**Key functions:**
- `getCastableFaces(card)` - Returns faces that can be cast from hand
- `getManaCostForFace(face)` - Parses mana cost to value
- `parseManaValue(cost)` - Handles X, hybrid, phyrexian symbols

## Data Types

See `src/lib/scryfall-types.ts` for full type definitions.

**Branded types for safety:**
```typescript
type ScryfallId = string & { readonly __brand: "ScryfallId" };
type OracleId = string & { readonly __brand: "OracleId" };
```

**Card type:** Filtered subset of Scryfall fields. Image URIs reconstructed from ID + set to save space.

## Performance Considerations

- **Chunked loading:** Parallel chunk fetching, cards sorted oldest-first
- **SharedWorker:** Desktop tabs share memory for card data (~500MB)
- **Content-hash filenames:** Stable cache boundaries, only changed chunks invalidate
- **Byte-range SSR:** Server never loads full dataset
- **Debounced search:** Input debounced in UI, not provider

## Updating Card Data

1. Run `npm run download:scryfall`
2. Generates new files in `public/data/`
3. Updates `src/lib/card-manifest.ts` with chunk list
4. Commit the generated files (or gitignore and deploy separately)
