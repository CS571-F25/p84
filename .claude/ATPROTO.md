# ATProto Integration

DeckBelcher uses AT Protocol for decentralized data storage. Decks are stored in users' Personal Data Servers (PDS), enabling data portability.

## Architecture Overview

```
┌──────────────┐     reads      ┌─────────────────┐
│   Browser    │ ────────────── │    Slingshot    │  (cached public reads)
│              │                │  (microcosm.blue)│
│              │     writes     └─────────────────┘
│              │ ────────────── ┌─────────────────┐
│              │                │   User's PDS    │  (authenticated writes)
└──────────────┘                └─────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/atproto-client.ts` | CRUD operations for deck records |
| `src/lib/identity.ts` | Handle ↔ DID resolution |
| `src/lib/useAuth.tsx` | OAuth context and session management |
| `src/lib/lexicons/` | Generated TypeScript types from lexicons |
| `typelex/*.tsp` | TypeSpec lexicon definitions |

## Branded Types

Type safety for AT Protocol identifiers:

```typescript
// Prevents mixing up PDS URLs with regular strings
declare const PdsUrlBrand: unique symbol;
export type PdsUrl = string & { readonly [PdsUrlBrand]: typeof PdsUrlBrand };

// Prevents mixing up rkeys with other IDs
declare const RkeyBrand: unique symbol;
export type Rkey = string & { readonly [RkeyBrand]: typeof RkeyBrand };

// Usage
const pds = asPdsUrl("https://bsky.social");
const rkey = asRkey("3jxyz...");
```

## Result Pattern

All ATProto operations use `Result<T, E>` instead of throwing:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
const result = await getDeckRecord(did, rkey);
if (result.success) {
  console.log(result.data.value.name);
} else {
  console.error(result.error.message);
}
```

## CRUD Operations

### Reading (via Slingshot)

Slingshot is a caching xRPC proxy. Public reads go through it for performance.

```typescript
import { getDeckRecord } from "@/lib/atproto-client";

const result = await getDeckRecord(did, rkey);
// Fetches: https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord
```

### Writing (via PDS)

Writes require authentication and go directly to user's PDS.

```typescript
import { createDeckRecord, updateDeckRecord, deleteDeckRecord } from "@/lib/atproto-client";

// Create
const result = await createDeckRecord(agent, {
  name: "My Deck",
  format: "commander",
  cards: [...],
  createdAt: new Date().toISOString(),
});

// Update
await updateDeckRecord(agent, rkey, updatedRecord);

// Delete
await deleteDeckRecord(agent, rkey);
```

### Listing User's Decks

```typescript
import { listUserDecks } from "@/lib/atproto-client";

const result = await listUserDecks(pdsUrl, did);
// Returns: { records: DeckRecordResponse[], cursor?: string }
```

## Identity Resolution

Located in `src/lib/identity.ts`.

```typescript
import { resolveHandle, resolveDid, getPdsUrl } from "@/lib/identity";

// Handle → DID
const did = await resolveHandle("alice.bsky.social");
// did:plc:abc123...

// DID → Handle (from DID document)
const handle = await resolveHandleFromDid(did);

// DID → PDS URL
const pds = await getPdsUrl(did);
// https://bsky.social
```

## OAuth Flow

Uses `@atcute/oauth-browser-client` for browser-based OAuth.

**Setup:** OAuth metadata is configured in `public/client-metadata.json` and injected via Vite plugin.

**Flow:**
1. User enters handle
2. Redirect to PDS authorization endpoint
3. Callback to `/oauth/callback`
4. Store session in `useAuth` context

**Environment variables:**
- `VITE_OAUTH_CLIENT_ID` - OAuth client ID (injected by vite plugin)
- `VITE_OAUTH_REDIRECT_URI` - Callback URL
- `VITE_OAUTH_SCOPE` - Requested scopes

## Lexicons

Lexicons define the schema for deck records. See `.claude/TYPELEX.md` for TypeSpec syntax.

**Current lexicons:**
- `com.deckbelcher.actor.profile` - User profile
- `com.deckbelcher.deck.list` - Deck/decklist record
- `com.deckbelcher.social.like` - Likes on decks
- `com.deckbelcher.richtext.facet` - Rich text facets (card mentions)

**Generating types:**
```bash
npm run lexicons:all  # TypeSpec → JSON → TypeScript types + OAuth scopes
```

## Query Integration

TanStack Query hooks for deck operations:

```typescript
// src/lib/deck-queries.ts

// Fetching
const { data: deck } = useQuery(getDeckQueryOptions(did, rkey));

// Creating
const createMutation = useCreateDeckMutation();
await createMutation.mutateAsync({ name, format, cards });

// Updating (optimistic)
const updateMutation = useUpdateDeckMutation();
await updateMutation.mutateAsync({ rkey, record });
```

**Debouncing:** Mutations should be debounced at call site to batch rapid changes.

## Error Handling Patterns

```typescript
// Prefer Result over try/catch
const result = await createDeckRecord(agent, record);
if (!result.success) {
  toast.error(result.error.message);
  return;
}

// Use useMutationWithToast for automatic error toasts
const mutation = useMutationWithToast({
  mutationFn: (data) => updateDeckRecord(agent, rkey, data),
  errorMessage: "Failed to save deck",
});
```

## Development Notes

- **Slingshot URL:** `https://slingshot.microcosm.blue` (hardcoded in atproto-client.ts)
- **Collection:** `com.deckbelcher.deck.list` (the NSID for deck records)
- **Record format:** See `typelex/deck.tsp` for canonical schema
