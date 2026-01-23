# Dark Mode Style Guide

## The Problem (Pre-January 2025)

Our dark mode was "very blue" and garish because:

1. **Slate is blue-tinted** - Tailwind's slate scale has a cool/blue undertone
2. **Cyan accent overload** - used for links, buttons, icons, focus states, everything
3. **Rainbow badge syndrome** - purple, indigo, rose, emerald, amber all fighting
4. **Inconsistent gray scales** - mixing `gray-` and `slate-` classes

## The Fix: Neutral Grays + Restrained Accent

Inspired by Discord and Linear's approach:
- True neutral backgrounds (zinc instead of slate)
- Single accent color (cyan) for primary actions only
- High contrast text (AAA compliant, 7.0+ ratio)
- Muted/semantic colors for badges and status
- Visible borders (zinc-600 for definition)

## Design Principles

**60-30-10 rule**: 60% background, 30% secondary/text, 10% accent. Don't overuse the accent color.

**Text contrast for AAA (7.0+)**:
- zinc-100 on zinc-900 = 16.12:1 ✓
- zinc-300 on zinc-900 = 11.99:1 ✓ (use for secondary text)
- zinc-400 on zinc-900 = 6.91:1 ✗ (below AAA, ok for muted/hints)
- zinc-500 on zinc-900 = 3.67:1 ✗ (placeholder text only)

**Saturated colors glow on dark**: Use 400-shade colors sparingly. Desaturate or use lighter tones for large areas.

**Borders matter more in dark mode**: Less visual differentiation between dark grays means borders need to be more visible (zinc-600 instead of zinc-700).

## Color Palette

### Backgrounds (zinc scale - true neutral)

| Use Case | Light | Dark |
|----------|-------|------|
| Page background | `bg-white` | `dark:bg-zinc-900` |
| Elevated surface (cards, panels) | `bg-gray-50` | `dark:bg-zinc-800` |
| Hover/active states | `bg-gray-100` | `dark:bg-zinc-700` |
| Input backgrounds | `bg-white` | `dark:bg-zinc-800` |
| Subtle dividers | `bg-gray-200` | `dark:bg-zinc-700` |

### Text

| Use Case | Light | Dark | Dark Contrast |
|----------|-------|------|---------------|
| Primary text | `text-gray-900` | `dark:text-zinc-100` | 16.12:1 ✓ AAA |
| Secondary text | `text-gray-600` | `dark:text-zinc-300` | 11.99:1 ✓ AAA |
| Muted/tertiary | `text-gray-500` | `dark:text-zinc-400` | 6.91:1 ✗ AA only |
| Placeholder | `text-gray-400` | `dark:text-zinc-500` | 3.67:1 ✗ decorative |

### Borders

| Use Case | Light | Dark |
|----------|-------|------|
| Default border | `border-gray-200` | `dark:border-zinc-600` |
| Subtle border | `border-gray-100` | `dark:border-zinc-700` |
| Strong border | `border-gray-300` | `dark:border-zinc-500` |
| Focus ring | `ring-cyan-500` | `dark:ring-cyan-400` |

### Accent Colors (Cyan)

**Light cyan needs dark text; dark cyan can use white text.**

Contrast ratios (calculated via WCAG formula):

