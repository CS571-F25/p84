# Backlog

This file tracks discovered issues, refactoring opportunities, and feature ideas that aren't being worked on immediately. Use it as a scratchpad during development - add things here when you notice them so they don't get lost.

**Not a sprint board.** This is for parking things you don't want to forget, not active work tracking.

---

## Bugs

### Delete undo adds N+1 copies
- **Location**: Deck editor undo logic
- **Issue**: Undoing a card deletion adds N+1 of the card as independent copies instead of restoring the original single entry
- **Repro**: Delete a card with qty 4, undo, observe 5 separate entries

### Bare regex for name search doesn't work
- **Location**: `src/lib/search/parser.ts`, `parseNameExpr()`
- **Issue**: `/goblin.*king/i` syntax is parsed but not matched correctly for bare name searches (works in field values like `o:/regex/`)
- **Why it matters**: Documented in grammar but broken

### Flaky property test for OR parsing
- **Location**: `src/lib/search/__tests__/parser.test.ts:276` ("parses OR combinations")
- **Issue**: fast-check property test occasionally finds edge cases that fail parsing
- **Repro**: Run full test suite repeatedly, fails intermittently
- **Investigate**: What input caused the failure, is it a parser bug or test issue

---

## Features (Planned)

### Card modal improvements
- Autocomplete for tags
- Keyboard support for quantity changes (up/down arrows, number keys)
- Focus trap for accessibility

### Commander selection
- **Location**: `src/routes/deck/new.tsx` (has TODO comment)
- When format is commander/paupercommander, prompt for commander selection before creating deck
- Affects color identity filtering

### Multi-faced card handling
- **Status**: Recently added (`src/lib/card-faces.ts`), needs integration
- Deck stats should account for castable faces properly
- Mana curve should use front-face CMC for transform cards

---

## UX / Navigation

### Static sidebar nav on desktop
- **Feedback from**: nat
- **Issue**: Collapsible sidebar is poor UX on desktop - constant open/close friction
- **Fix**: Static sidebar that's always visible, with shadcn-style expandable sections (like Streamplace does)
- **Effort**: Medium

---

## Search Improvements

### Autocomplete suggestions for known values
- **Feedback from**: nat
- **Issue**: When typing `t:`, should suggest 'creature', 'instant', 'sorcery', etc. Same for other fields with finite value sets
- **Alternative**: At minimum, show link to search syntax docs
- **Effort**: Medium-Large (needs dropdown UI, field-specific value lists)

### Add guild/shard/wedge color names
- **Location**: `src/lib/search/colors.ts:137` (marked with comment)
- Add support for `c:azorius`, `c:bant`, `c:jeskai`, etc.
- Map names to color sets: azorius → WU, bant → WUG, etc.

---

## Refactoring (Technical Debt)

### High Priority

#### Reduce computeManaSymbolsVsSources complexity
- **Location**: `src/lib/deck-stats.ts:327-502` (176 lines)
- **Issue**: Single function creates 13 separate color-keyed data structures, has deeply nested loops, mixes concerns (counting, classification, distribution)
- **Fix**: Extract tempo classification to separate module, create `ColorMap` utility class, split into smaller focused functions
- **Effort**: Medium (half day)

#### Extract sorting strategies from sortGroupNames
- **Location**: `src/lib/deck-grouping.ts:319-387`
- **Issue**: 4 different sorting strategies in one big switch statement
- **Fix**: Extract to strategy map: `const sorters: Record<GroupBy, SortFn>`
- **Effort**: Small (1 hour)

### Medium Priority

#### Memoize regex patterns in getSourceTempo
- **Location**: `src/lib/deck-stats.ts:148-225`
- **Issue**: Regex patterns compiled on every function call, no memoization
- **Fix**: Move patterns to module-level constants or use lazy initialization
- **Effort**: Small (30 min)

