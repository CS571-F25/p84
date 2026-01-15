# Deck Validation System

Pure function validation system for MTG deck construction rules with comprehensive rules citations.

## Overview

The `src/lib/deck-validation/` module provides:
- **Rule-based validation** with MTG comprehensive rules citations (e.g., "100.2a", "903.5b")
- **Format presets** that combine rules + config for each supported format
- **Copy exception detection** for cards like Relentless Rats, Seven Dwarves
- **Composable architecture** - formats are defined by spreading rule sets

## Usage

```typescript
import { validateDeck } from "@/lib/deck-validation";

const result = validateDeck({
  deck,
  cardLookup: (id) => cardMap.get(id),
  oracleLookup: (id) => oracleMap.get(id),
  getPrintings: (id) => printingsMap.get(id) ?? [],
});

if (!result.valid) {
  for (const v of result.violations) {
    console.log(`[${v.rule}] ${v.message}`);
  }
}
```

## File Structure

```
src/lib/deck-validation/
├── index.ts           # Barrel export
├── types.ts           # Core type definitions
├── exceptions.ts      # Copy exception detection (Relentless Rats, etc.)
├── presets.ts         # Format preset definitions
├── validate.ts        # Main validation orchestration
├── rules/
│   ├── index.ts       # Exports RULES object and RuleId type
│   ├── base.ts        # Generic rules (legality, copy limits, deck size)
│   ├── commander.ts   # Commander-family rules (color identity, partner)
│   └── rarity.ts      # Rarity rules (PDH uncommon commander)
└── __tests__/
    ├── exceptions.test.ts
    └── rules.test.ts
```

## Key Types

```typescript
// Rule citation from MTG comprehensive rules
type RuleNumber = string & { readonly __brand: "RuleNumber" };

// Categories for grouping violations
type RuleCategory = "legality" | "quantity" | "identity" | "structure";

// Violation severity
type Severity = "error" | "warning";

// A single violation
interface Violation {
  ruleId: string;           // Internal ID (e.g., "singleton")
  rule: RuleNumber;         // MTG rule (e.g., "903.5b")
  category: RuleCategory;
  cardName?: string;
  oracleId?: OracleId;
  section?: Section;
  quantity?: number;
  message: string;
  severity: Severity;
}

// Validation result
interface ValidationResult {
  valid: boolean;           // No errors (warnings okay)
  violations: Violation[];
  byCard: Map<OracleId, Violation[]>;
  byRule: Map<RuleNumber, Violation[]>;
}
```

## Available Rules

| Rule ID | MTG Citation | Description |
|---------|--------------|-------------|
| `cardLegality` | 100.2a | Card must be legal in format |
| `banned` | 100.6a | Card is banned in format |
| `restricted` | 100.6b | Restricted to 1 copy (Vintage) |
| `singleton` | 903.5b | Max 1 copy (Commander variants) |
| `playset` | 100.2a | Max 4 copies (60-card formats) |
| `deckSizeMin` | 100.2a | Minimum deck size |
| `deckSizeExact` | 903.5a | Exact deck size (Commander = 100) |
| `sideboardSize` | 100.4a | Max sideboard cards |
| `colorIdentity` | 903.4 | Cards must match commander colors |
| `commanderRequired` | 903.3 | At least 1 commander |
| `commanderPartner` | 702.124 | Valid partner pairing if 2 commanders |
| `commanderLegendary` | 903.3 | Commander must be legendary creature/vehicle/spacecraft |
| `commanderUncommon` | 903.3 | Commander must be uncommon creature (PDH) |
| `commanderPlaneswalker` | 903.3 | Commander must be planeswalker (Oathbreaker) |
| `signatureSpell` | 903.3 | Oathbreaker signature spell requirement |

## Format Presets

Presets are defined in `presets.ts` and combine rules + config:

