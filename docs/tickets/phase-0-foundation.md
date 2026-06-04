# Phase 0 - Foundation

## Goal

Stabilize the shared backend and streaming contract so web, desktop, and terminal all use the same lifecycle.

## Status

- T0.1 standardize shared stream events: done
- T0.2 align session and message contracts: done
- T0.3 add environment config surface: done
- T0.4 add smoke validation: done

## Tickets

### T0.1 - Standardize shared stream events

- Define typed token, tool_call, tool_result, diff, approval_request, and complete events.
- Keep event payloads consistent across backend and shared client helpers.
- Acceptance: the web and terminal clients can render the same event stream.

### T0.2 - Align session and message contracts

- Keep sessions, messages, and usage logs on a shared contract surface.
- Reduce client-specific payload drift where practical.
- Acceptance: creating a session and sending a message works from all current clients.

### T0.3 - Add environment config surface

- Document the required environment variables for model routing, billing, storage, and tracing.
- Keep local defaults explicit for development.
- Current state: README and PRD now spell out backend, web, desktop, and terminal runtime assumptions and the key local env vars.
- Acceptance: README and PRD mention the same runtime assumptions.

### T0.4 - Add smoke validation

- Add startup checks for backend, web, desktop, and terminal.
- Verify the app boots without startup errors before deeper feature work.
- Acceptance: each surface has a documented startup validation command.
