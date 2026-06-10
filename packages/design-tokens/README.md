# @codeforge/design-tokens

Shared visual language for CodeForge clients: dark cyan/teal theme, spacing, typography, and semantic colors.

## Files

| File | Format | Use |
| --- | --- | --- |
| `tokens.css` | CSS custom properties on `:root` | Web and desktop stylesheets |
| `theme.json` | JSON color/font/radius map | Terminal Ink theme (`apps/terminal/src/inkTheme.js`) |

## CSS usage

Import once before app or UI package styles:

```css
@import "@codeforge/design-tokens/tokens.css";
```

### Token groups

- **Surfaces**: `--cf-bg`, `--cf-bg-elevated`, `--cf-surface`, `--cf-surface-elevated`, `--cf-surface-soft`
- **Text**: `--cf-text`, `--cf-muted`
- **Brand**: `--cf-primary`, `--cf-primary-hover`, `--cf-primary-soft`, `--cf-accent`, `--cf-accent-soft`
- **Semantic**: `--cf-success`, `--cf-warning`, `--cf-danger`
- **Chat bubbles**: `--cf-chat-user`, `--cf-chat-assistant` (+ border variants)
- **Routing/grants**: `--cf-routing-review`, `--cf-grant-view-only`
- **Typography**: `--cf-font-sans`, `--cf-font-mono`, `--cf-text-xs` … `--cf-text-2xl`
- **Layout**: `--cf-space-*`, `--cf-radius-*`, `--cf-shadow-*`, `--cf-transition-*`

Legacy aliases (`--primary`, `--surface`, `--muted`, etc.) map to `--cf-*` equivalents for incremental migration. Prefer `--cf-*` in new styles.

`prefers-reduced-motion: reduce` zeroes transition durations.

## JSON usage (terminal)

```js
import theme from "@codeforge/design-tokens/theme.json" assert { type: "json" };
```

`theme.json` exposes `colors`, `fonts`, and `radius` keys. Terminal maps these to Ink color names in `inkTheme.js`; keep JSON and CSS palettes aligned when changing brand colors.

## Consumers

| Client | Import |
| --- | --- |
| `apps/web` | `globals.css` → `tokens.css` + `@codeforge/ui/styles.css` |
| `apps/desktop` | `styles.css` → `tokens.css` + `@codeforge/ui/styles.css` |
| `apps/terminal` | `theme.json` via `inkTheme.js` |

VS Code extension uses its own `media/panel.css` and does not import this package yet.

## Changing tokens

1. Update `tokens.css` and mirror color changes in `theme.json`.
2. Rebuild or refresh web/desktop dev servers; terminal picks up JSON on restart.
3. Avoid hardcoded hex in client components — reference `--cf-*` or `theme.colors`.
