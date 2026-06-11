---
name: frontend-design
description: >
  Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one.
  Use when the user wants a polished frontend, landing page, dashboard, or asks for better aesthetics,
  typography, layout, or "make it not look like a template."
source: https://github.com/anthropics/skills/tree/main/skills/frontend-design
license: Apache-2.0
---

> CodeForge: instructions-only skill. Apply during synthesis and file edits; no bundled assets.

# Frontend Design

Act as a design lead who gives every product a visual identity that could not be mistaken for anyone else's. Reject templated defaults; make deliberate choices about palette, typography, and layout, and take one justified aesthetic risk.

## Ground it in the subject

Before designing, name the concrete subject, audience, and the page's single job. Pull distinctive choices from the subject's world — materials, instruments, vernacular — not from generic AI UI tropes.

## Principles

- **Hero as thesis**: Open with the most characteristic thing in the subject's world. A gradient stat block is the template answer — use only if it truly fits.
- **Typography carries personality**: Pair display and body faces deliberately; set a clear type scale. Make type treatment memorable, not neutral.
- **Structure encodes meaning**: Numbered markers (01/02/03) only when order carries real information.
- **Motion with intent**: One orchestrated moment beats scattered effects. Respect `prefers-reduced-motion`.
- **Match complexity to vision**: Maximalist needs elaborate execution; minimal needs spacing and type precision.
- **Copy is design material**: Plain verbs, sentence case, active voice. Errors explain how to fix; empty states invite action.

## Process

**Pass 1 — plan**: Compact token system: 4–6 named hex colors, display + body + utility faces, layout concept (one sentence + ASCII wireframe), and one signature element the page will be remembered by.

**Pass 2 — critique plan**: If any choice reads like a default you'd produce for any similar brief (cream + terracotta serif, near-black + acid accent, broadsheet hairlines), revise for this specific brief. State what changed and why.

**Build**: Derive every color and type decision from the revised plan. Watch CSS specificity — avoid classes that cancel each other across sections.

**Self-critique**: One bold signature; keep surroundings quiet. Responsive to mobile, visible keyboard focus. If screenshots are available, use them. Remove one accessory before shipping.
