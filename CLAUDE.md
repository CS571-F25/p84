# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**deckbelcher** is a TanStack Start application with:
- React 19 + TanStack Router (file-based routing)
- TanStack Query for data fetching
- Tailwind CSS v4 for styling
- TypeSpec/Typelex for lexicon schema generation
- Vitest for testing
- Biome for linting/formatting

## Development Commands

```bash
# Development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Testing
npm run test           # Run all tests
vitest run <file>      # Run specific test file

# Linting & Formatting
npm run lint           # Lint code
npm run format         # Format code
npm run check          # Check both linting and formatting
npm run typecheck      # Check TypeScript types

# Lexicons (schema generation)
npm run lexicons:compile  # Compile TypeSpec (.tsp) → JSON lexicons
npm run lexicons:codegen  # Generate TypeScript types from JSON lexicons
npm run lexicons:scopes   # Generate OAuth scopes from JSON lexicons
npm run lexicons:all      # Run all three in sequence
```

## Architecture

### File-Based Routing

Routes live in `src/routes/` and are managed by TanStack Router:
- `__root.tsx` - Root layout with header, devtools, and HTML shell
- `index.tsx` - Homepage route
- `card/`, `cards/`, `deck/`, `profile/`, `u/` - Feature routes
- `oauth/`, `signin.tsx` - Authentication routes

Route files are auto-generated into `src/routeTree.gen.ts` (excluded from linting).

### Router Setup

Router initialization happens in `src/router.tsx`:
- Integrates TanStack Query via `setupRouterSsrQueryIntegration`
- Wraps router with TanStack Query provider from `src/integrations/tanstack-query/`
- Uses context pattern for dependency injection

### Path Aliases

TypeScript paths are configured with `@/*` alias pointing to `src/*` (tsconfig.json + vite-tsconfig-paths plugin).

**IMPORTANT**: Prefer `@/*` imports over relative imports (`../..`). This prevents imports from breaking when files are moved and makes refactoring easier. Use `@/components/Foo` instead of `../../components/Foo`.

### Typelex/Lexicons

- **Source**: `typelex/*.tsp` - TypeSpec definitions for AT Protocol lexicons
- **Generated JSON**: `lexicons/com/deckbelcher/**/*.json` - Compiled lexicon schemas
- **Generated TS**: `src/lib/lexicons/` - TypeScript types from lexicons
- After modifying `.tsp` files, run `npm run lexicons:all` which:
  1. `lexicons:compile` - compiles TypeSpec → JSON lexicons
  2. `lexicons:lint` - lints lexicons with `goat lex lint`
  3. `lexicons:codegen` - generates TypeScript types from JSON lexicons
  4. `lexicons:scopes` - updates OAuth scopes in `public/client-metadata.json`
- Lexicons follow AT Protocol conventions (used for ATProto/Bluesky integrations)

**IMPORTANT**: NEVER edit files in `lexicons/` directly - they are generated from TypeSpec. Edit the `.tsp` files in `typelex/` and run `npm run lexicons:all` to regenerate.

### Styling

Tailwind CSS v4 is integrated via `@tailwindcss/vite` plugin. Global styles in `src/styles.css`.

**Dark Mode Support:**
- All components and pages must support both light and dark mode
- Theme is managed by `ThemeProvider` in `src/lib/useTheme.tsx`
- Dark mode configuration: `@custom-variant dark (&:where(.dark, .dark *))` in `src/styles.css`
- **See `.claude/DARK_MODE.md` for the full style guide**
- Key patterns:
  - Backgrounds: `bg-white dark:bg-zinc-900` (page), `bg-gray-50 dark:bg-zinc-800` (panels)
  - Primary text: `text-gray-900 dark:text-zinc-100`
  - Secondary text: `text-gray-600 dark:text-zinc-300` (AAA contrast)
  - Borders: `border-gray-200 dark:border-zinc-600` (visible)
  - Accent color: `cyan-*` (e.g., `text-cyan-600 dark:text-cyan-400`)
  - Focus rings: `focus:ring-cyan-500 dark:focus:ring-cyan-400`