```typescript
// 60-card formats share common rules
const SIXTY_CARD_RULES = [
  "cardLegality", "banned", "playset", "deckSizeMin", "sideboardSize",
] as const;

// Commander variants share core rules
const COMMANDER_CORE_RULES = [
  "cardLegality", "banned", "singleton", "colorIdentity",
  "deckSizeExact", "commanderRequired", "commanderPartner",
] as const;

// Formats spread and extend
const PRESETS = {
  modern: { rules: SIXTY_CARD_RULES, config: { legalityField: "modern", minDeckSize: 60, sideboardSize: 15 } },
  commander: { rules: [...COMMANDER_CORE_RULES, "commanderLegendary"], config: { legalityField: "commander", deckSize: 100 } },
  paupercommander: { rules: [...COMMANDER_CORE_RULES, "commanderUncommon"], config: { legalityField: "paupercommander", deckSize: 100 } },
  // ...
};
```

## Adding a New Rule

1. Create the rule in the appropriate file (`base.ts`, `commander.ts`, or new file)
2. Export it from `rules/index.ts` and add to the `RULES` object
3. Add tests in `__tests__/rules.test.ts`
4. Add to relevant presets in `presets.ts`

```typescript
// In rules/base.ts
export const myNewRule: Rule<"myNewRule"> = {
  id: "myNewRule",
  rule: asRuleNumber("123.4a"),
  category: "structure",
  description: "What this rule checks",
  validate(ctx: ValidationContext): Violation[] {
    // Return violations or empty array
  },
};

// In rules/index.ts
export { myNewRule } from "./base";
export const RULES = {
  // ...existing rules
  myNewRule: myNewRule,
} as const;
```

## Adding a New Format

1. Add the format to `presets.ts` with appropriate rules and config
2. The `legalityField` should match Scryfall's `legalities.X` field name
3. Add to `FORMAT_GROUPS` in `format-utils.ts` for UI display

```typescript
// In presets.ts
myFormat: {
  rules: [...SIXTY_CARD_RULES, "someExtraRule"],
  config: { legalityField: "myformat", minDeckSize: 60, sideboardSize: 15 },
},
```

## Copy Exceptions

The `exceptions.ts` module handles cards that bypass normal copy limits:

- **Unlimited**: Relentless Rats, Shadowborn Apostle, Persistent Petitioners, etc.
- **Limited**: Seven Dwarves (max 7), Nazgûl (max 9)
- **Basic lands**: Always unlimited

Detection is regex-based on oracle text for future-proofing:
```typescript
// "A deck can have any number of cards named X"
// "A deck can have up to seven cards named X"
```

## Validation Options

```typescript
interface ValidationOptions {
  disabledRules?: Set<string>;      // Skip specific rules
  disabledCategories?: Set<RuleCategory>;  // Skip entire categories
  configOverrides?: Partial<FormatConfig>; // Override preset config
  includeMaybeboard?: boolean;      // Include maybeboard in validity
}
```

## Maybeboard Handling

- Maybeboard violations are included in `result.violations`
- But they don't affect `result.valid` unless `includeMaybeboard: true`
- Color identity violations in maybeboard are warnings, not errors

## Partner Validation

The `commanderPartnerRule` validates all partner pairings:
- Generic Partner (both have Partner keyword)
- Partner with X (names specific card)
- Friends Forever (from Stranger Things Secret Lair)
- Background (creature + Background enchantment)
- Doctor's Companion (companion + Time Lord Doctor)

## PDH (Pauper Commander) Notes

- Commander must be a creature (or vehicle) with an uncommon printing in paper/MTGO
- Non-creature artifacts (Sol Ring, etc.) cannot be PDH commanders even if uncommon
- Arena-only uncommon downshifts don't count
- Any printing can be used if a valid uncommon exists
- Uses `legalities.paupercommander` for the 99, not `pauper`
- Commander doesn't need to be legendary (just uncommon creature)

## Commander Eligibility (2024 Rule Update)

As of 2024, legendary vehicles and spacecraft are valid commanders without needing
"can be your commander" text. The `isValidCommanderType` function is exported for
use in `is:commander` search filtering.
