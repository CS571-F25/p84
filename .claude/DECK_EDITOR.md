# Deck Editor Implementation Guide

## Overview

The deck editor is a Moxfield-inspired interface for building Magic: The Gathering decklists. It emphasizes:
- Fast card addition via autocomplete search
- Flexible organization (sections, tags, grouping)
- Rich visualization (preview pane, multiple view styles)
- Desktop-first with mobile support

## User Interface Layout

### Desktop Layout (Split Pane)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Deck Name]  [Format ▾]  [Search cards...]          │
├─────────────────────┬───────────────────────────────────────┤
│                     │ [View: Text ▾] [Group: Tag ▾] [Sort ▾]│
│   Card Preview      │                                        │
│   (40% width)       │ Commander (1)                          │
│                     │   └─ [Commander card]                  │
│   [Large card       │                                        │
│    image of         │ Mainboard (97)                         │
│    hovered card]    │   Group: "Ramp" (12)                   │
│                     │     └─ [card] [card] [card]            │
│                     │   Group: "Removal" (15)                │
│                     │     └─ [card] [card]                   │
│                     │   Group: "(No Tags)" (70)              │
│                     │     └─ [many cards]                    │
│                     │                                        │
│                     │ Sideboard (15)                         │
│                     │   └─ [cards]                           │
│                     │                                        │
│                     │ Maybeboard (23)                        │
│                     │   └─ [cards]                           │
│                     │                                        │
│                     │ ───────────────────────────            │
│                     │ Stats (collapsible)                    │
│                     │   [Mana curve histogram]               │
│                     │   [Color distribution]                 │
│                     │   [Type breakdown]                     │
│                     │                                        │
│                     │ Primer (collapsible)                   │
│                     │   [Rich text editor]                   │
└─────────────────────┴───────────────────────────────────────┘
```

### Mobile Layout

- Header (name, format, search) - stacks vertically
- No preview pane - tap card for full preview/modal
- Sections stack vertically with full width
- Stats collapse by default
- Cards in 2-column grid or single-column list

## Data Model

### Deck State

Matches `com.deckbelcher.deck.list` lexicon schema:

```typescript
interface DeckState {
  name: string;
  format?: string;
  cards: DeckCard[];
  primer?: string;
  primerFacets?: RichtextFacet[];
  createdAt: string;
  updatedAt?: string;
}

interface DeckCard {
  scryfallId: string;      // Scryfall UUID
  quantity: number;         // 1+
  section: Section;         // "commander" | "mainboard" | "sideboard" | "maybeboard"
  tags?: string[];          // ["ramp", "interaction", ...]
}

type Section = "commander" | "mainboard" | "sideboard" | "maybeboard" | string;
```

### Key Behavior

**Card Uniqueness:**
- A card is unique by `(scryfallId, section)` combination
- Same card in different sections = separate entries
- Same card in same section with different tags = INVALID (one entry, multiple tags)

**Example:**
```typescript
// ✅ Valid: Lightning Bolt in mainboard (qty 2) and sideboard (qty 1)
[
  { scryfallId: "abc...", quantity: 2, section: "mainboard", tags: ["burn"] },
  { scryfallId: "abc...", quantity: 1, section: "sideboard", tags: ["removal"] }
]

// ❌ Invalid: Same card, same section, different tags
[
  { scryfallId: "abc...", quantity: 1, section: "mainboard", tags: ["burn"] },
  { scryfallId: "abc...", quantity: 1, section: "mainboard", tags: ["removal"] }
]

