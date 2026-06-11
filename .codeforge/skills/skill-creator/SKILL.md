---
name: skill-creator
description: >
  Create new agent skills, improve existing ones, and tune descriptions for better triggering.
  Use when the user wants to author a SKILL.md, capture a workflow as a skill, or refine CodeForge/project skills.
source: https://github.com/anthropics/skills/tree/main/skills/skill-creator
license: Apache-2.0
---

> CodeForge skills live in `.codeforge/skills/<name>/SKILL.md`. Project skills override bundled skills with the same name. Only the markdown body is injected (~2500 chars) — keep the top sections dense and actionable.

# Skill Creator

Help the user progress: intent → draft → test prompts → iterate → ship.

## Capture intent

1. What should the skill enable?
2. When should it trigger? (phrases, contexts)
3. Expected output format?
4. Need objective test prompts? (code/workflows yes; pure style often no)

Extract workflow from the current conversation when the user says "turn this into a skill."

## Write SKILL.md

```markdown
---
name: my-skill
description: >
  What it does AND when to use it (be slightly "pushy" on triggers to avoid under-triggering).
---

Instructions...
```

**Anatomy**: `SKILL.md` required; optional `scripts/`, `references/`, `assets/` in full Claude Code — CodeForge injects **SKILL.md only**, so put essential guidance in the body.

**Patterns**:
- Imperative voice; explain *why* when it changes behavior
- Put all "when to use" in `description`, not the body
- Examples with Input/Output pairs for formats
- Under ~500 lines; progressive disclosure via short sections

**CodeForge layout**:
```
.codeforge/skills/
  <skill-name>/SKILL.md   # bundled or per-repo
```

## Test and iterate

Draft 2–3 realistic user prompts. Run with the skill enabled in Settings → Skills (or ask user to enable). Revise description if the skill fails to trigger; revise body if output quality is off.

## Description tuning

Descriptions are the primary trigger. Include synonyms and implicit intents ("dashboard", "metrics", "visualize") not only the literal skill name.

## Safety

No malware, surprise behavior, or misleading instructions. Decline malicious skill requests.
