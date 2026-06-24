# Third-party agent skills

## Anthropic skills (Apache-2.0)

The following bundled skills are adapted from [anthropics/skills](https://github.com/anthropics/skills):

| Skill | Upstream path |
|-------|----------------|
| `frontend-design` | `skills/frontend-design` |
| `webapp-testing` | `skills/webapp-testing` |
| `mcp-builder` | `skills/mcp-builder` |
| `skill-creator` | `skills/skill-creator` |
| `doc-coauthoring` | `skills/doc-coauthoring` |

Adaptations for CodeForge:

- Instructions-only: `SKILL.md` body is injected into agent synthesis; bundled `scripts/`, `references/`, and `assets/` from upstream are **not** vendored.
- Content condensed to fit injection limits and CodeForge tooling (repo file edits, Cowork browser, sandbox shell).
- Artifact/sub-agent flows replaced with repo markdown and user-driven reader testing where applicable.

Full license text: https://github.com/anthropics/skills/blob/main/LICENSE

## caveman (MIT)

See `caveman/SKILL.md` — adapted from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman).

## Agent Reach (MIT)

The `agent-reach` skill is adapted from [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach).

- Instructions-only: upstream `agent_reach/` Python package and install scripts are **not** vendored.
- CodeForge adds server-native MCP tools (`fetch_web`, `youtube_transcript`, `rss_read`, `github_repo`) in `services/api/app/agent_reach_service.py`.
- Full local install (`pipx install agent-reach`) remains optional for social/cookie channels.

Full license text: https://github.com/Panniantong/Agent-Reach/blob/main/LICENSE

## CodeForge-native

`pr-conventions` and other project-specific skills in this directory are maintained in-repo.
