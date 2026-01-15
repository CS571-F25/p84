# Constellation API Reference

Constellation is an ATProto-wide backlink indexer that tracks links between records. It's part of the [microcosm](https://microcosm.blue/) project.

## Base URL

```
https://constellation.microcosm.blue
```

## Required Headers

```typescript
headers: {
  "Accept": "application/json",
  "User-Agent": "deckbelcher.com by @aviva.gay"
}
```

The `Accept` header is required for JSON responses. The `User-Agent` is a courtesy request from the maintainer.

## Endpoints

### Get Backlinks

Find records that link to a target.

```
GET /xrpc/blue.microcosm.links.getBacklinks
```

**Parameters:**
- `subject` (required): Target URI being linked to (e.g., `scry:uuid`, `at://did/collection/rkey`)
- `source` (required): Collection and path in format `collection:path` (e.g., `com.deckbelcher.collection.list:.items[com.deckbelcher.collection.list#cardItem].ref.scryfallUri`)
- `did` (optional, repeatable): Filter to specific user(s)
- `limit` (optional): Max results, default 16, max 100

**Response:**
```typescript
{
  total: number;
  records: Array<{
    uri: string;      // AT URI of linking record
    cid: string;      // CID of linking record
    did: string;      // DID of record owner
    indexedAt: string;
  }>;
  cursor?: string;
}
```

### Count Links

Get total count of records linking to a target.

```
GET /links/count
```

**Parameters:**
- `target` (required): Target URI (URL-encoded)
- `collection` (required): Collection NSID
- `path` (required): JSON path (URL-encoded)

**Response:**
```typescript
{ total: number }
```

### Count Distinct DIDs

Get count of unique users linking to a target.

```
GET /links/count/distinct-dids
```

Same parameters as `/links/count`.

## Path Syntax

Constellation uses JSONPath-like notation.

**IMPORTANT**: The two endpoints expect different path formats:
- `getBacklinks` source: `collection:path` where path has NO leading dot
- `/links/count` path: path WITH leading dot

Example for the same query:
- getBacklinks: `source=com.deckbelcher.collection.list:items[...].ref.oracleUri`
- count: `path=.items[...].ref.oracleUri`

### Basic Paths

```
.field                    # Direct field
.nested.field             # Nested object
.array[]                  # Array elements (no $type)
.array[].nested           # Nested in array
```

### Union Array Elements ($type)

**IMPORTANT**: When an **array element** is a union type (has `$type` field), constellation includes the type in the path:

```
.items[com.deckbelcher.collection.list#cardItem].ref.scryfallUri
```

NOT:
```
.items[].ref.scryfallUri  # WRONG for union types in arrays
```

This is because constellation's link extractor (`links/src/record.rs`) uses the `$type` value when present in array elements:

```rust
if let Some(JsonValue::String(t)) = o.get("$type") {
    format!("{path}[{t}]")  // Uses $type in path
} else {
    format!("{path}[]")     // Plain array notation
}
```

### Standalone Union Fields (NOT arrays)

For union fields that are NOT in arrays, just use the normal path without `[$type]`:

```
.subject.ref.oracleUri  # Correct for non-array union field
```

NOT:
```
.subject[some.type#variant].ref.oracleUri  # WRONG - [$type] is for arrays only
```

## DeckBelcher-Specific Paths

We use `oracleUri` for card aggregation so counts include all printings of a card.

### Cards in Collection Lists (saves/bookmarks)

```
collection: com.deckbelcher.collection.list
path: .items[com.deckbelcher.collection.list#cardItem].ref.oracleUri
target: oracle:<uuid>
```

### Decks in Collection Lists

```
collection: com.deckbelcher.collection.list
path: .items[com.deckbelcher.collection.list#deckItem].deckUri
target: at://<did>/com.deckbelcher.deck.list/<rkey>
```

### Cards in Deck Lists (future: "decks containing")

```
collection: com.deckbelcher.deck.list
path: .cards[].ref.oracleUri
target: oracle:<uuid>
```

Note: `deck.list` cards don't have `$type`, so use `[]`.

## Example Queries

Check if a user saved a card (by oracle ID):
```bash
curl -H "Accept: application/json" \
  "https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?\
subject=oracle:1a62ba93-153c-4bed-9f6a-ff914df360c1&\
source=com.deckbelcher.collection.list:.items[com.deckbelcher.collection.list%23cardItem].ref.oracleUri&\
did=did:plc:xyz&\
limit=1"
```

Count total saves (by oracle ID):
```bash
curl -H "Accept: application/json" \
  "https://constellation.microcosm.blue/links/count?\
target=oracle:1a62ba93-153c-4bed-9f6a-ff914df360c1&\
collection=com.deckbelcher.collection.list&\
path=.items[com.deckbelcher.collection.list%23cardItem].ref.oracleUri"
```

## Source Code

- Repository: [at-microcosm/microcosm-rs](https://github.com/at-microcosm/microcosm-rs/tree/main/constellation)
- Link extraction logic: `links/src/record.rs`

## Latency Considerations

Constellation indexes records from the ATProto firehose. There may be a delay between when a record is written to a PDS and when constellation has indexed it. For optimistic UI updates, trust the PDS write succeeded rather than immediately re-querying constellation.
