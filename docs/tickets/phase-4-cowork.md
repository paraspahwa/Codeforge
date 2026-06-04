# Phase 4 - Cowork Mode

## Goal

Expand the product from coding assistance into safe desktop automation.

## Status

- T4.1 cowork task runner: done, desktop now previews and runs shell/extract/browser cowork plans through backend APIs
- T4.2 watchers and scheduled jobs: done, recurring interval and file-change jobs can be created, toggled, and observed with completion notifications
- T4.3 OCR and extraction pipeline: done, desktop triggers extraction tasks and stores structured extraction entities/history for follow-up workflows
- T4.4 browser automation boundary: done, browser tasks require explicit approval before execution and all runs remain visible in cowork logs

## Tickets

### T4.1 - Cowork task runner

- Add a task-planning surface for non-coding operations.
- Keep tasks previewable before execution.
- Current state: desktop supports preview-first cowork plans across shell automation, extraction, and browser tasks, then manual run execution.
- Acceptance: the desktop app can plan and run a simple automation task.

### T4.2 - Watchers and scheduled jobs

- Add file watchers and recurring tasks.
- Keep notifications visible when jobs complete.
- Current state: cowork jobs support interval triggers or file-change triggers and push desktop notifications on fresh completed runs.
- Acceptance: repeatable automation can be triggered by schedule or filesystem events.

### T4.3 - OCR and extraction pipeline

- Add screenshot and document extraction flows.
- Store structured extraction results for follow-up tasks.
- Current state: extraction tasks support text files and optional image OCR via Tesseract when available, with entities persisted in extraction history.
- Acceptance: the app can extract text/data from images or screenshots.

### T4.4 - Browser automation boundary

- Integrate browser automation with clear user approval and visibility.
- Avoid hidden computer-use behavior.
- Current state: browser tasks are always created as preview plans first, require explicit approval, and are auditable through cowork run history.
- Acceptance: browser-driven tasks are explicit and observable.
