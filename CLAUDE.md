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
npm run serve

# Testing
npm run test           # Run all tests
vitest run <file>      # Run specific test file

# Linting & Formatting
npm run lint           # Lint code
npm run format         # Format code
npm run check          # Check both linting and formatting
npm run typecheck      # Check TypeScript types

# Typelex (schema generation)
npm run build:typelex  # Compile lexicons from typelex/*.tsp to lexicons/
```

## Architecture

### File-Based Routing

Routes live in `src/routes/` and are managed by TanStack Router:
- `__root.tsx` - Root layout with header, devtools, and HTML shell
- `index.tsx` - Homepage route
- `demo/*` - Demo routes showcasing various TanStack Start features

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
- **Generated**: `lexicons/com/deckbelcher/**/*.json` - Compiled lexicon schemas
- Run `npm run build:typelex` after modifying `.tsp` files
- Lexicons follow AT Protocol conventions (used for ATProto/Bluesky integrations)

### Styling

Tailwind CSS v4 is integrated via `@tailwindcss/vite` plugin. Global styles in `src/styles.css`.

**Dark Mode Support:**
- All components and pages must support both light and dark mode
- Use Tailwind's `dark:` variant for dark mode styles (e.g., `bg-white dark:bg-slate-900`)
- Theme is managed by `ThemeProvider` in `src/lib/useTheme.tsx`
- Dark mode configuration: `@custom-variant dark (&:where(.dark, .dark *))` in `src/styles.css`
- Common patterns:
  - Backgrounds: `bg-white dark:bg-slate-900` (page), `bg-gray-100 dark:bg-slate-800` (panels)
  - Primary text: `text-gray-900 dark:text-white`
  - Secondary text: `text-gray-600 dark:text-gray-400`
  - Borders: `border-gray-300 dark:border-slate-700`
  - Interactive elements: `hover:bg-gray-100 dark:hover:bg-gray-800`

### Development Tooling

- **Nix**: flake.nix provides Node.js 22, TypeSpec, and language servers
- **Biome**: Uses tabs for indentation, double quotes, excludes generated files
- **Devtools**: Integrated TanStack Router + Query + React devtools in root layout

## Reference Documentation

Additional reference docs are in `.claude/` - **read and update these when working on relevant topics**:

- **PROJECT.md** - DeckBelcher project overview, lexicon structure, and product decisions
- **SCRYFALL.md** - Scryfall card API reference (IDs, fields, image handling)
- **TYPELEX.md** - Typelex syntax guide (decorators, external refs, patterns)

These contain important context about project decisions, API details, and tooling. Keep them updated as the project evolves.

**When to create new reference docs:** If you're doing significant research, explaining complex topics repeatedly, or the user is spending time teaching you something important—create a new markdown file in `.claude/` to preserve that knowledge for future sessions.

## Important Notes

- **This is a TypeScript project** - ALL code (including scripts) must use TypeScript with proper types
- **Use `nix-shell -p <package>` for missing commands** - If a command isn't in PATH, use nix-shell to get it temporarily
- **Prefer functional style over exceptions** - Avoid throwing errors for control flow. Use type predicates, Option/Result patterns, and early returns instead. Throwing is like GOTO—it breaks local reasoning and makes code harder to follow
- **Avoid unnecessary try/catch blocks** - Don't wrap code in try/catch without a specific reason. It's not defensive coding—it's noisy and masks real errors. If a function can return null/undefined, use that instead of throwing. Let exceptions bubble naturally unless you have a specific recovery strategy
- **Check `typelex/*.tsp` for DeckBelcher data models** - When confused about deck structure or app schemas, read the `.tsp` files. For card data, see `src/lib/scryfall-types.ts`
- **NEVER use `-f` flag with rm/git/etc without justification** - Force flags suppress errors and can hide problems. Use `rm -r` not `rm -rf`, let commands fail naturally
- **ALWAYS run `npm run check` and `npm run typecheck` before considering work complete** - Verify linting, formatting, and types pass
- **NEVER manually fix formatting issues** - Always use `npm run format -- --write` to apply formatting fixes automatically. Manual formatting edits are error-prone and waste time
- `src/routeTree.gen.ts` is auto-generated - never edit manually
- `typelex/externals.tsp` is auto-generated from lexicons folder - add external lexicon JSON to trigger regeneration
- Biome only lints files in `src/`, `.vscode/`, and root config files
- Router uses "intent" preloading by default
- SSR is configured via TanStack Start plugin
- **ALWAYS use `<Link to="...">` from `@tanstack/react-router` instead of `<a href="...">`** - Using `<a>` tags causes full page reloads, which recreates the router and QueryClient instances on every navigation. This breaks TanStack Query's cache and causes expensive data (like the 163MB cards.json) to be refetched unnecessarily
