# Search Syntax Parser

Full implementation of Scryfall-like search syntax. Located in `src/lib/search/`.

## Architecture

```
Query String
    ↓
┌─────────┐
│  Lexer  │  → Token[]
└─────────┘
    ↓
┌─────────┐
│ Parser  │  → SearchNode (AST)
└─────────┘
    ↓
┌─────────┐
│ Matcher │  → (Card) => boolean
└─────────┘
```

## File Overview

| File | Purpose |
|------|---------|
| `lexer.ts` | Tokenization (handles quoted strings, regexes, exact names) |
| `parser.ts` | Recursive descent parser producing AST |
| `matcher.ts` | Compiles AST to predicate function |
| `types.ts` | AST node types, Result<T,E>, field definitions |
| `fields.ts` | Field compilation (type, color, rarity, stats, etc.) |
| `operators.ts` | Operator definitions, query complexity detection |
| `colors.ts` | Color parsing and set comparison utilities |
| `describe.ts` | Human-readable query descriptions for UI |
| `index.ts` | Public API exports |

## Grammar

```
query      = or_expr
or_expr    = and_expr ("OR" and_expr)*
and_expr   = unary_expr+
unary_expr = "-" unary_expr | primary
primary    = "(" or_expr ")" | field_expr | name_expr
field_expr = WORD operator value
name_expr  = EXACT_NAME | WORD | QUOTED | REGEX
```

## Supported Operators

| Operator | Meaning |
|----------|---------|
| `:` | Contains/includes (default) |
| `=` | Exact match |
| `!=` | Not equal |
| `<` | Less than |
| `>` | Greater than |
| `<=` | Less than or equal |
| `>=` | Greater than or equal |

## Field Reference

### Card Properties
- `name`, `n` - Card name
- `type`, `t` - Type line (creature, instant, etc.)
- `oracle`, `o` - Oracle text
- `manavalue`, `mv`, `cmc` - Mana value (prefer `mv` - see CLAUDE.md terminology note)
- `color`, `c` - Card colors
- `identity`, `ci`, `id` - Color identity

### Stats
- `power`, `pow` - Power (creatures)
- `toughness`, `tou` - Toughness (creatures)
- `loyalty`, `loy` - Loyalty (planeswalkers)
- `defense`, `def` - Defense (battles)

### Metadata
- `rarity`, `r` - Card rarity (common, uncommon, rare, mythic)
- `set`, `s`, `e` - Set code
- `format`, `f` - Format legality
- `year` - Release year
- `date` - Release date
- `layout` - Card layout (normal, split, flip, transform, etc.)
- `game` - Game availability (paper, mtgo, arena)

### Boolean Filters (is:)
- `is:token` - Token cards
- `is:art` - Art cards
- `is:land` - Lands (by type)
- `is:creature`, `is:instant`, etc. - Card types

## Color Syntax

Colors can be specified as:
- Single letters: `c:wubrgc` (W=white, U=blue, B=black, R=red, G=green, C=colorless)
- Combined codes: `c:uw`, `c:bg`, `c:wubrg`
- Full names: `c:white`, `c:blue`, `c:colorless`

**Not yet supported** (see `colors.ts:137`):
- Guild names (azorius, dimir, etc.)
- Shard names (bant, esper, etc.)
- Wedge names (abzan, jeskai, etc.)

### Color Operators

Color comparisons use set theory:
- `:` or `>=` - Card has at least these colors (superset)
- `=` - Card has exactly these colors
- `<=` - Card has at most these colors (subset) - useful for commander
- `<` - Strict subset
- `>` - Strict superset
- `!=` - Not exactly these colors

## Examples

```
# Creatures with CMC 3 or less
t:creature cmc<=3

# Blue instants or sorceries
c:u (t:instant OR t:sorcery)

# Cards legal in Pauper that draw cards
f:pauper o:"draw a card"

# Mythic rares from recent sets
r:mythic year>=2023

# NOT red creatures
-c:r t:creature

# Exact name match
!"Lightning Bolt"
```

## Query Description

The `describe.ts` module generates human-readable descriptions of queries for UI feedback:

```typescript
import { describeQuery } from "@/lib/search";

describeQuery("t:creature cmc<=3");
// → "creatures with mana value 3 or less"

describeQuery("c:uw f:modern");
// → "white and blue cards legal in Modern"
```

## Integration

The search system integrates with `CardDataProvider`:

```typescript
// Unified search (auto-routes to fuzzy or syntax)
const result = await provider.unifiedSearch("t:creature cmc<=3");
// result.mode: "fuzzy" | "syntax"
// result.cards: Card[]
// result.description: "creatures with mana value 3 or less"
// result.error: null | { message, start, end }
```

## Result Type Pattern

The parser uses a functional `Result<T, E>` pattern instead of exceptions:

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const result = parse("t:creature");
if (result.ok) {
  // result.value is SearchNode
} else {
  // result.error is ParseError
}
```

## Adding New Fields

1. Add field name and aliases to `FIELD_ALIASES` in `types.ts`
2. Add case to `compileField()` in `fields.ts`
3. Add description logic to `describe.ts`
4. Add tests
