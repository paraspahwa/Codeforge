# @codeforge/design-tokens

Single source of truth for CodeForge visual identity across web, desktop, and terminal clients.

## Artifacts

| File | Format | Use case |
| --- | --- | --- |
| `tokens.css` | CSS custom properties (`--cf-*`) | Web and desktop stylesheets |
| `theme.json` | JSON color/font/radius map | Programmatic theming (Ink terminal) |

## CSS variables

Import in any client stylesheet:

```css
@import "@codeforge/design-tokens/tokens.css";
```

Key variable groups:

- **Surfaces**: `--cf-bg`, `--cf-bg-elevated`, `--cf-surface`, `--cf-surface-elevated`
- **Text**: `--cf-text`, `--cf-muted`
- **Brand**: `--cf-primary`, `--cf-primary-hover`, `--cf-accent`
- **Semantic**: `--cf-success`, `--cf-warning`, `--cf-danger`
- **Chat**: `--cf-chat-user`, `--cf-chat-assistant`, `--cf-routing-review`, `--cf-grant-view-only`
- **Typography**: `--cf-font-sans`, `--cf-font-mono`, `--cf-text-*` scale
- **Spacing**: `--cf-space-1` through `--cf-space-8`
- **Radius**: `--cf-radius-sm` through `--cf-radius-xl`

Legacy aliases (`--primary`, `--surface`, etc.) remain during migration but new code should use `--cf-*` names only.

## JSON theme

Terminal reads `theme.json` for Ink color mapping:

```js
import theme from "@codeforge/design-tokens/theme.json" assert { type: "json" };
```

See `apps/terminal/src/inkTheme.js` for the canonical mapping from JSON values to Ink color names.

## Tailwind bridge (web)

`apps/web/tailwind.config.js` exposes token variables as Tailwind color utilities (`cfbg`, `cfsurface`, `cfprimary`, etc.). When adding a new token, update both `tokens.css` and the Tailwind `extend.colors` block if the web app needs utility-class access.

## Adding or changing tokens

1. Update `tokens.css` with the new `--cf-*` variable.
2. Mirror core colors in `theme.json` if terminal or other JSON consumers need them.
3. Add Tailwind mappings in `apps/web/tailwind.config.js` when web utilities are required.
4. Use the variable in `@codeforge/ui` component styles or client-specific CSS — never duplicate hex values.

## Consumers

| Client | Consumption |
| --- | --- |
| Web | `tokens.css` via `globals.css`; Tailwind color bridge |
| Desktop | `tokens.css` via `styles.css` |
| Terminal | `theme.json` via `inkTheme.js` |
| VS Code | Panel CSS uses local styles; no direct token import yet |
