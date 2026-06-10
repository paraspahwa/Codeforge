# @codeforge/ui

Shared React UI primitives for CodeForge web and desktop clients.

## Setup

Add the workspace dependency and import base styles in the host app:

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

```json
{
  "dependencies": {
    "@codeforge/ui": "*",
    "@codeforge/design-tokens": "*"
  }
}
```

Peer dependencies: `react` and `react-dom` ^18.3.

## Usage

```jsx
import { Button, Panel, ChatMessageList } from "@codeforge/ui";

<Panel title="Sessions">
  <ChatMessageList
    variant="web"
    messages={messages}
    sessionId={sessionId}
    streamingMessageId={streamingId}
  />
  <Button onClick={onSend}>Send</Button>
</Panel>
```

## Exports

| Component | Notes |
| --- | --- |
| `Button`, `IconButton` | Primary/secondary/ghost variants |
| `Input`, `Textarea`, `Select` | Form controls with token styling |
| `Panel`, `Card`, `Divider` | Layout |
| `Badge` | Compact status labels |
| `Tabs` | Tab list + panel regions |
| `EmptyState` | Icon, title, description, optional action |
| `Skeleton` | Loading placeholder |
| `Banner` | Warning/info strips (routing review, grant notices) |
| `Toast`, `ToastStack` | Low-level toast markup; apps typically wrap with a context provider |
| `CodeBlock` | Fenced code with highlight.js |
| `ChatMessageList` | GFM markdown chat log; `variant` is `web` or `desktop` |

## Conventions

- Components use `--cf-*` CSS variables from `@codeforge/design-tokens`. Do not hardcode hex colors in new components.
- `ChatMessageList` depends on `react-markdown`, `remark-gfm`, and `highlight.js` (bundled as dependencies).
- Web Tailwind scans `packages/ui/src/**` for class names; prefer semantic classes defined in `styles.css` for cross-client reuse.

See [docs/frontend-architecture.md](../../docs/frontend-architecture.md) for how web and desktop compose these pieces.
