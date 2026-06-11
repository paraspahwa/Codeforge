---
name: doc-coauthoring
description: >
  Structured workflow for co-authoring documentation, proposals, specs, RFCs, and decision docs.
  Use when the user says "write a doc", "draft a proposal", "create a spec", "PRD", or "design doc."
source: https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring
license: Apache-2.0
---

> CodeForge: create and edit markdown files in the repo (no Claude artifacts or sub-agents). Use surgical file edits, not full reprints.

# Doc Co-Authoring Workflow

Offer three stages; if the user declines, work freeform.

## Stage 1 — Context gathering

Ask meta-context:
1. Document type?
2. Primary audience?
3. Desired impact when read?
4. Template or format constraints?

Encourage an info dump (background, alternatives rejected, stakeholders, timeline, architecture). Ask 5–10 numbered clarifying questions on gaps. Exit when edge cases and trade-offs can be discussed without basics.

## Stage 2 — Refinement and structure

Build section by section:
1. Clarifying questions (5–10)
2. Brainstorm 5–20 inclusion options
3. User curates (keep/remove/combine)
4. Draft section into the repo file
5. Iterate with targeted edits only

Start with the section with most unknowns (core decision or technical approach); summaries last.

**Scaffold**: Create `docs/<name>.md` with headers and `[To be written]` placeholders. Replace placeholders per section via incremental edits.

**User instruction**: Ask them to describe changes ("remove bullet 3 — duplicates 1") rather than silently editing, so you learn their style.

After ~3 stable iterations on a section, ask what can be cut without losing meaning.

## Stage 3 — Reader testing

Predict 5–10 questions a new reader would ask. Without sub-agents, ask the user to paste the doc into a fresh chat and quiz it, or you simulate a cold reader: answer each question from the doc only, flag ambiguity, assumed knowledge, and contradictions. Loop back to refine weak sections.

## Final review

User owns the doc. Suggest fact/link check, appendix for depth, and linking this conversation if useful for provenance.
