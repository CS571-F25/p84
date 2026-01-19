# Deck Format Reference

Multi-format deck import/export library in `src/lib/deck-formats/`.

## Format Landscape

| Format | Quantity | Set Syntax | Sections | Tags | Notes |
|--------|----------|------------|----------|------|-------|
| **Arena** | `4 Name` | `(SET) 123` | `Deck`, `Sideboard`, `Commander`, `Companion` | - | Blank lines between sections |
| **MTGO** | `4 Name` | - (name only) | Blank line or `Sideboard:` | - | Simplest format |
| **Moxfield** | `4 Name` | `(SET) 123` | Per-section editing | `#tag #!global` | Also `*F*` foil, `*A*` alter |
| **TappedOut** | `4x Name` | - | `SB:` prefix, `#Category` | Categories = tags | Note the `x` suffix |
| **Deckstats** | `4 Name` | - | `//Sideboard`, `SB:` prefix | - | Section comments |
| **XMage** | `4 Name` | `[SET:123]` before name | Same as MTGO | - | Brackets before name |
| **Archidekt** | `1x Name` | `(set) 123` | `[Commander]`, `[Sideboard]` inline | `[Category]` | Lowercase sets, inline markers |
| **MTGGoldfish** | `4 Name` | `<123> [SET]` after name | Blank line | - | Angle brackets for collector# |

## Detection Priority

Format detection checks most specific patterns first:

1. **XMage** - `[SET:123]` before card name (most distinctive)
2. **Archidekt** - `[Sideboard]`, `[Commander]` inline markers, or `^Have,#color^` ownership
3. **MTGGoldfish** - `[SET]` after card name (not before)
4. **Deckstats** - `//Section` comments or `# !Commander` marker
5. **TappedOut** - `4x` quantity pattern (with x suffix)
6. **Moxfield** - `#tags` or `*F*`/`*A*` markers
7. **Arena** - `Deck`/`Sideboard`/`Commander` section labels on own line
8. **Generic** - Plain card list fallback

## Design Decisions

1. **Companion zone**: Import as sideboard (rules-correct - companions live in sideboard)
2. **Foil/alter markers**: Strip on import (no lexicon support). `*F*`/`*A*` intentionally lost
3. **Global vs local tags**: `#!tag` collapsed to `#tag` - we don't distinguish
4. **Archidekt options**: `{top}`, `{noDeck}`, `{noPrice}` stripped - display-only metadata
5. **TappedOut categories**: Treat `#Category` as tags
6. **Maybeboard export**: Supported with `//Maybeboard` or `Maybeboard` section header

## Roundtrip Limitations

Some formats can't roundtrip to identical text due to structural differences:

- **Archidekt flat/by-category**: Cards alphabetized across sections; we export grouped by section
- **Deckstats custom categories**: `//burn`, `//ramp` etc. not preserved (only standard sections)
- **Cross-format fixtures**: Files in one format's directory but detected as another format

These are tested via parse/export snapshots instead of identity comparison.

## Module Structure

```
src/lib/deck-formats/
├── index.ts      # Public API re-exports
├── types.ts      # ParsedDeck, DeckFormat, ParseOptions
├── detect.ts     # detectFormat() - auto-detection
├── parse.ts      # parseDeck(), parseCardLine()
├── sections.ts   # Section marker/header parsing
├── export.ts     # formatDeck(), format-specific exporters
└── __tests__/
    ├── fixtures/     # Real-world format samples
    ├── normalize.ts  # Roundtrip normalizers (test-only)
    ├── detect.test.ts
    ├── parse.test.ts
    ├── roundtrip.test.ts
    └── snapshots.test.ts
```

## Usage

```typescript
import { parseDeck, formatDeck, detectFormat } from "@/lib/deck-formats";

// Auto-detect and parse
const deck = parseDeck(text);
console.log(deck.commander, deck.mainboard, deck.sideboard);

// Parse with format hint (skips detection)
const deck = parseDeck(text, { format: "moxfield" });

// Export to specific format
const arenaText = formatDeck(deck, "arena");
const moxfieldText = formatDeck(deck, "moxfield");

// Just detect format
const format = detectFormat(text); // "moxfield" | "arena" | etc.
```

## ParseOptions

```typescript
interface ParseOptions {
  format?: DeckFormat;           // Skip auto-detection
  defaultSection?: DeckSection;  // Default: "mainboard"
  stripRedundantTypeTags?: boolean; // Strip [Land], [Artifact] etc. Default: true
}
```
