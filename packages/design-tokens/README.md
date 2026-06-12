# @codeforge/design-tokens

Single source of truth for CodeForge visual tokens across web, desktop, and terminal clients.

## Files

| File | Purpose |
| --- | --- |
| `tokens.css` | CSS custom properties (`--cf-*`) and legacy aliases (`--primary`, `--text`, etc.) |
| `theme.json` | JSON color/font/radius map for non-CSS consumers (e.g. Ink terminal) |

## Consumption

### CSS (web + desktop)

Import once before app or UI styles:

```css
@import "@codeforge/design-tokens/tokens.css";
```

Web and desktop entry points:

- `apps/web/app/globals.css`
- `apps/desktop/src/styles.css`

Use `--cf-*` variables in all new styles. Legacy aliases remain during migration but should not be used in new code.

### JSON (terminal)

The Ink client reads `theme.json` for pane colors:

```js
import theme from "@codeforge/design-tokens/theme.json" assert { type: "json" };
```

See `apps/terminal/src/inkTheme.js`.

## Token groups

### Colors

| Variable | Role |
| --- | --- |
| `--cf-bg`, `--cf-bg-elevated` | Page backgrounds |
| `--cf-surface`, `--cf-surface-elevated`, `--cf-surface-soft` | Panels and cards |
| `--cf-border`, `--cf-border-strong` | Dividers and outlines |
| `--cf-text`, `--cf-muted` | Body and secondary text |
| `--cf-primary`, `--cf-primary-hover`, `--cf-primary-soft` | Brand / actions |
| `--cf-accent`, `--cf-accent-soft` | Highlights |
| `--cf-success`, `--cf-warning`, `--cf-danger` | Status |
| `--cf-chat-user`, `--cf-chat-assistant` (+ borders) | Message bubbles |
| `--cf-routing-review`, `--cf-grant-view-only` | Routing banner and view-only grant badge |

### Typography and spacing

| Variable | Role |
| --- | --- |
| `--cf-font-sans`, `--cf-font-mono` | Font stacks |
| `--cf-text-xs` … `--cf-text-2xl` | Type scale |
| `--cf-space-1` … `--cf-space-8` | Spacing scale |
| `--cf-radius-sm` … `--cf-radius-xl` | Border radii |
| `--cf-shadow-glow` | Focus / accent glow |
| `--cf-gradient-bg` | Default page gradient |

Full list: `tokens.css`.

## Tailwind bridge (web)

`apps/web/tailwind.config.js` maps select tokens to utilities (`cfprimary`, `cfsurface`, `cfbg`, etc.). When adding a token used in Tailwind classes, extend both `tokens.css` and the Tailwind `theme.extend` block.

## Changing the theme

1. Update `tokens.css` and keep `theme.json` in sync for colors/fonts/radius.
2. Rebuild or refresh web/desktop dev servers; no package publish step (workspace link).
3. Terminal Ink theme picks up JSON changes on restart.
