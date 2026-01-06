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
- `frame` - Frame edition (1993, 1997, 2003, 2015, future)
- `border` - Border color (black, white, borderless, silver, gold)
- `game` - Game availability (paper, mtgo, arena)
- `in` - Unified filter for game, set type, set code, or language (see below)

### Boolean Filters (is:)

**Card types:**
- `is:creature`, `is:instant`, `is:sorcery`, `is:artifact`, `is:enchantment`, `is:land`, `is:planeswalker`
- `is:permanent`, `is:spell` - Broader categories
- `is:legendary`, `is:snow`, `is:historic`

**Layouts:**
- `is:split`, `is:flip`, `is:transform`, `is:mdfc`, `is:dfc`, `is:meld`
- `is:saga`, `is:adventure`, `is:battle`, `is:prototype`, `is:leveler`
- `is:token`, `is:art_series`

**Printing characteristics:**
- `is:reprint`, `is:promo`, `is:digital`, `is:reserved`
- `is:full`, `is:fullart`, `is:hires`
- `is:foil`, `is:nonfoil`, `is:etched`

**Frame effects:**
- `is:showcase`, `is:extendedart`, `is:borderless`, `is:inverted`, `is:colorshifted`
- `is:retro`, `is:old` (1993/1997 frames), `is:modern` (2003/2015), `is:new` (2015), `is:future`
- `is:boosterfun`

**Promo types:**
- `is:buyabox`, `is:prerelease`, `is:fnm`, `is:gameday`, `is:release`, `is:datestamped`, `is:promopacks`

**Land types:** (derived from oracle text patterns)
- `is:fetchland` - Fetch lands (search + pay life)
- `is:shockland` - Shock lands (pay 2 life)
- `is:dual` - Original dual lands (two basic types, no text)
- `is:triome` - Triomes (three basic land types)
- `is:checkland` - Check lands (enters tapped unless you control...)
- `is:fastland` - Fast lands (enters tapped unless two or fewer lands)
- `is:slowland` - Slow lands (enters tapped unless two or more lands)
- `is:painland` - Pain lands (tap + damage for colored)
- `is:filterland` - Filter lands (pay life to filter mana)
- `is:bounceland` - Bounce lands (return a land)
- `is:tangoland`, `is:battleland` - Battle/tango lands
- `is:scryland` - Scry lands (enters tapped, scry 1)
- `is:gainland` - Gain lands (enters tapped, gain 1 life)
- `is:manland`, `is:creatureland` - Creature lands (becomes a creature)
- `is:canopyland` - Canopy lands (sacrifice to draw)

**Card archetypes:**
- `is:vanilla` - Creatures with no text
- `is:frenchvanilla` - Creatures with only keywords
- `is:bear` - 2/2 for 2 creatures
- `is:modal`, `is:spree` - Modal spells (choose one/two/etc)
- `is:party` - Party creatures (cleric, rogue, warrior, wizard)
- `is:outlaw` - Outlaw creatures (assassin, mercenary, pirate, rogue, warlock)
- `is:commander` - Can be your commander

**Note:** Land type predicates use oracle text pattern matching and may need refinement. See `fields.ts` IS_PREDICATES for implementation details.

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

### The `in:` Field

The `in:` field is a unified filter that matches multiple contexts:

| Value Type | Examples | What it matches |
|------------|----------|-----------------|
| Game | `in:paper`, `in:mtgo`, `in:arena` | `card.games` array |
| Set type | `in:core`, `in:expansion`, `in:commander` | `card.set_type` |
| Set code | `in:lea`, `in:m21` | `card.set` |
| Language | `in:ja`, `in:ru` | `card.lang` |

Note: For set codes and languages that could overlap, both are checked.

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
