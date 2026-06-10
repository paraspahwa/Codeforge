# @codeforge/ui

Shared React UI primitives for CodeForge web and desktop clients.

## Setup

Add the workspace dependency (already wired in `apps/web` and `apps/desktop`):

```json
"@codeforge/ui": "*"
```

Import styles once at the app root (before app-specific CSS):

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

Components assume React 18.3+.

## Exports

```js
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Panel,
  Card,
  Divider,
  Badge,
  Tabs,
  EmptyState,
  Skeleton,
  Banner,
  Toast,
  ToastStack,
  CodeBlock,
  ChatMessageList,
} from "@codeforge/ui";
```

Styles-only import:

```js
import "@codeforge/ui/styles.css";
```

## Components

| Component | Notes |
| --- | --- |
| `Button` | `variant`: `primary` (default), `ghost`, `danger` |
| `IconButton` | Ghost-styled icon button |
| `Input`, `Textarea`, `Select` | Form controls using `--cf-*` tokens |
| `Panel`, `Card`, `Divider` | Layout surfaces |
| `Badge` | Status chips (used in `AppShell` for usage/grants) |
| `Tabs` | Controlled tab list; pass `tabs` and `active` / `onChange` |
| `EmptyState` | Title + description for zero-data views |
| `Skeleton` | Loading placeholder blocks |
| `Banner` | Inline alert strip |
| `Toast`, `ToastStack` | Presentational toast markup (apps use local `ToastProvider` contexts) |
| `CodeBlock` | Syntax-highlighted fenced code (highlight.js) |
| `ChatMessageList` | Markdown message log with streaming cursor support |

### ChatMessageList

Primary chat renderer for web and desktop code modes.

```jsx
<ChatMessageList
  variant="web"          // or "desktop"
  messages={messages}
  sessionId={sessionId}
  streamingMessageId={streamingMessageId}
/>
```

`variant` controls DOM structure and CSS class names (`msg` vs `chat-bubble`). Both variants render GFM markdown and route fenced blocks through `CodeBlock`.

## Conventions

- Class names are prefixed with `cf-` (e.g. `cf-btn`, `cf-markdown-body`).
- Do not hardcode colors; use `--cf-*` variables from design tokens.
- New primitives belong here when **two or more** clients need the same markup. App-specific layout (e.g. `ChatLayout`, `WorkflowDrawer`) stays in `apps/web/components`.

## Local development

No separate build step. Vite/Next resolve the package through the root npm workspace. After adding a new export, update `src/index.js`.
