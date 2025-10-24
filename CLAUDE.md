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

### Typelex/Lexicons

- **Source**: `typelex/*.tsp` - TypeSpec definitions for AT Protocol lexicons
- **Generated**: `lexicons/com/deckbelcher/**/*.json` - Compiled lexicon schemas
- Run `npm run build:typelex` after modifying `.tsp` files
- Lexicons follow AT Protocol conventions (used for ATProto/Bluesky integrations)

### Styling

Tailwind CSS v4 is integrated via `@tailwindcss/vite` plugin. Global styles in `src/styles.css`.

### Development Tooling

- **Nix**: flake.nix provides Node.js 22, TypeSpec, and language servers
- **Biome**: Uses tabs for indentation, double quotes, excludes generated files
- **Devtools**: Integrated TanStack Router + Query + React devtools in root layout

## Important Notes

- `src/routeTree.gen.ts` is auto-generated - never edit manually
- Demo files (prefixed with `demo`) are safe to delete
- Biome only lints files in `src/`, `.vscode/`, and root config files
- Router uses "intent" preloading by default
- SSR is configured via TanStack Start plugin
