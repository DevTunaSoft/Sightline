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

## 2026-11-11 — Low-memory observer and Windows safety checkpoint

Implemented on `develop`: bounded lazy DOM/text walks avoid retaining large selector-result arrays; hard overrides cannot exceed 300 actionable elements, 12,000 inspected DOM nodes, or 6,000 text nodes. Observations reaching scan limits are marked partial, preventing unsafe high-impact actions. Existing ref registry and snapshot caps remain intact. **23/23 targeted observer tests passed** in an isolated V8 harness; actual Chrome/Edge memory/CPU measurements are **NOT RUN**.

Windows Invoke now reports `UnknownEffect` until independently verified, even if a UIA provider accepted it. The one-time approval component also revokes permission after malformed/throwing observations and declines to approve credential-named or unidentifiable controls. Targeted XUnit regressions were written but **NOT RUN**, since .NET is unavailable in this environment.

Next: full Node and .NET build/test pipelines at the exact commit, real-browser heap/CPU long-session measurements, controlled WPF confirmation/recovery acceptance, then production trusted approval UX.

## 2026-11-11 — Bounded frame discovery and complete-coverage safeguards

The browser observer now discovers embedded frames with the same lazy DOM-walk primitive used for interactive controls; no full `querySelectorAll('iframe,frame')` list is created. Frame discovery visits at most 6,000 DOM nodes, inspects at most 20 frames, and retains at most 21 document contexts including the top page. Existing interactive-node, text-node and snapshot limits remain enforced. Visible-text overflow and partial frame discovery now correctly flag incomplete observations and prevent consequential actions from proceeding on missing context.

**Executed:** 35/35 targeted observer-core/visibility/integrated snapshot tests PASS in isolated V8. **NOT RUN:** full Node `npm run check`, installed Chrome/Edge behavior, heap/CPU profiling, and Windows .NET tests. Lower peak collection allocation is the design goal, not a verified RAM benchmark. Next: full CI acceptance and controlled real-browser scan-latency/memory comparisons, then production Windows consent and recovery UX.

## 2026-11-11 — Strict per-observation text processing budgets

The observer previously normalized an entire text node with regular expressions before applying its short output cap. Oversized webpages could therefore create large temporary strings even though the stored snapshot was small.

The shared normalizer now limits examined input to **32,768 UTF-16 units per value**, and the text collector enforces a **65,536-unit aggregate scan budget per page observation**, with an **8,000-character maximum retained text**. Work stops when the shared budget is exhausted; the snapshot is marked partial to prevent acting on unobserved content. No additional dependencies, services, polling or unbounded caches.

**Executed:** 45/45 current GitHub observer test cases PASS in an isolated V8 harness, including Unicode equivalence, deterministic fuzz tests, huge inputs, aggregate budget exhaustion and fake-DOM snapshot regressions. **NOT RUN:** full `npm run check`, installed Chrome/Edge memory/CPU profiling and Windows .NET acceptance. Lower transient allocation is expected from the algorithm but **not yet measured**.

**Next gate:** Run full CI and Chrome/Edge controlled long-page stress tests, compare peak retained heap, scan latency, and idle CPU against the previous commit; resolve any real-device incompatibility before declaring production acceptance.

## 2026-11-11 — Bounded browser actions follow-up

The browser DOM adapter now applies the same strict text budgets used by observation: read/verify operations stop after 6,000 text nodes or 65,536 UTF-16 source units; an incomplete read cannot prove an action succeeded. Dropdown selection examines no more than 2,048 live options without copying the full option list. Both are fail-closed and add no resident memory, background tasks or dependencies.

**Executed:** 45/45 observer and 20/20 DOM adapter targeted checks PASS in isolated JavaScript execution (**65/65 total**). Source readback and corrections to a misplaced temporary GitHub test-file write also verified. **NOT RUN:** complete Node test suite, installed Chrome/Edge acceptance, long-session heap/CPU measurements, and current Windows .NET tests.

**Next release gate:** run the full suite on the exact `develop` commit; benchmark Chrome/Edge large DOMs and dropdowns for allocation, scan latency and stability; then complete Windows trusted consent and reconciliation acceptance. Review any remaining unbounded accessible-name/label construction.

## 2026-11-11 — Bounded accessible names

Sightline now limits accessible-name inspection to 16 `aria-labelledby` IDs or 16 indexed live labels, with a 2,048-character ID budget and 4,096-character source-text budget. This avoids unbounded label-list expansions and combined-string allocations on large pages. Incomplete control names mark the observation truncated, so higher-risk actions cannot depend on partial target identity. The implementation reuses the existing page-text collector and a single observation-wide status flag instead of copying each semantic descriptor.

**Evidence:** 50/50 targeted observer tests passed against the exact `develop` source in isolated V8, including tests with oversized labels and normal small labels. Real Chrome/Edge heap, CPU and scan-latency measurements, full Node `npm run check`, and .NET Windows acceptance remain **NOT RUN / UNVERIFIED**. Do not infer a measured RAM percentage.

## 2026-11-11 — Credential-metadata consistency and bounded inspection

A shared field detector now independently inspects type, autocomplete tokens, name, ID and editable-field accessibility hints at both observation and action time. Section-prefixed password/OTP/card autocomplete tokens are recognized. Strings beyond the metadata inspection ceiling fail closed rather than allowing a sensitive suffix to bypass checks. No extra model call, cache, polling loop, timer, dependency or background worker was added.

**PASS:** 86/86 current observer and DOM adapter regression checks under isolated V8 shims, including redaction, action blocking, linked external labels, changed labels, benign button compatibility and overlong metadata. Native and `aria-labelledby` associations now have bounded action-time checks without per-label metadata allocations. **NOT RUN:** full Node suite, real Chrome/Edge and Windows acceptance, measured RAM/CPU. Next: real-browser dynamic-label/long-session tests, CPU and heap benchmarks, and end-to-end browser and Windows acceptance.

## Resource policy

Memory growth is a defect. Run #251 reduced measured 1,000-cycle idle-session allocation from ~11.24 MB to ~0.84 MB by making bounded element/diagnostic storage lazy. Keep measured regression guards and do not infer production RAM ceilings from hosted runners.

## Existing browser acceptance gates

Installed Chrome, installed Edge, extension-origin Ollama, and real Yahoo controlled acceptance remain required.
