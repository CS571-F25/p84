# Typelex Reference

Typelex is a TypeSpec-based syntax for authoring AT Protocol Lexicon schemas. It compiles `.tsp` files to Lexicon JSON.

## Basic Structure

```typescript
import "@typelex/emitter";
import "./externals.tsp";

namespace com.example.schema {
  @rec("tid")
  model Main {
    @required
    text: string;
  }
}
```

## Record Types

Use `@rec()` decorator to define record types:

- `@rec("tid")` - Timestamp-based IDs for collections
- `@rec("literal:self")` - Single record per repo (profiles)
- `@rec("any")` - Arbitrary keys

## Property Decorators

### Constraints
- `@required` - Mandatory field
- `@maxGraphemes(n)` - Visual character limit (user-facing)
- `@maxLength(n)` - Byte length limit (typically 10x graphemes for UTF-8)
- `@minValue(n)` / `@maxValue(n)` - Integer bounds
- `@minItems(n)` / `@maxItems(n)` - Array size limits
- `@minLength(n)` - Minimum string/array length

### Special Decorators
- `@inline` - Expand model inline without separate definition
- `@token` - Create empty token models (for marker types)
- `@external` - Declare external namespace stub

## Type System

### Primitives
- `string`, `integer`, `boolean`, `bytes`
- `datetime` - AT Protocol datetime format
- `did`, `handle`, `atUri` - AT Protocol identifiers
- `cid` - Content identifier
- `uri` - Standard URI

### Collections
- Arrays: `string[]`, `Model[]`
- Optional: `field?: type`
- Item constraints: Use scalars for constrained array items
  ```typescript
  @maxGraphemes(64)
  @maxLength(640)
  scalar Tag extends string;

  @maxItems(128)
  tags?: Tag[];  // Array of max 128 tags, each max 64 graphemes
  ```

### Unions

**Open unions (recommended):**
```typescript
// String with known values
section: "mainboard" | "sideboard" | "maybeboard" | string;

// Model union with extensibility
features: (Mention | Link | Tag | unknown)[];
```

Compiles to `knownValues` in JSON for string unions.

**Closed enums (discouraged):**
Avoid unless absolutely necessary. Use open unions instead.

## External References

To reference external AT Protocol lexicons (like `com.atproto.repo.strongRef`):

1. **Download the external lexicon JSON** to `lexicons/` folder:
   ```bash
   mkdir -p lexicons/com/atproto/repo
   curl -s https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/com/atproto/repo/strongRef.json \
     > lexicons/com/atproto/repo/strongRef.json
   ```

2. **Run lexicons:compile** - it auto-generates `typelex/externals.tsp` with `@external` stubs:
   ```bash
   npm run lexicons:compile
   ```

3. **Reference the external type** using the full namespace + `.Main`:
   ```typescript
   namespace com.deckbelcher.social.like {
     model Main {
       @required
       subject: com.atproto.repo.strongRef.Main;
     }
   }
   ```

**Important:** Typelex uses the full lexicon ID as the namespace (e.g., `com.atproto.repo.strongRef`), so you reference it as `com.atproto.repo.strongRef.Main`, not `com.atproto.repo.strongRef`.

### How externals.tsp Works

Starting with typelex v0.3.0+:
- Automatically generates `typelex/externals.tsp` based on JSON files in `lexicons/`
- Only includes external lexicons (not your app's namespace)
- Uses `@external` decorator to skip JSON output for those namespaces
- Must be imported in `typelex/main.tsp` entry point

Generated stub example:
```typescript
@external
namespace com.atproto.repo.strongRef {
  model Main { }
}
```

## File Organization

- Source files: `typelex/*.tsp`
- Output: `lexicons/` directory
- Import pattern: `import "./other-file.tsp"`
- Namespaces determine output structure, not file organization

## Compilation

```bash
npm run lexicons:compile
# runs: typelex compile com.deckbelcher.*
```

Output is deterministic JSON in `lexicons/` matching namespace structure.

## Common Patterns

### Record with Facets
```typescript
namespace com.example.post {
  @rec("tid")
  model Main {
    @required
    @maxGraphemes(300)
    @maxLength(3000)
    text: string;

    facets?: app.bsky.richtext.facet.Main[];

    @required
    createdAt: datetime;
  }
}
```

### Open String Enum
```typescript
model Card {
  @required
  section: "mainboard" | "sideboard" | "maybeboard" | string;
}
```

Compiles to:
```json
{
  "type": "string",
  "knownValues": ["mainboard", "sideboard", "maybeboard"]
}
```

### Token Markers
```typescript
@token
model ReasonSpam {}

@token
model ReasonViolation {}

model Report {
  @required
  reason: (ReasonSpam | ReasonViolation | unknown);
}
```

## Best Practices

1. **Use open unions** - Add `| unknown` or `| string` for extensibility
2. **Prefer optional fields** - Use `?:` unless truly required
3. **10x rule** - Set `maxLength` ~10x `maxGraphemes` for UTF-8 safety
4. **Semantic namespaces** - Group by domain (`actor`, `deck`, `social`)
5. **Import externals** - Always import `"@typelex/emitter"` and `"./externals.tsp"`
6. **PascalCase models** - Converted to camelCase in JSON output
7. **Main model** - Use `model Main` for primary namespace definition

## Model Naming

- `model Main` → `"main"` def (primary record)
- `model Card` → `"card"` def (nested type)
- Converted to camelCase in output

## Validation

TypeSpec compiler catches:
- Invalid references
- Empty unions
- Mixed union types (literals + models without proper structure)
- Missing required imports

Warnings for documentation issues (unescaped special chars like `@`).

## Resources

- [Typelex Docs](https://tangled.org/@danabra.mov/typelex/blob/main/DOCS.md)
- [AT Protocol Lexicon Guide](https://atproto.com/guides/lexicon)
- [Bluesky Lexicons (reference)](https://github.com/bluesky-social/atproto/tree/main/lexicons)
