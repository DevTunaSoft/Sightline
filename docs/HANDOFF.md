# Sightline Engineering Handoff

Last updated: 2026-11-08

## Product

**Sightline 0.2.0-alpha**  
Tagline: **See. Understand. Act.**

Repository: DevTunaSoft/Sightline  
Active development branch: `develop`  
Integration branch: `main`

## Current engineering state

The generic browser-agent alpha feature set is **feature-frozen pending real-machine acceptance**.

The current public `develop` archive has completed the repository `npm run check` suite successfully after the feature freeze. The check suite now includes the release audit.

Do **not** interpret this as installed Chrome/Edge, live Ollama, or live Yahoo acceptance.

## Implemented foundation

### Observation
- Manifest V3 side panel
- bounded semantic DOM/accessibility snapshot
- 300-control cap
- 48 KB snapshot cap
- 8 KB visible-text cap
- sensitive-field redaction
- textbox values excluded from semantic names
- same-origin iframe traversal
- cross-origin iframe opacity/reporting
- semantic snapshot identity

### Execution
- strict typed action schema
- deterministic DOM executor
- same-origin iframe event realm handling
- live semantic revalidation immediately before actions
- stale snapshot/ref rejection and recovery
- post-action observation
- consequential-action semantic-effect verification

### Autonomous loop
- local Ollama JSON planner
- 90-second planner timeout
- one malformed-output repair retry
- max action/time/repeated-state/repeated-action guards
- task-tab lock
- approved-origin lock
- cross-origin confirmation
- same-origin destructive-navigation confirmation
- pause/resume
- cancel/clear checkpoint
- closed-tab resume cleanup
- serialized/revisioned checkpoint writes

### Vision fallback
- DOM-first architecture
- planner must explicitly request visual help
- max 2 visual fallbacks per task
- max 1 per unchanged semantic snapshot
- task tab must be visible/active
- vision budget survives resume
- screenshot not persisted in checkpoint

### Safety
- page/model/screenshot content treated as untrusted data
- no arbitrary model-generated JavaScript or shell execution
- password/OTP/payment/token-like controls blocked
- confirmation key binds task/snapshot/action/target
- page revalidated after confirmation delay
- irreversible deletion requires explicit original intent
- confirmation decline terminates task
- pause during confirmation remains resumable
- session/account/mail-abuse side effects require confirmation

### Yahoo Mail
- Yahoo site skill
- deterministic search/select/Trash/count/sample hints
- visible advanced-search control hints
- no invented Yahoo operator requirement
- login/MFA/CAPTCHA/security handoff
- destructive preview
- unfiltered bulk Trash scope guard
- whole-Inbox exception only for explicit original intent
- post-Trash Yahoo-specific verification evidence
- read-only Yahoo readiness check

### Diagnostics/performance
- bounded diagnostic ledger
- action/observer/planner/vision timing
- typed payload excluded from diagnostic export
- sanitized JSON report export
- hard resource budgets
- synthetic benchmark tooling

### Acceptance tooling
- deterministic localhost browser fixture
- same-origin iframe fixture
- acceptance fixture server + integration test
- one-command Windows acceptance launcher
- installed-browser self-test in Sightline UI
- extension-origin local AI/Ollama self-test
- CLI Ollama readiness/image-inference test
- Yahoo read-only readiness test
- exportable self-test evidence
- CI extension artifact upload
- CI release permission/security/size audit

## Current release gates

### Gate 1 — installed Chrome/Edge
GitHub issue: `/issues/3`

Must run the real installed extension browser self-test in current Chrome and Edge.

### Gate 2 — live Ollama
GitHub issue: `/issues/4`

Must pass both:
- `npm run acceptance:ollama`
- Sightline **Test local AI**

### Gate 3 — live Yahoo
GitHub issue: `/issues/5`

Must pass:
- read-only Yahoo readiness
- controlled non-destructive search
- controlled reversible Move-to-Trash test using disposable mail
- scope guard and irreversible-delete guard checks

## Exact next step

Do **not** add more generic browser-agent features before the three alpha acceptance gates are exercised.

The next code change should be driven by one of:
1. a specific acceptance defect,
2. an acceptance environment blocker that needs tooling,
3. a measured performance failure,
4. a documented Yahoo DOM/behavior mismatch.

This is intentional anti-loop discipline.

## Recovery instructions

If work is interrupted:

1. Read `README.md`.
2. Read `docs/FEATURE_STATUS.md`.
3. Read `docs/ROADMAP.md`.
4. Read this handoff.
5. Inspect GitHub issues #3, #4, and #5 for acceptance evidence.
6. Run `npm run check` on the current `develop` branch before changing code.
7. If a gate failed, reproduce that exact defect first; do not restart broad hardening.

## Production claims

Not yet verified:
- installed Chrome acceptance
- installed Edge acceptance
- live extension-origin Ollama acceptance
- real Yahoo acceptance
- real-browser long-session memory/CPU soak
- production release packaging/update lifecycle

No production-ready claim is allowed until those gates have evidence.
