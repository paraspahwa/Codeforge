---
name: mcp-builder
description: >
  Guide for creating high-quality MCP servers that let LLMs call external APIs through well-designed tools.
  Use when building MCP servers in Python (FastMCP) or TypeScript (MCP SDK), or integrating a new service.
source: https://github.com/anthropics/skills/tree/main/skills/mcp-builder
license: Apache-2.0
---

> CodeForge: fetch MCP docs via web when needed; bundled `reference/*.md` files from upstream are not vendored here.

# MCP Server Development

Quality = how well agents accomplish real tasks with your tools.

## Phase 1 — Research

- Balance **API coverage** vs **workflow tools**; default to comprehensive coverage when unsure.
- **Naming**: consistent prefixes, action-oriented (`github_create_issue`, `github_list_repos`).
- **Context**: concise descriptions; paginate/filter large results.
- **Errors**: actionable messages with next steps.
- Read spec via `https://modelcontextprotocol.io/sitemap.xml` (fetch `.md` pages).
- **Stack**: TypeScript + streamable HTTP for remote; stdio for local. Python FastMCP is fine for internal tools.
- Load SDK READMEs from `modelcontextprotocol/typescript-sdk` or `python-sdk` on GitHub.

## Phase 2 — Implement

Shared utilities: auth client, error helpers, JSON/Markdown formatting, pagination.

Per tool:
- Input schema with Zod (TS) or Pydantic (Python); constraints + examples in field descriptions
- `outputSchema` / structured content when the SDK supports it
- Async I/O, pagination, read-only vs destructive hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`)

## Phase 3 — Test

- TS: `npm run build`, `npx @modelcontextprotocol/inspector`
- Python: `python -m py_compile`, MCP Inspector
- Checklist: DRY, typed, consistent errors, clear tool descriptions

## Phase 4 — Evaluations (optional)

Create ~10 independent, read-only, realistic questions requiring multiple tool calls with single verifiable answers. Solve each yourself before shipping.
