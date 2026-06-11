# CodeForge Agent Skills

Project-scoped playbooks that shape how the agent communicates and works.

## Layout

```
.codeforge/skills/
  caveman/SKILL.md           # bundled token-saver mode (MIT)
  pr-conventions/SKILL.md    # CodeForge PR/commit style
  frontend-design/SKILL.md   # Anthropic (Apache-2.0), adapted
  webapp-testing/SKILL.md
  mcp-builder/SKILL.md
  skill-creator/SKILL.md
  doc-coauthoring/SKILL.md
  <your-skill>/SKILL.md      # project-specific; overrides bundled names
```

See `THIRD_PARTY_NOTICES.md` for upstream attribution.

Project skills in `{repo}/.codeforge/skills/` override bundled defaults with the same name.

## SKILL.md format

```markdown
---
name: my-skill
description: When to activate this skill.
---

Instructions for the agent...
```

## Token saver (caveman)

Enable in Settings → Token Saver, terminal `/caveman full`, or say "caveman mode" / "less tokens" in chat.

Levels: `off`, `lite`, `full`, `ultra`

Based on [caveman](https://github.com/JuliusBrussee/caveman) (MIT).

## Anthropic skills pack (Phase 10)

Enable in Settings → Token Saver → skill groups, or via `PUT /api/v1/agent/preferences`:

| Skill | Enable when |
|-------|-------------|
| `frontend-design` | Building distinctive UI, landing pages, or anti-template aesthetics |
| `webapp-testing` | Playwright verification, Cowork browser smoke tests |
| `mcp-builder` | Designing or implementing MCP servers |
| `skill-creator` | Authoring new `.codeforge/skills/*/SKILL.md` playbooks |
| `doc-coauthoring` | Proposals, specs, RFCs, decision documents |
| `pr-conventions` | CodeForge PR and commit style (always available) |

List available skills: `GET /api/v1/skills`. Detail: `GET /api/v1/skills/{name}`.

See [docs/tickets/phase-10-anthropic-skills.md](../../docs/tickets/phase-10-anthropic-skills.md).
