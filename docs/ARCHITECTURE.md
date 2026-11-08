# Sightline Architecture

## Design principle

**Deterministic software before AI. DOM before vision.**

Sightline separates observation, reasoning, execution, verification, safety, site skills, persistence, and diagnostics so model output never directly controls the browser.

## Main flow

```text
User goal
   |
   v
Side panel
   |
   v
Task runner
   |
   +--> Semantic observer --> bounded snapshot
   |                          |
   |                          v
   |                     Local planner
   |                          |
   |          +---------------+---------------+
   |          |                               |
   |          v                               v
   |     Typed action                   Vision fallback
   |          |                         (bounded/local)
   |          +---------------+---------------+
   |                          |
   v                          v
Safety / site policy --> deterministic executor
                              |
                              v
                      live re-observation
                              |
                              v
                     verification / recovery
                              |
                              v
                        complete / re-plan
```

## Components

### Semantic observer

- visible controls
- accessible names/roles
- bounded visible text
- state (checked/disabled/read-only/etc.)
- value lengths, not raw textbox values
- same-origin iframe traversal
- opaque cross-origin frame reporting
- stable semantic snapshot identity
- hard size/count budgets

### Planner

Ollama JSON-only planner.

Planner output may be:
- completion
- one typed action
- bounded request for visual fallback

No JavaScript/selectors/shell commands are accepted from the model.

### Action protocol

Supported primitives are validated before execution:
- read
- click
- type
- clear
- select
- check/uncheck
- scroll
- navigate
- press key
- wait
- verify

### Executor

Resolves current semantic refs and operates DOM controls deterministically.

The page is re-observed immediately before execution to reject stale plans.

### Safety gate

Classifies:
- sensitive fields
- destructive controls
- irreversible deletion
- cross-origin navigation/link activation
- Observe-mode mutation
- site-specific destructive scope

### Recovery

- stale snapshot/ref re-plan
- task timeout
- action ceiling
- repeated-state stall
- repeated-action stall
- planner timeout
- malformed JSON one-repair limit
- closed-tab resume cleanup
- unapproved-origin stop

### Site skills

Yahoo Mail is the first site skill.

Site-specific logic stays outside the generic executor.

### Persistence

`chrome.storage.session` stores a bounded sanitized checkpoint:
- task ID
- goal
- mode/model
- action count
- vision-fallback count
- task tab ID
- task origin only
- bounded sanitized action history

It does not store typed action payloads or screenshots.

Writes/clears are serialized and revisioned to prevent cancellation races.

### Diagnostics

In-memory bounded ledger + timing summaries.

Exported reports contain sanitized evidence rather than raw action payloads.

## Trust boundaries

- webpage content: untrusted
- screenshots: untrusted
- model output: untrusted
- typed action validator: trusted
- executor/safety policy: trusted
- user confirmation: trusted but revalidated against live page state

## Current deployment

Manifest V3 Chrome/Edge extension with a side panel and local Ollama loopback API.

A future Windows companion is a later roadmap phase and is not required for browser-page automation.