#### Standardize error handling across ATProto operations
- **Location**: `src/lib/atproto-client.ts`, `src/lib/cards-server-provider.ts`, etc.
- **Issue**: Inconsistent patterns - some use try-catch with console.error, some return Result<T,E>, some silently return empty arrays
- **Fix**: Adopt Result<T,E> consistently, remove unnecessary try-catch blocks
- **Effort**: Medium (2-3 hours)

#### Consolidate layout metadata for card-faces
- **Location**: `src/lib/card-faces.ts:16-33`
- **Issue**: `MODAL_LAYOUTS`, `TRANSFORM_IN_PLAY_LAYOUTS`, `HAS_BACK_IMAGE_LAYOUTS` are separate arrays checked in multiple places
- **Fix**: Create single `LayoutMetadata` map with all properties per layout
- **Effort**: Trivial (30 min)

### Lower Priority

#### Extract meta tag builder in card route
- **Location**: `src/routes/card/$id.tsx:62-113`
- **Issue**: 51 lines of nested object literals for OG/Twitter meta tags
- **Fix**: Extract to `buildCardMetaTags(card)` helper
- **Effort**: Trivial (15 min)

#### Parser error collection
- **Location**: `src/lib/search/parser.ts`
- **Issue**: Fails on first error instead of collecting all parse errors
- **Fix**: Add error recovery, collect ParseError[], continue parsing
- **Effort**: Large (needs design, affects error display)

---

## Documentation Gaps

### .claude/PROJECT.md stale lexicon status
- Claims `com.deckbelcher.reply` is "planned" but doesn't exist
- Claims `com.deckbelcher.like` is "planned" but it exists as `com.deckbelcher.social.like`
- Update to reflect actual lexicon implementation status

### Drag & drop known limitation
- **Location**: `src/components/deck/DragDropProvider.tsx`
- Screen size checked once on mount, doesn't update on resize
- Breaks on foldable phones when unfolding
- Should document in DECK_EDITOR.md or fix

---

## Testing Gaps

### Integration tests for worker
- Worker code tested via mocked Comlink
- Would benefit from actual worker instantiation tests

---

## Accessibility (a11y)

Run `npm run test:a11y` to check. Currently 12/13 tests failing.

### Structural / Landmarks

#### landmark-one-main: Missing main landmark
- **Location**: Card pages, Profile, Deck pages
- **Issue**: Document should have exactly one `<main>` landmark
- **Fix**: Wrap primary content in `<main>` element in route layouts
- **Pages affected**: Card detail, Profile, Deck

#### region: Content outside landmarks
- **Location**: All pages
- **Issue**: Page content not contained by landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`, etc.)
- **Fix**: Ensure all visible content is inside semantic landmark elements
- **Selectors flagged**: `.text-red-900`, `p`, various buttons

### Contrast / Visual

#### color-contrast: cyan links on gray backgrounds
- **Location**: Search primer (`src/components/SearchPrimer.tsx`), Home page
- **Issue**: cyan-600 (#007595) on gray-200 (#e5e7eb) = 4.26:1, need 4.5:1 for AA
- **Fix**: Either darken cyan to ~cyan-700 or lighten background

#### link-in-text-block: links not distinguishable
- **Location**: Inline links in search primer, profile bio, etc.
- **Issue**: Links only distinguished by color, need underline or 3:1 contrast vs surrounding text
- **Fix**: Add `underline` class to inline links (not just `hover:underline`)

### Form Controls

#### select-name: dropdowns missing accessible names
- **Location**: Sort dropdowns on card search, deck page
- **Issue**: `<select>` elements have no `aria-label` or associated `<label>`
- **Fix**: Add `aria-label="Sort by"` or wrap with visible `<label>`

### Keyboard / Focus

#### scrollable-region-focusable: Scrollable areas not keyboard accessible
- **Location**: Profile page, Deck page (horizontal scroll areas)
- **Issue**: Scrollable regions without focusable content can't be scrolled via keyboard
- **Fix**: Add `tabIndex={0}` to scrollable containers, or ensure they contain focusable elements
