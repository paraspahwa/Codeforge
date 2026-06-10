# @codeforge/ui

Shared React component library for CodeForge web and desktop clients. Components use `@codeforge/design-tokens` CSS variables (`--cf-*`) and ship with base styles in `styles.css`.

## Setup

Add the workspace dependency (already wired in `apps/web` and `apps/desktop`):

```json
{
  "dependencies": {
    "@codeforge/ui": "*"
  }
}
```

Import styles once at the app entry:

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

Requires React 18+ (`peerDependencies`).

## Exports

| Export | Description |
| --- | --- |
| `Button`, `IconButton` | Primary actions; `Button` `variant`: `primary` (default), `ghost`, `danger` |
| `Input`, `Textarea`, `Select` | Form controls with shared focus/border tokens |
| `Panel`, `Card`, `Divider` | Layout surfaces |
| `Badge` | Status chips (e.g. session grant level, routing tier) |
| `Tabs` | Tab list + panel switcher |
| `EmptyState` | Placeholder for empty lists or missing data |
| `Skeleton` | Loading placeholder blocks |
| `Banner` | Inline alerts; `variant`: `default`, `info`, `warning` |
| `Toast`, `ToastStack` | Transient notifications (web uses app-level `ToastProvider`) |
| `CodeBlock` | Syntax-highlighted fenced code (highlight.js) |
| `ChatMessageList` | Markdown chat log with streaming cursor support |

## ChatMessageList

Renders assistant/user messages with `react-markdown` + GFM. Pass `variant` to match surface styling:

```jsx
import { ChatMessageList } from "@codeforge/ui";

<ChatMessageList
  variant="web"          // or "desktop"
  messages={messages}
  sessionId={sessionId}
  streamingMessageId={streamingMessageId}
/>
```

- `messages`: array of `{ role, content, message_id? }`
- `streamingMessageId`: highlights the in-flight assistant message with a cursor
- Empty states differ by variant when `sessionId` is missing vs. when the session has no messages

## Styling conventions

- Prefer `--cf-*` tokens from design-tokens over hardcoded colors.
- Component classes use the `cf-` prefix (e.g. `cf-btn`, `cf-panel`).
- Legacy aliases (`--primary`, `--surface`) remain during migration; new code should use `--cf-primary`, `--cf-surface`, etc.

## Consumers

| App | Import path | Notes |
| --- | --- | --- |
| `apps/web` | `@codeforge/ui` | Chat page, billing, team, settings, login |
| `apps/desktop` | `@codeforge/ui` | Code workspace chat log |

Terminal and VS Code do not use this package (Ink and webview have separate styling).

## Adding a component

1. Add the component under `src/` and export it from `src/index.js`.
2. Add styles to `src/styles.css` using `--cf-*` variables.
3. Use the component in at least one client before exporting publicly.
