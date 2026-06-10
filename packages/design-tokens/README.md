# @codeforge/design-tokens

Shared visual tokens for CodeForge clients. Single source for the cyan/teal dark theme.

## Exports

| Path | Format | Consumers |
| --- | --- | --- |
| `@codeforge/design-tokens/tokens.css` | CSS custom properties | Web, desktop |
| `@codeforge/design-tokens/theme.json` | JSON color/font/radius map | Terminal (Ink) |

## CSS variables

Import at the top of app global styles:

```css
@import "@codeforge/design-tokens/tokens.css";
```

Key namespaces (all prefixed `--cf-`):

| Token group | Examples | Usage |
| --- | --- | --- |
| Surfaces | `--cf-bg`, `--cf-surface`, `--cf-border` | Page and panel backgrounds |
| Text | `--cf-text`, `--cf-muted` | Body and secondary copy |
| Brand | `--cf-primary`, `--cf-accent` | Buttons, links, focus rings |
| Status | `--cf-success`, `--cf-warning`, `--cf-danger` | Alerts, badges |
| Chat | `--cf-chat-user`, `--cf-chat-assistant` | Message bubble fills |
| Routing/grants | `--cf-routing-review`, `--cf-grant-view-only` | Confidence and view-only banners |
| Typography | `--cf-font-sans`, `--cf-font-mono`, `--cf-text-sm` | Font stacks and scale |
| Spacing/radius | `--cf-space-*`, `--cf-radius-*` | Layout rhythm |

Legacy aliases (`--primary`, `--surface`, etc.) map to `--cf-*` equivalents for gradual migration. Prefer `--cf-*` in new CSS.

## theme.json (non-CSS clients)

```js
import theme from "@codeforge/design-tokens/theme.json" assert { type: "json" };
```

Used by `apps/terminal/src/inkTheme.js` to paint Ink components. When changing brand colors, update **both** `tokens.css` and `theme.json` so terminal and web/desktop stay aligned.

## Web fonts

Web loads Inter and JetBrains Mono via `next/font` in `app/layout.jsx`, setting `--font-inter` and `--font-mono` on `<html>`. Token font stacks reference the same families.

## Adding a token

1. Add the CSS variable to `tokens.css` under `:root`.
2. If terminal needs it, add the matching key to `theme.json` `colors` or `radius`.
3. Use the variable in `@codeforge/ui` or app CSS — avoid hardcoded hex in components.
