# Sightline Engineering Roadmap

Last updated: 2026-11-11

## Product direction

Sightline is a **lightweight standalone Windows application** with the existing Chrome/Edge extension retained as its browser companion.

Core rule: **structured information before pixels; deterministic software before AI.**

## Phase 0 — Baseline and reconciliation
Status: **AUTOMATED BASELINE PASS; REAL BROWSER ACCEPTANCE REMAINS**

Browser alpha preserved, CI repaired, Windows duplication audit completed.

## Phase 1 — Windows Foundation v0
Status: **AUTOMATED FOUNDATION PASS; REAL DESKTOP ACCEPTANCE REMAINS**

Implemented: .NET split, bounded/fail-closed UIA observation, element leases, cancellation/budgets, WPF fixture/runner, Windows CI, resource telemetry.

## Phase 2 — Diagnostics and automated acceptance
Status: **SUBSTANTIALLY IMPLEMENTED**

Implemented: structured bounded diagnostics, rotating/redacted file sink, stress tests, acceptance harness, resource/soak evidence.

Remaining: crash/recovery bundle, broader fault injection, real interactive evidence.

## Phase 3 — Safe Windows actions
Status: **PARTIAL**

Implemented: Invoke, SetValue/readback, live re-resolution, stale rejection, focus verification, user-activity lease, typed failures, and a bounded single-use approval primitive (SHA-256 digest only; no cached typed values, polling or background worker).

Next: verify the new approval unit tests and disposable WPF acceptance runner on Windows; implement the **trusted production confirmation GUI** and secure reconciliation UI, plus moving-target/geometry protection and additional semantic patterns only as needed.

## Phase 4 — Reliability and recovery
Status: **PARTIAL**

Implemented: process/window/snapshot identity binding and bounded UIA circuit breaker. A single pending, write-through Windows mutation journal now fails closed when an action is not confirmed or a previous record remains; the file contains metadata only and the implementation has no resident worker.

Next: verify the .NET journal and WPF acceptance on Windows; add trusted persistent per-user journal provisioning, independent effect reconciliation and production single-use approvals. Complete broader checkpoints, crash-loop protection, transactional file operations, and Windows task resume/cancel/pause.

## Phase 5 — Deterministic Windows capabilities
Status: **STARTED**

Implemented: bounded top-level window discovery using Win32 EnumWindows with hard result/title limits and no polling.

Next: explicit application launch/attach, bounded process metadata, filesystem, clipboard, File Explorer, Notepad.

## Phase 6 — Browser integration

Bounded IPC from `Sightline.exe` to the existing extension; preserve DOM-first browser execution.

## Phase 7 — Vision/OCR

Only after semantic automation is reliable: ROI-first capture, privacy masking, Windows OCR, optional local vision, DPI/window-bound capture leases.

## Phase 8 — Lightweight local intelligence

Optional tiny quantized GGUF runtime for bounded interpretation/routing; larger Ollama/local endpoint only for difficult reasoning/vision. Require lazy loading, bounded context/KV cache, streaming, cancellation, unload policy, and graceful OOM behavior.

## Phase 9 — Learned deterministic workflows

AI discovers -> Sightline verifies -> learns -> compiles -> deterministic reuse.

## Phase 10 — Hardening

Fuzzing, fault injection, races, mixed DPI/monitors, sleep/wake/lock, elevation, active-UIA soak, security/privacy, upgrade/migration.

## Phase 11 — Production lifecycle

Lightweight GUI/activity monitor, self-test, installer/uninstaller, safe update/rollback, safe mode, diagnostic export, release acceptance.

## 2026-11-11 — Browser low-memory and uncertain-effect checkpoint

**Implemented on `develop` (full suite not yet verified):** DOM waits now release abort listeners and timers on completion or cancellation; element references cannot exceed the observer's existing 300-element ceiling even if configured with an enormous cap; the task-loop stall guard retains a fixed-size numeric fingerprint instead of a string copy of typed text/URLs. No new dependency or background polling was added. Browser action-handler exceptions and cancellation after a possible mutation are marked `UNKNOWN_EFFECT` and blocked from automatic recovery/replay.

**Acceptance still required:** run `npm run check` on the exact branch commit; Chrome/Edge stress tests for long sessions, repeated waits, tab switching, cancellation and crash recovery; measure retained heap, event listeners and idle CPU against the previous revision, with regressions treated as defects. Isolated tests prove bounded structures and listener cleanup, **not a measured production RAM reduction**.

**Next unblocked priorities:** Windows durable write-ahead action records and explicit single-use approval UX, real desktop UIA identity/acceptance, then browser end-to-end validation and lightweight optional local AI provisioning. Preserve structured-first and lazy loading policies.

## Resource policy

Memory growth is a defect. Run #251 reduced measured 1,000-cycle idle-session allocation from ~11.24 MB to ~0.84 MB by making bounded element/diagnostic storage lazy. Keep measured regression guards and do not infer production RAM ceilings from hosted runners.

## Existing browser acceptance gates

Installed Chrome, installed Edge, extension-origin Ollama, and real Yahoo controlled acceptance remain required.
