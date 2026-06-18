# Phase 9 — ScrapeGraphAI Cowork extraction

## Overview

Integrates [ScrapeGraphAI](https://github.com/ScrapeGraphAI/Scrapegraph-ai) as an optional Cowork task for natural-language extraction from URLs and local documents. Output feeds **project knowledge** (Qdrant) and **agent memory** (Phase 8).

## API

- `POST /api/v1/cowork/scrape` — one-shot scrape with approval flag
- `POST /api/v1/cowork/plans` with `task_type: "scrape"` — preview + run flow

### Request fields

| Field | Description |
|-------|-------------|
| `scrape_prompt` | What to extract (natural language) |
| `url` | HTTP(S) page to scrape |
| `source_path` | Workspace-relative file (HTML, JSON, MD, etc.) |
| `approved` | Required `true` to execute (approval gate) |
| `ingest_knowledge` | Push excerpt into session knowledge (default true) |
| `ingest_memory` | Push excerpt into agent memory (default true) |

## Configuration

```env
OPENAI_API_KEY=...              # required for SmartScraperGraph
CODEFORGE_SCRAPE_ENABLED=true
CODEFORGE_SCRAPE_MODEL=         # optional, defaults to CODEFORGE_SYNTHESIS_MODEL
CODEFORGE_SCRAPE_VERBOSE=false
```

## Clients

- Terminal: `/cowork scrape <url> --prompt <text> [--approve]`
- Terminal: `/cowork scrape file <path> --prompt <text> [--approve]`
- Web: Cowork → **Scrape (ScrapeGraphAI)** plan type or **Quick scrape** on Extractions tab
- Desktop: Cowork workspace → scrape UI (URL + prompt + approve)

## Guardrails

- Approval required (same as browser tasks)
- URL validation (http/https only)
- Local `source_path` must stay inside project workspace
- Scheduled jobs cannot run scrape tasks
- httpx fallback excerpt when ScrapeGraphAI fails on URLs only

## Tests

- `services/api/tests/test_scrape.py`
