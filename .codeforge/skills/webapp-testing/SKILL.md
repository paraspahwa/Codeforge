---
name: webapp-testing
description: >
  Toolkit for interacting with and testing local web applications using Playwright or CodeForge Cowork.
  Use when verifying frontend behavior, debugging UI, capturing screenshots, or validating flows end-to-end.
source: https://github.com/anthropics/skills/tree/main/skills/webapp-testing
license: Apache-2.0
---

> CodeForge: no bundled `scripts/` helpers. Start servers via docker compose or user-provided commands; use Cowork browser tasks when available.

# Web Application Testing

## CodeForge-first options

1. **Cowork browser task** — When the user approves Cowork, prefer a `browser` or UI verification plan that navigates the running app, captures screenshots, and reports DOM/console findings.
2. **Sandbox Playwright** — Write native Python Playwright scripts the agent can run in the project sandbox.
3. **Static HTML** — Read the HTML file directly for selectors before scripting.

## Decision tree

```
Task → static HTML only?
  ├─ Yes → read file, pick selectors, script if needed
  └─ No → server running?
        ├─ No → ask user to start dev server (or docker compose up) then script
        └─ Yes → reconnaissance then action
```

## Reconnaissance-then-action

1. `page.goto(url)` then `page.wait_for_load_state('networkidle')` on dynamic apps
2. Screenshot + inspect DOM (`page.content()`, `page.locator(...).all()`)
3. Choose selectors from rendered state
4. Execute actions; add `wait_for_selector` where needed

## Playwright skeleton

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    # ... automation ...
    browser.close()
```

## Pitfalls

- Do not inspect DOM before `networkidle` on SPAs
- Prefer `text=`, `role=`, stable IDs over brittle CSS
- Always close the browser
- Log console errors when debugging regressions
