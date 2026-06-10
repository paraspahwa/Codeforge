# @codeforge/design-tokens

Single source of truth for CodeForge visual tokens (cyan/teal dark theme).

## Exports

| Path | Format | Consumers |
| --- | --- | --- |
| `@codeforge/design-tokens/tokens.css` | CSS custom properties (`--cf-*`) | Web, desktop stylesheets |
| `@codeforge/design-tokens/theme.json` | JSON color/font/radius map | Terminal Ink theme |

## CSS usage

```css
@import "@codeforge/design-tokens/tokens.css";

.my-panel {
  background: var(--cf-surface);
  color: var(--cf-text);
  border: 1px solid var(--cf-border);
  border-radius: var(--cf-radius-md);
}
```

Legacy aliases (`--primary`, `--surface`, `--text`, etc.) map to `--cf-*` equivalents for older styles during migration. New code should use `--cf-*` only.

### Token groups

- **Surfaces**: `--cf-bg`, `--cf-bg-elevated`, `--cf-surface`, `--cf-surface-elevated`, `--cf-surface-soft`
- **Text**: `--cf-text`, `--cf-muted`
- **Brand**: `--cf-primary`, `--cf-primary-hover`, `--cf-accent`
- **Semantic**: `--cf-success`, `--cf-warning`, `--cf-danger`
- **Chat**: `--cf-chat-user`, `--cf-chat-assistant`, `--cf-routing-review`, `--cf-grant-view-only`
- **Typography / spacing / radius**: `--cf-font-*`, `--cf-text-*`, `--cf-space-*`, `--cf-radius-*`

## JSON usage (terminal)

```js
import theme from "@codeforge/design-tokens/theme.json" assert { type: "json" };
```

`apps/terminal/src/inkTheme.js` maps JSON hex values to Ink named colors where needed.

## Web Tailwind bridge

`apps/web/tailwind.config.js` exposes token-backed utilities (`cfbg`, `cfprimary`, etc.). Add new Tailwind colors only after the underlying `--cf-*` variable exists in `tokens.css`.

When changing brand colors, update **both** `tokens.css` and `theme.json` so CSS and terminal clients stay aligned.
