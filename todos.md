# Backlog

This file tracks discovered issues, refactoring opportunities, and feature ideas that aren't being worked on immediately. Use it as a scratchpad during development - add things here when you notice them so they don't get lost.

**Not a sprint board.** This is for parking things you don't want to forget, not active work tracking.

---

## Bugs

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

#### Deck editor: Replace ref with reducer pattern
- **Location**: `src/routes/profile/$did/deck/$rkey/index.tsx`
- **Issue**: Currently uses `deckRef` to avoid stale closures in toast undo callbacks. This is a band-aid fix.
- **Better approach**: Use `useReducer` for local deck state with explicit actions (`ADD_CARD`, `REMOVE_CARD`, etc.)
- **Benefits**: Natural fit for undo/redo (action history), integrates well with Immer, clearer mental model
- **Effort**: Medium

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

#### Bulk edit: use deck-formats parser and line matching
- **Location**: `src/routes/profile/$did/deck/$rkey/bulk-edit.tsx`
- **Issue**: Uses old `parseCardList` from deck-import.ts, and `parsedByRaw` map loses duplicate lines in preview
- **Fix**: Switch to `parseDeck` from deck-formats, use `matchLinesToParsedCards` for preview line matching
- **Effort**: Small (1-2 hours)

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

Run `npm run test:a11y` to check. Currently 11/13 tests passing.

### Known Exception: Deck page muted mana stats

The deck page intentionally uses low-contrast text (gray-500 on zinc-900) for mana colors not present in the deck. This fails color-contrast checks but is a deliberate design choice to de-emphasize irrelevant colors. The `target-size` rule is also disabled for deck stats (compact layout is intentional).

### Fixed Issues (January 2025)

- **landmark-one-main**: Added `<main>` wrapper in root layout
- **region**: Content now inside proper landmarks
- **color-contrast (cyan links)**: Darkened to cyan-800 in SearchPrimer, cyan-700 for active states
- **link-in-text-block**: Added underlines to inline links
- **select-name**: Added aria-labels to all dropdowns
- **heading-order**: Fixed SearchPrimer to use h2/h3 instead of h3/h4
- **landmark-unique**: Added aria-label to Profile page nav
- **scrollable-region-focusable**: Added tabIndex to DeckSampleView scroll area