| Shade | + White | + Gray-900 | Best Text |
|-------|---------|------------|-----------|
| cyan-400 (#22d3ee) | 1.81:1 ✗ | 9.82:1 ✓ AAA | dark |
| cyan-500 (#06b6d4) | 2.43:1 ✗ | 7.31:1 ✓ AAA | dark |
| cyan-600 (#0891b2) | 3.68:1 ✗ | 4.82:1 ✓ AA | dark |
| cyan-700 (#0e7490) | 5.36:1 ✓ AA | 3.31:1 ✗ | white |
| cyan-800 (#155e75) | 7.27:1 ✓ AAA | 2.44:1 ✗ | white |

| Use Case | Classes | Notes |
|----------|---------|-------|
| Primary button | `bg-cyan-400 hover:bg-cyan-300 text-gray-900` | Bright, AAA |
| Selected/active state | `bg-cyan-400 text-gray-900` | Bright, AAA |
| Inline card/mention ref | `bg-cyan-700 text-white` | Darker, AA |
| Link text | `text-cyan-600 dark:text-cyan-400` | Text only |
| Focus ring | `ring-cyan-500 dark:ring-cyan-400` | Decorative |
| Toggle switch (on) | `bg-cyan-600` | No text label |

### Status/Semantic Colors

Keep these muted in dark mode:

| Status | Light | Dark |
|--------|-------|------|
| Success | `text-green-600` / `bg-green-100` | `dark:text-green-400` / `dark:bg-green-900/30` |
| Warning | `text-amber-600` / `bg-amber-100` | `dark:text-amber-400` / `dark:bg-amber-900/30` |
| Error | `text-red-600` / `bg-red-100` | `dark:text-red-400` / `dark:bg-red-900/30` |
| Info | `text-blue-600` / `bg-blue-100` | `dark:text-blue-400` / `dark:bg-blue-900/30` |

### MTG-Specific

Rarity colors stay as-is (established MTG conventions):

```css
--color-rarity-common: #1a1718;
--color-rarity-uncommon: #707883;
--color-rarity-rare: #a58e4a;
--color-rarity-mythic: #bf4427;
--color-rarity-timeshifted: #652978;
```

For generic badges (set codes, format tags), prefer neutral styling:
- `bg-zinc-100 dark:bg-zinc-800`
- `border-zinc-200 dark:border-zinc-700`
- `text-zinc-600 dark:text-zinc-400`

## Component Patterns

### Cards/Panels

```tsx
<div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg p-4">
  <h3 className="text-gray-900 dark:text-zinc-100 font-medium">Title</h3>
  <p className="text-gray-600 dark:text-zinc-300 text-sm">Description</p>
</div>
```

### Buttons

```tsx
// Primary (cyan bg needs dark text for contrast)
<button className="bg-cyan-400 hover:bg-cyan-300 text-gray-900">
  Action
</button>

// Secondary
<button className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-100">
  Secondary
</button>

// Ghost
<button className="hover:bg-zinc-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400">
  Ghost
</button>
```

### Links

```tsx
<a className="text-cyan-600 dark:text-cyan-400 hover:underline">
  Link text
</a>
```

### Form Inputs

```tsx
<input className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400" />
```

## Checklist for New Components

- [ ] Uses `zinc-*` for dark backgrounds, not `slate-*`
- [ ] Primary accent is `cyan-*`
- [ ] Cyan backgrounds use dark text (`text-gray-900`), not white
- [ ] Primary text uses `zinc-100`, secondary uses `zinc-300` (AAA compliant)
- [ ] Colored badges only for semantic meaning (rarity, status)
- [ ] Borders use `zinc-600` for visibility
- [ ] Focus states use `cyan-*` ring

## Alternative Accent Colors Considered

If cyan doesn't work out, these were researched as alternatives:

| Color | Hex | Best For | Concerns |
|-------|-----|----------|----------|
| amber-400 | `#fbbf24` | Buttons, gaming/treasure feel | Can read as warning |
| amber-500 | `#f59e0b` | More muted gold | Needs dark text |
| rose-400 | `#fb7185` | Links and buttons both | Could conflict with error red |
| teal-400 | `#2dd4bf` | Warmer cyan alternative | Still cool-toned |

## References

- [Discord Color Palette](https://www.color-hex.com/color-palette/114089)
- [Linear UI Redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Tailwind Zinc Scale](https://tailwindcss.com/docs/customizing-colors)
- [Dark Mode Best Practices](https://appinventiv.com/blog/guide-on-designing-dark-mode-for-mobile-app/)
- [Yellow/Amber Accessibility](https://stephaniewalter.design/blog/yellow-purple-and-the-myth-of-accessibility-limits-color-palettes/)
- [USWDS Color Tokens](https://designsystem.digital.gov/design-tokens/color/theme-tokens/)
