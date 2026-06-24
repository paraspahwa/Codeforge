# CodeForge design tokens

Shared CSS variables for marketing and product surfaces.

## Usage

```css
@import "@codeforge/design-tokens/tokens.css";
```

In this repo, `apps/web/app/styles/base.css` imports tokens; prefer `var(--cf-*)` for new styles.

## Layout scale

| Token | Value |
|-------|-------|
| `--cf-space-4` | 1rem base spacing |
| Sidebar (app) | 260px (`app-shell.css`) |
| App page max-width | 1080px (`base.css` `main:not(.marketing-main)`) |

## Motion

- `--cf-transition-fast` / `--cf-transition-base` — disabled when `prefers-reduced-motion: reduce`.

## Theme color

PWA / mobile status bar: `#0891b2` (`--cf-primary`) in `apps/web/app/layout.jsx`.
