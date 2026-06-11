# Phase 7 - Taste (Coding Preferences)

## Goal

Close the "slop over taste" loop by learning from proposal accept/reject/edit feedback and injecting personal + team constraints into agent prompts.

## Status

- T7.1 Taste event capture on proposal decisions: **done (API)**
- T7.2 Heuristic rule distillation from feedback: **done (API)**
- T7.3 Taste context injection in session stream: **done (API)**
- T7.4 Taste stats + export/import API: **done (API)**
- T7.5 Client surfaces (`/taste` terminal, web settings): **done (terminal + web)**
- T7.6 Agent Skills playbooks (`.codeforge/skills/`): **done (API + bundled caveman + settings/terminal)**

## Architecture

```
[User approves/rejects proposal]
        │
        ▼
[taste_events] ──► heuristic distill ──► [taste_rules]
        │                                      │
        └──────── compose_taste_context ◄──────┘
                      │
                      ▼
        [team style guides] + personal rules
                      │
                      ▼
              agent stream prompt
```

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/taste/rules` | Active rules + rendered `taste.md` |
| `GET /api/v1/taste/stats` | Rejections/approvals per session metrics |
| `GET /api/v1/taste/export` | Export taste pack for team sync |
| `POST /api/v1/taste/import` | Import taste pack |

Proposal decisions accept optional fields:

- `note` — free-text preference on reject/approve
- `edited_content` — user-edited content applied on approve

## Tickets

### T7.5 - Client surfaces

- Terminal: `/taste stats`, `/taste rules`, `/taste export`
- Web: settings panel showing active rules and correction trend
- Acceptance: user can inspect taste without curl

### T7.6 - Agent Skills

- Project-scoped `.codeforge/skills/` markdown playbooks
- Bundled `caveman` token-saver skill (MIT, [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman))
- `GET/PUT /api/v1/agent/preferences` for `caveman_mode` + `enabled_skills`
- Web Settings → Token Saver; terminal `/caveman off|lite|full|ultra|status|skills`
- Acceptance: caveman instructions injected into synthesis system prompt; code patches unchanged

## Success Metrics

- `avg_rejections_per_session` trends down over repeated use
- `active_rules` grows from proposal feedback without manual entry
- Team import increases cross-member style alignment
