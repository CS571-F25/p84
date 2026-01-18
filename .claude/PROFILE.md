# Profile System

DeckBelcher profiles use ATProto records with richtext bio support and DNS-based handle verification.

## Lexicon

**Collection**: `com.deckbelcher.actor.profile`
**Record key**: `"self"` (singleton per user)

```typescript
{
  bio?: com.deckbelcher.richtext.Document;  // Full multi-block richtext
  pronouns?: string;                         // Max 64 graphemes
  createdAt: string;                         // ISO datetime, required
}
```

**No displayName** - Handles can be custom domains (`@aviva.cool`), making separate display names redundant.

## Data Flow

### Fetching

```
getProfileQueryOptions(did)
  → getProfileRecord(did)
  → GET com.atproto.repo.getRecord with rkey "self"
  → Returns ProfileRecord | null
```

Missing profiles return `null` (not an error). ATProto returns HTTP 400 for `RecordNotFound`.

### Updating

```
useUpdateProfileMutation()
  → upsertProfileRecord(agent, record)
  → PUT com.atproto.repo.putRecord with rkey "self"
```

Uses upsert since rkey is always `"self"` - creates on first save, updates thereafter.

## Components

### ProfileLayout

Shared layout for profile tabs (Decks, Lists). NOT a route.tsx file - that would wrap deck editor pages too.

```
ProfileLayout
├── ProfileHeader (handle, pronouns, bio, edit button)
├── Tab navigation (Decks | Lists)
└── {children} (tab content)
```

### ProfileHeader

Displays handle with Recursive font (`'MONO' 0.5, 'CASL' 0.3`) and optional external link.

**Edit mode**: Single "Edit profile" button toggles all fields editable. Bio uses ProseMirror editor with debounced autosave (1500ms).

## Handle Links

External link button appears next to handle if the domain resolves.

### DNS Aliveness Check

Can't do HTTP requests to arbitrary domains (CORS, security). Instead, use Cloudflare DNS-over-HTTPS:

```typescript
// Query A, AAAA, CNAME records in parallel
await Promise.any([
  requireDnsRecord(handle, "A"),
  requireDnsRecord(handle, "AAAA"),
  requireDnsRecord(handle, "CNAME"),
]);
```

Each `requireDnsRecord` rejects if no records exist, so `Promise.any` resolves on first success.

**API**: `https://cloudflare-dns.com/dns-query?name={handle}&type={type}`
**Header**: `Accept: application/dns-json`

Query is prefetched during SSR (non-blocking) and cached for 10 minutes.

## Future: Profile Pictures

ATProto supports blob storage for images:

1. **Client-side compress** - Max 1MB, jpeg/png/gif
2. **Upload blob**: `com.atproto.repo.uploadBlob` → returns blob ref
3. **Store ref in profile**:
   ```typescript
   avatar?: {
     $type: "blob",
     ref: { $link: "bafyrei..." },
     mimeType: "image/jpeg",
     size: 12345
   }
   ```
4. **Serve from PDS**: `https://{pds}/xrpc/com.atproto.sync.getBlob?did={did}&cid={cid}`

Lexicon would add: `avatar?: at.Blob`
