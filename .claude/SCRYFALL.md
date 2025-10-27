# Scryfall Card Model Reference

## Key Identifiers

**For DeckBelcher:** Use `id` (Scryfall's UUID) as the canonical identifier per-printing.

- **`id`**: Unique UUID for each card printing in Scryfall's database
  - This is what we store in `com.deckbelcher.list` as `scryfallId`
  - Different for each printing/version of the same card
- **`oracle_id`**: Consistent ID across all reprints of the same card
  - Useful for "print-agnostic" searches (e.g., "all Lightning Bolts regardless of printing")
- **`multiverse_ids`**: Gatherer identifiers (can be null)
- **Platform IDs**: `arena_id`, `mtgo_id`, `tcgplayer_id`

## Card Object Structure

### Core Fields
- `name`: Card name
- `mana_cost`: Mana cost string (e.g., `"{2}{U}"`)
- `cmc`: Converted mana cost (numeric)
- `type_line`: Full type line
- `oracle_text`: Rules text
- `keywords`: Array of keyword abilities

### Deckbuilding Fields
- `color_identity`: Array of colors for Commander legality
- `legalities`: Object with format legalities (`"commander": "legal"`, etc.)
- `colors`: Actual card colors
- `power`, `toughness`, `loyalty`: Creature/planeswalker stats

### Multi-Face Cards
- `card_faces`: Array of faces for split/flip/transform/MDFC cards
- Each face has independent attributes (name, mana_cost, type_line, etc.)
- The main object contains shared metadata

## Image & Display Fields

### Images

**Image URI Reconstruction:**
Scryfall image URLs follow a predictable pattern. Instead of storing `image_uris`, reconstruct them:

```typescript
function getImageUri(scryfallId: string, size: 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop'): string {
  return `https://cards.scryfall.io/${size}/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}
```

Pattern: `https://cards.scryfall.io/{size}/front/{id[0]}/{id[1]}/{id}.jpg`

Verified on 100% of sampled cards (96.5% of all cards have images).

**Stored fields:**
- `image_status`: Quality indicator (`missing`, `placeholder`, `lowres`, `highres_scan`)
- `highres_image`: Boolean for high-res availability
- `illustration_id`: Unique artwork identifier (not currently stored, but available)

### Card Appearance
- `layout`: Layout code (e.g., `"normal"`, `"split"`, `"transform"`, `"modal_dfc"`)
- `border_color`: Border type (`"black"`, `"white"`, `"borderless"`, `"silver"`, `"gold"`)
- `frame`: Frame layout version
- `frame_effects`: Array of frame effects (e.g., `"showcase"`, `"extendedart"`)
- `full_art`: Boolean for oversized artwork
- `finishes`: Available finishes array (`["foil", "nonfoil", "etched"]`)
- `promo`: Boolean for promotional prints
- `digital`: Boolean for digital-only cards

### Printing Metadata
- `set`: Set code (e.g., `"2x2"`, `"cmm"`)
- `set_name`: Full set name
- `collector_number`: Print number within set
- `rarity`: `"common"`, `"uncommon"`, `"rare"`, `"mythic"`, `"special"`, `"bonus"`
- `released_at`: Release date (ISO date string)
- `games`: Array of platforms (`["paper", "arena", "mtgo"]`)

## Important Notes

1. **Per-Printing IDs**: Scryfall's `id` is unique to each printing, which matches our lexicon design
2. **Oracle Names**: Use `oracle_id` to group printings of the same card
3. **Multi-Face Complexity**: Check `layout` field and `card_faces` array for split/transform/MDFC cards
4. **Bulk Data**: Scryfall provides bulk JSON downloads (~100MB gzipped) for offline search
