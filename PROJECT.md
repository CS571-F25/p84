# DeckBelcher Project Overview

## Core Concept

Magic: The Gathering decklist tool built on AT Protocol, differentiating from Moxfield/Archidekt through genuine social features and ATProto data portability rather than bolted-on comments.

## Domain & Namespace

- **Domain**: deckbelcher.com
- **Namespace**: com.deckbelcher.*

## Lexicon Structure

### com.deckbelcher.actor.profile
User profile for DeckBelcher. Fields:
- `displayName` - User's display name
- `description` - Bio/description text
- `pronouns` - User pronouns
- `createdAt` - Account creation timestamp

Future additions may include featured decklist/card.

### com.deckbelcher.list (planned)
Main decklist record:
```typescript
{
  cards: [{
    scryfallId: string,  // per-printing ID
    quantity: number,
    section: "mainboard" | "sideboard" | "maybeboard",
    tags: string[]  // user metadata like "removal", "wincon"
  }],
  primer: string,  // inline, use atproto facets for rich text/card mentions
  tags: string[]   // global list tags like "competitive", "budget"
}
```

**Key decisions:**
- Scryfall ID is per-printing (handles multiple printings naturally)
- `section` as structured field, not special tags (easier queries)
- Primer inline in record, NOT separate (avoid complexity, <50kb even with novel)
- Facets over markdown for rich text (can link cards with Scryfall IDs)
- No explicit order field - arrays preserve order, sorts are UI concern

### com.deckbelcher.reply (planned)
Replies to lists/cards/tags:
```typescript
{
  target: {
    type: "card" | "tag" | "list",
    scryfallId?: string,  // if type=card
    tagName?: string,     // if type=tag
    listUri: string       // always include
  },
  text: string,
  // ... standard reply fields
}
```

Replies to removed cards still exist, just surface them lower (below maybeboard). Include CID in target if you want "this was about an old version" support.

### com.deckbelcher.like (planned)
Likes for lists.

## Target Formats

**Priority:**
- Commander (primary)
- Cube (high value - curators love discussing every card choice)
- Pauper/PDH

**Skip:** Standard, Vintage

## Technical Architecture

### Frontend
- Load Scryfall JSON dump (~100MB, gzips well) for instant search/typeahead
- No network latency for adding cards = huge UX win
- Can lazy load by set if needed but probably unnecessary

### Backend
- Constellation indexes social records (likes, replies)
- Use existing Bluesky social graph for follows/discoverability
- Basic PDS for hosting records

### Version History
**SKIP FOR V1:**
- ATProto repos don't keep history by default
- Mutate records in place when edited
- If needed later, Constellation can index CID changes from firehose
- Verdverm pattern ($orig + $hist array) is too complex for v1
- Client-side undo with localStorage if you want it, but not critical

## What Makes This Better Than Moxfield

1. **Reply-to-specific-cards** - Threaded discussions on individual card choices, portable across ATProto
2. **ATProto portability** - Your decklists aren't locked in
3. **Bluesky social graph** - Friends are already there if they're on Bsky
4. **Actually social** - Not afterthought comments

## Target Audience

- Commander/Cube brewers who want feedback
- Content creators doing primers
- Bluesky-native crowd who cares about data ownership

## Explicitly Out of Scope for V1

- Version history / change tracking
- Default view settings for lists
- Auto-tagging via ML (cool idea with Scryfall otags as training data, but ship without it first)
- Undo/redo (maybe client-side later)

## Lexicon Scoping Patterns

Reference from ecosystem research:
- Bluesky uses `app.bsky.actor.profile` with `actor` scope
- Many indie lexicons skip scoping (e.g., `app.popsky.profile`)
- Teal.fm (respected devs) uses `fm.teal.alpha.actor.profile` with `actor` scope

**Decision:** Use `com.deckbelcher.actor.profile` following Bluesky/Teal.fm pattern for consistency.
