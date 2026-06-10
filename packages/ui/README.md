# @codeforge/ui

Shared React component library for CodeForge web and desktop clients. Components are styled with `@codeforge/design-tokens` CSS variables and ship with a companion stylesheet.

## Installation

The package is a workspace dependency. Add it to a client `package.json`:

```json
{
  "dependencies": {
    "@codeforge/ui": "*",
    "@codeforge/design-tokens": "*"
  }
}
```

Import styles once at the app entry (before client-specific CSS):

```css
@import "@codeforge/design-tokens/tokens.css";
@import "@codeforge/ui/styles.css";
```

Web (`apps/web/app/globals.css`) and desktop (`apps/desktop/src/styles.css`) already follow this pattern.

## Usage

```jsx
import { Button, Panel, ChatMessageList } from "@codeforge/ui";

<Panel title="Session">
  <ChatMessageList
    messages={messages}
    sessionId={sessionId}
    streamingMessageId={streamingId}
    variant="web"
  />
  <Button onClick={handleSend}>Send</Button>
</Panel>
```

## Exports

| Export | Purpose |
| --- | --- |
| `Button`, `IconButton` | Primary, ghost, and danger button variants |
| `Input`, `Textarea`, `Select` | Form controls with token-based styling |
| `Panel`, `Card`, `Divider` | Layout containers and separators |
| `Badge` | Status and count labels |
| `Tabs` | Tabbed panel navigation |
| `EmptyState` | Placeholder for empty lists and panels |
| `Skeleton` | Loading placeholders |
| `Banner` | Inline alerts (info, warning, danger) |
| `Toast`, `ToastStack` | Transient notifications (used via app-level providers) |
| `CodeBlock` | Syntax-highlighted fenced code (highlight.js) |
| `ChatMessageList` | Markdown chat log with streaming cursor support |

Stylesheet entry: `@codeforge/ui/styles.css`.

## ChatMessageList

Renders a scrollable message log with GFM markdown and fenced-code highlighting. Accepts a `variant` prop:

- `web` (default) — div-based layout with `msg` / `msg-active` classes
- `desktop` — article-based bubbles with `chat-bubble` classes

Required props: `messages` (array of `{ role, content }`), `sessionId`. Optional: `streamingMessageId` for the in-progress assistant message, `chatEndRef` for auto-scroll anchoring.

## Tailwind integration (web only)

`apps/web/tailwind.config.js` scans `packages/ui/src/**/*.{js,jsx}` and maps token variables to utility classes (`cfbg`, `cfprimary`, `cfaccent`, etc.). Prefer `--cf-*` CSS variables in shared components; use Tailwind utilities in web-only layout code.

## Conventions

- Components use the `cf-` class prefix defined in `styles.css`.
- All colors, spacing, and radii come from design tokens — do not hardcode hex values in new components.
- Peer dependency: React 18.3+.
- `ChatMessageList` and `CodeBlock` depend on `react-markdown`, `remark-gfm`, and `highlight.js` (bundled as package dependencies).

## Consumers

| Client | Import path | Notes |
| --- | --- | --- |
| Web | `@codeforge/ui` | Chat page, login, billing, team, settings, sessions |
| Desktop | `@codeforge/ui` | Code workspace chat log (`variant="desktop"`) |

Terminal and VS Code do not use this package; they consume `@codeforge/design-tokens/theme.json` directly for Ink/VS Code theming.