// ✅ Valid: One entry with multiple tags
[
  { scryfallId: "abc...", quantity: 2, section: "mainboard", tags: ["burn", "removal"] }
]
```

## View Modes

### View Styles

**Text (default):**
- Compact rows: `name | mana cost | type line`
- Hover shows preview in left pane
- Most space-efficient

**Visual Grid:**
- Card thumbnails with quantity badge overlay
- Click for modal (edit qty/tags)
- Hover shows preview

**Visual Stacks (v2):**
- Overlapping card images
- Grouped by type/cmc/etc

### Grouping Options

**By Tag:**
- Cards grouped by tags (user-defined labels)
- Untagged cards in "(No Tags)" group
- Cards with multiple tags appear in EACH group they belong to

**By Type:**
- Creature, Instant, Sorcery, Enchantment, Artifact, Land, Planeswalker, etc.

**By Mana Value:**
- 0, 1, 2, 3, 4, 5, 6, 7+

**No Grouping:**
- Flat list, just sorted

### Sorting (within groups)

- Name (alphabetical)
- Mana Value (CMC ascending)
- Rarity (common → mythic)

### Extra Data Toggles

- Show/hide mana cost icons
- Show/hide set symbols
- Show/hide prices (future)

## Interactions

### Adding Cards

1. User types in search box (header)
2. Autocomplete dropdown shows legal cards for selected format
3. Hovering search results shows card in preview pane
4. Clicking result adds 1x to mainboard
5. Search stays active for rapid additions

### Editing Cards

**Click card → opens modal:**
- Quantity input (number)
- Tag management (add/remove tags, chip UI)
- Section dropdown (move to different section)
- Delete button

### Drag & Drop

**Between sections:**
- Drag card from Mainboard to Sideboard
- Changes `section` field, preserves `quantity` and `tags`

**Between tag groups (within same section):**
- Drag card from "Ramp" group to "Removal" group
- Removes "ramp" tag, adds "removal" tag
- Preserves other tags (e.g., if card also had "instant", it keeps that)
- If card has multiple tags, it visually appears in multiple groups, but it's ONE card

**Visual feedback:**
- Drop zones highlight on drag
- Ghost image follows cursor

### Preview Pane Behavior

**Default (no hover):**
- Shows top card in active section (probably first card in commander, or first mainboard card)

**During search:**
- Shows top search result by default
- Updates to hovered search result

**During deck browsing:**
- Shows last hovered card in deck list
- Persists until new card is hovered

## Stats & Analysis

### Mana Curve
- Histogram by CMC (0, 1, 2, 3, 4, 5, 6, 7+)
- Includes cards from mainboard + commander
- Excludes sideboard/maybeboard

### Color Distribution
- Pie chart or bar chart
- Based on color identity
- Shows mono, multi, colorless proportions

### Type Breakdown
- Count by card type (Creature, Instant, Sorcery, etc.)
- Useful for deck balance

### Average CMC
- Mean mana value across mainboard

## Format Legality

### Supported Formats (v1)
- Commander (primary)
- Cube (no legality filtering, freeform)
- Pauper
- Pauper Commander (PDH)

### Format Filtering
- When format is selected, search only shows legal cards
- Use Scryfall `legalities` field
- Commander: also enforce color identity restrictions (once commander is set)

### Commander-Specific Rules
- Commander section limited to 1-2 cards (partner commanders)
- Color identity enforcement (all cards must match commander's color identity)
- 100-card total (commander + mainboard = 100)

## Technical Implementation Notes

### State Management
- Local React state (useState) for deck
- No persistence in v1 (can add localStorage later)
- All mutations are immutable updates

### Card Data
- Use existing `getCardDataProvider()` for search
- Scryfall data already loaded client-side
- Format legality from `card.legalities` field

### Routing
- `/deck/new` - generates new deck ID (AT URI: authority + rkey), redirects to `/deck/$id`
- `/deck/$id` - editor route
  - ID format: AT Protocol URI (authority + rkey)
  - Example: `did:plc:abc123/3jxyz...` (the rkey portion of the full AT URI)
  - For new decks, generate a TID-based rkey before redirect
  - For existing decks, ID comes from ATProto record

### Drag & Drop Library
- Use `@dnd-kit/core` (modern, performant, accessible)
- Supports touch devices
- Good TypeScript support

### Performance
- Virtualize long card lists (react-virtual or similar)
- Debounce search input
- Memoize grouping/sorting calculations

## Future Enhancements (post-v1)

- localStorage draft saving
- Visual Stacks view
- More grouping options (color, color identity, set, artist)
- Price tracking
- Commander color identity validation
- Deck legality checker
- Export formats (text, MTGO, Arena)
- Import from other tools
- Card recommendations
- Goldfish hand simulator
- Primer with rich text (card mentions via facets)
- Version history (via ATProto CIDs)
- Social features (likes, replies to specific cards)

## Reference: Moxfield Features

### View Styles
- Text
- Condensed Text
- Visual Grid
- Visual Stacks
- Visual Stacks (Split)
- Visual Spoiler

### Group By
- Type
- SubType
- Type & Tag
- Rarity
- Color
- Color Identity
- Mana Value
- Set
- Artist
- No Grouping

### Sort By
- Name
- Mana Value
- Price
- Rarity

### Extra Data
- Mana Cost
- Price
- Set Symbol

We'll start with a subset and expand based on user feedback.
