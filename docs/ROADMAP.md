# Sightline Engineering Roadmap

Last updated: 2026-11-09

## Product direction

Sightline is evolving into a **lightweight standalone Windows application** with the existing Chrome/Edge extension retained as its browser companion.

Core rule: **structured information before pixels; deterministic software before AI.**

Every phase must satisfy four permanent gates: correctness, safety, diagnostics, and resource efficiency.

## Phase 0 — Baseline and reconciliation

Status: **IN PROGRESS**

- preserve the browser alpha already implemented on `develop`
- repair CI defects before layering new CI
- keep browser acceptance gates explicit and unverified until exercised
- document the Windows-primary / browser-companion architecture
- prevent duplicate features, branches, issues, and PRs

## Phase 1 — Windows Foundation v0

Status: **IN PROGRESS**

Deliver:
- C#/.NET Windows solution
- dependency-light `Sightline.Core`
- isolated FlaUI/UIA3 Windows adapter
- bounded UIA observation
- semantic snapshots
- stable/non-reused session element references
- cancellation and hard time/node/depth budgets
- deterministic WPF acceptance target
- Windows build/unit-test CI
- memory/resource measurement hooks

Foundation v0 intentionally excludes AI, OCR, vision, coordinate clicking, SQLite, workflow learning, and browser IPC.

## Phase 2 — Diagnostics and automated acceptance

- structured bounded logging
- asynchronous rotating file sink
- privacy scrubber
- task/step/action correlation IDs
- crash/recovery evidence
- one-command Windows acceptance harness
- fault injection
- resource/leak/soak tests
- sanitized evidence bundle

Logging must never be allowed to grow memory without bound or crash the application.

## Phase 3 — Safe Windows actions

- UIA Invoke/Value/Toggle/Selection/Scroll patterns
- live target re-resolution
- stale-reference rejection
- exact focus verification before physical input
- moving-target protection
- post-action readback
- stable typed failure codes
- user-interference yield

## Phase 4 — Reliability and recovery

- checkpoints
- idempotency
- unknown-effect reconciliation
- UIA per-application circuit breaker
- process/window generation identity
- crash-loop protection
- resume/cancel/pause
- transactional file operations and guarded undo

## Phase 5 — Windows capabilities

Add capabilities incrementally and test each:
- filesystem
- processes
- windows
- clipboard
- File Explorer
- Notepad
- application launch/attach

## Phase 6 — Browser integration

Connect `Sightline.exe` to the existing extension rather than rebuilding browser authentication/session handling.

- browser companion IPC
- capability health
- task ownership across Windows/browser surfaces
- preserve DOM-first browser automation

## Phase 7 — Vision and OCR

Only after semantic automation is reliable:
- Windows Graphics Capture
- ROI-first capture
- privacy masking before OCR/model access
- Windows OCR
- optional local vision fallback
- capture leases with monitor/DPI/window identity

## Phase 8 — Lightweight local intelligence

AI is optional capability, not the execution engine.

Routing order:
1. deterministic code
2. tiny local GGUF model when interpretation is useful
3. larger Ollama/local endpoint only for difficult reasoning/vision

Benchmark candidate small quantized models by measured capability per MB. Use mmap/lazy loading where supported, bounded context/KV cache, token streaming, cancellation, unload/idle policy, and graceful OOM behavior.

## Phase 9 — Learned deterministic workflows

AI discovers -> Sightline verifies -> learns -> compiles -> deterministic reuse.

Healthy compiled workflows should not require model inference when state matches expectations.

## Phase 10 — Hardening

- adversarial/prompt-injection fixtures
- fuzzing
- fault injection
- concurrency/race testing
- multi-monitor/mixed-DPI
- sleep/wake/lock/unlock
- long-run memory/handle/thread soak
- upgrade/migration tests
- security/privacy acceptance

## Phase 11 — Production lifecycle

- lightweight GUI/activity monitor
- self-test UI
- installer/uninstaller
- safe updater + rollback
- safe-mode startup
- diagnostic export
- release gates and real-machine acceptance

## Resource policy

Memory growth is a defect.

Measure at minimum:
- cold startup working set
- idle working set
- UIA observation peak
- active automation peak
- diagnostics overhead
- post-task cleanup
- repeated-task working-set trend
- handles and threads
- OCR/vision/model peaks when those phases arrive

Do not invent fixed RAM claims before measurement. Establish baselines from executable evidence and convert them into regression gates.

## Existing browser alpha gates

Still required:
- installed Chrome acceptance
- installed Edge acceptance
- extension-origin live Ollama acceptance
- real Yahoo acceptance using controlled fixtures

Windows work does not erase these gates; the extension becomes the browser companion.