- **DO NOT use**: `slate-*` for dark mode (it's blue-tinted)

**Reduced Motion Support:**
- Respect `prefers-reduced-motion` for decorative and dramatic animations
- Use `motion-safe:` prefix on transitions, NOT on the hover state itself (preserve functionality, remove animation)
- Categories of effects:
  - **Keep without motion-safe:** Subtle state indicators - hover background colors, border color changes. These are quick and communicate interactivity.
  - **Wrap with motion-safe:** Flourishes and dramatic effects - font-variation-settings animations (weight/CASL), shadows appearing (`hover:shadow-lg`), overlay fades, scale transforms, ring transitions. Anything slow, dramatic, or purely decorative.
- Pattern for flourish animations:
  ```
  [font-variation-settings:'wght'_400]
  motion-safe:group-hover:[font-variation-settings:'wght'_500]
  motion-safe:transition-[font-variation-settings] motion-safe:duration-200 motion-safe:ease-out
  ```
- Pattern for functional features with animated presentation:
  ```
  opacity-0 group-hover:opacity-100 motion-safe:transition-opacity
  ```
  (Overlay still appears on hover, just instantly with reduced motion)

**Tailwind JIT and Dynamic Classes:**
- Tailwind's JIT compiler scans source code at build time to find class names
- **NEVER use template literals with variables for Tailwind arbitrary values:**
  ```tsx
  // BAD - Tailwind can't see this at build time, CSS won't be generated
  className={`aspect-[${CARD_ASPECT_RATIO}] rounded-[${CARD_BORDER_RADIUS}]`}

  // GOOD - Use inline styles for dynamic values
  style={{ aspectRatio: CARD_ASPECT_RATIO, borderRadius: CARD_BORDER_RADIUS }}

  // GOOD - Hardcoded arbitrary values work fine (with comment explaining magic numbers)
  className="aspect-[672/936] rounded-[4.75%/3.5%]"
  ```
- This only affects arbitrary value syntax like `aspect-[...]`, `max-w-[...]`, `rounded-[...]`
- Regular class composition with variables is fine: `className={`p-4 ${isActive ? 'bg-blue-500' : ''}`}`
- Card aspect ratio and border radius use `CARD_STYLES` from `@/components/CardImage` for inline styles

### Development Tooling

- **Nix**: flake.nix provides Node.js 22, TypeSpec, and language servers
- **Biome**: Uses tabs for indentation, double quotes, excludes generated files
- **Devtools**: Integrated TanStack Router + Query + React devtools in root layout

## Reference Documentation

Additional reference docs are in `.claude/` - **read and update these when working on relevant topics**:

### Core Architecture
- **PROJECT.md** - DeckBelcher project overview, lexicon structure, and product decisions
- **ATPROTO.md** - ATProto integration (Slingshot, PDS, branded types, Result pattern)
- **CARD_DATA.md** - Card data pipeline and provider architecture (workers, chunks, SSR)
- **SEARCH.md** - Search syntax parser (lexer, parser, matcher, operators)

### Reference
- **SCRYFALL.md** - Scryfall card API reference (IDs, fields, image handling)
- **TYPELEX.md** - Typelex syntax guide (decorators, external refs, patterns)
- **DECK_EDITOR.md** - Deck editor UI patterns and data model
- **HOOKS.md** - Custom React hooks (usePersistedState, useSeededRandom, etc.)

These contain important context about project decisions, API details, and tooling. Keep them updated as the project evolves.

**When to create new reference docs:** If you're doing significant research, explaining complex topics repeatedly, or the user is spending time teaching you something important—create a new markdown file in `.claude/` to preserve that knowledge for future sessions.

## Build Configuration

### OAuth Plugin (vite.config.ts)
The Vite config includes a custom plugin that reads `public/client-metadata.json` and injects OAuth environment variables:
- `VITE_OAUTH_CLIENT_ID` - Client identifier
- `VITE_OAUTH_REDIRECT_URI` - Callback URL (differs between dev and build)
- `VITE_OAUTH_SCOPE` - Requested ATProto scopes

In dev mode, uses `http://localhost` redirect trick for local OAuth flow.

### Cloudflare Workers
Deployed via `@cloudflare/vite-plugin`. Server-side code runs in Workers environment:
- `env.ASSETS` for static file access (card data chunks)
- `worker-configuration.d.ts` for type definitions

### Data File Exclusions
Vite is configured to ignore large generated files in watch mode:
- `/public/data/**` - Card data chunks (~500MB)
- `/public/symbols/**` - Mana symbol SVGs

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_OAUTH_CLIENT_ID` | OAuth client ID (injected by plugin) |
| `VITE_OAUTH_REDIRECT_URI` | OAuth callback URL (injected by plugin) |
| `VITE_OAUTH_SCOPE` | ATProto scopes (injected by plugin) |
| `VITE_CLIENT_URI` | Public client URL |
| `VITE_DEV_SERVER_PORT` | Dev server port (default 3000) |
| `import.meta.env.SSR` | True during SSR (TanStack Start) |
| `import.meta.env.DEV` | True in development mode |

## Important Notes

### Documentation Hygiene
- **Update docs when you change things** - If you modify behavior documented in `.claude/*.md`, update the docs in the same PR. Stale docs are worse than no docs.
- **Add to todos.md when you notice issues** - Found a bug? Spotted code that needs refactoring? Add it to `todos.md` so it doesn't get lost.
- **Create new `.claude/` docs for complex features** - If you're implementing something that took significant research or has non-obvious behavior, document it.

### MTG Terminology
- **Use "mana value" (mv) not "CMC"** - Scryfall still uses `cmc` in their API, but the official MTG terminology changed in 2021. Use `mv` or `manavalue` in code, comments, and UI. The search parser accepts both but prefer `mv`.

### Code Standards
- **Stay focused on your current task** - If a global check (typecheck, lint) reports errors in files you haven't modified in this session, don't automatically fix them—mention them and let the user decide. Errors in files you did modify are your responsibility to fix. When in doubt, ask
- **This is a TypeScript project** - ALL code (including scripts) must use TypeScript with proper types
- **Use optimistic-utils for mutations** - All TanStack Query mutations should use helpers from `src/lib/optimistic-utils.ts` (`runOptimistic`, `optimisticRecord`, `optimisticCount`, `optimisticBacklinks`, etc). Pattern: `onMutate` returns `{ rollback }`, `onError` calls `context?.rollback()`. Never write raw cache manipulation—use the helpers. See `like-queries.ts` or `comment-queries.ts` for examples.
- **Use `nix-shell -p <package>` for missing commands** - If a command isn't in PATH, use nix-shell to get it temporarily
- **Prefer functional style over exceptions** - Avoid throwing errors for control flow. Use type predicates, Option/Result patterns, and early returns instead. Throwing is like GOTO—it breaks local reasoning and makes code harder to follow
- **Avoid unnecessary try/catch blocks** - Don't wrap code in try/catch without a specific reason. It's not defensive coding—it's noisy and masks real errors. If a function can return null/undefined, use that instead of throwing. Let exceptions bubble naturally unless you have a specific recovery strategy
- **Check `typelex/*.tsp` for DeckBelcher data models** - When confused about deck structure or app schemas, read the `.tsp` files. For card data, see `src/lib/scryfall-types.ts`
- **NEVER use `-f` flag with rm/git/etc without justification** - Force flags suppress errors and can hide problems. Use `rm -r` not `rm -rf`, let commands fail naturally
- **Prefer type-safe refactors over backward compatibility** - Don't make parameters optional or accept looser types just to avoid updating call sites. If an API change improves type safety (e.g., making a previously-implicit parameter explicit and required), update all callers. The type system catching mistakes at compile time is worth more than avoiding a few edits
- **ALWAYS run `npm run check` and `npm run typecheck` before considering work complete** - Verify linting, formatting, and types pass
- **NEVER manually fix formatting issues** - Always use `npm run format -- --write` to apply formatting fixes automatically. Manual formatting edits are error-prone and waste time
- `src/routeTree.gen.ts` is auto-generated - never edit manually
- `typelex/externals.tsp` is auto-generated from lexicons folder - add external lexicon JSON to trigger regeneration
- Biome only lints files in `src/`, `.vscode/`, and root config files
- Router uses "intent" preloading by default
- SSR is configured via TanStack Start plugin
- **ALWAYS use `<Link to="...">` from `@tanstack/react-router` instead of `<a href="...">`** - Using `<a>` tags causes full page reloads, which recreates the router and QueryClient instances on every navigation. This breaks TanStack Query's cache and causes expensive data (like the 163MB cards.json) to be refetched unnecessarily

### Testing Practices
- **Write tests to reproduce bugs before fixing them** - When debugging, write a failing test that demonstrates the issue first. This confirms you understand the problem and prevents regressions.
- **Write tests to check hunches** - If you suspect something might be broken, write a test to verify. Tests are cheaper than debugging production issues.
- **Ensure tests fail before making them pass** - A test that never failed might not be testing what you think it's testing.
