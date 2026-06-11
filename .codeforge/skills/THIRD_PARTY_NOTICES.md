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

## CodeForge-native

`pr-conventions` and other project-specific skills in this directory are maintained in-repo.
