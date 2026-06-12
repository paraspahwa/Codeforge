# @codeforge/ui

Shared React component library for CodeForge web and desktop clients. Components use `@codeforge/design-tokens` CSS variables (`--cf-*`) and ship with base styles in `styles.css`.

## Installation

The package is a workspace dependency. Add it to an app `package.json`:

```json
"@codeforge/ui": "*"
```

Import styles once at the app entry (before app-specific CSS):

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

Web (`apps/web/app/globals.css`) and desktop (`apps/desktop/src/styles.css`) follow this pattern.

## Exports

| Export | Components |
| --- | --- |
| `.` | `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Panel`, `Card`, `Divider`, `Badge`, `Tabs`, `EmptyState`, `Skeleton`, `Banner`, `Toast`, `ToastStack`, `CodeBlock`, `ChatMessageList` |
| `./styles.css` | Base component styles (`.cf-btn`, `.cf-markdown-body`, chat bubbles, etc.) |

All interactive components are plain React elements with no Next.js or Tauri dependencies.

## Component notes

### ChatMessageList

Renders a scrollable message log with GFM markdown and syntax-highlighted fenced code blocks (`highlight.js` via `CodeBlock`).

Props:

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `messages` | `{ role, content, message_id? }[]` | required | Session messages |
| `sessionId` | `string \| null` | — | When absent, shows empty-state copy |
| `streamingMessageId` | `string \| null` | — | Adds streaming cursor to the active assistant message |
| `variant` | `"web" \| "desktop" \| "replay"` | `"web"` | Layout and label presets |

Example:

```jsx
import { ChatMessageList } from "@codeforge/ui";

<ChatMessageList
  messages={messages}
  sessionId={sessionId}
  streamingMessageId={streamingMessageId}
  variant="web"
/>
```

### Button

Variants: `primary` (default), `ghost`, `danger`. Maps to `.cf-btn-*` classes.

### Toast / ToastStack

Presentational toast UI. Web and desktop apps wrap these in their own context providers (`apps/web/lib/toast-context.jsx`, `apps/desktop/src/toast-context.jsx`) for imperative `push(message, type)` APIs.

## Tailwind integration (web only)

`apps/web/tailwind.config.js` scans `packages/ui/src/**/*.{js,jsx}` and maps token colors to utilities (`cfprimary`, `cfsurface`, etc.). Prefer `--cf-*` variables in new CSS; use Tailwind utilities only where they simplify layout in the Next.js app.

## Adding a component

1. Add the component under `packages/ui/src/`.
2. Export it from `packages/ui/src/index.js`.
3. Add styles to `packages/ui/src/styles.css` using `--cf-*` tokens.
4. Import the component in web/desktop; avoid duplicating markup in app-specific files.
