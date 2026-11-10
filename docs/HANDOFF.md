# Sightline Engineering Handoff

Last updated: 2026-11-10

## Product

**Sightline** — *See. Understand. Act.*

Repository: DevTunaSoft/Sightline  
Integration branch: `main`  
Browser baseline: `develop`  
Current Windows work: `feature/windows-foundation-v0` / PR #6

## Direction

Sightline is a lightweight standalone Windows application with the existing Chrome/Edge extension retained as the browser companion.

Core rule: **structured information before pixels; deterministic software before AI.**

## Verified checkpoint

Latest fully verified checkpoint before the resource-probe commit:
- repository reconciliation: **PASS**
- browser validation suite: **PASS**
- extension packaging: **PASS**
- Windows restore: **PASS**
- Windows solution build: **PASS**
- Windows core tests: **PASS**
- Windows safety-layer tests: **PASS**
- WPF test target compilation: **PASS**
- interactive WPF acceptance runner compilation: **PASS**
- real interactive Windows UIA acceptance: **UNVERIFIED**

Resource-probe CI is **PASS**. Measured on `windows-latest`: 24,039,424 bytes working set (~22.9 MiB), 7,659,520 bytes private memory (~7.3 MiB), 183 handles, and 8 threads. These are baseline measurements, not production ceilings.

Idle-session evidence from CI run #238: before/after process RSS and private bytes were noisy and decreased in the single sample; handles increased by 2 and threads by 0. Treat this as evidence that no obvious idle thread explosion occurred, not as a RAM ceiling. A repeated session/active-UIA soak remains required.

## Windows foundation implemented

- .NET 8 solution
- dependency-light `Sightline.Core`
- FlaUI UIA3 isolated in `Sightline.Windows`
- bounded node/depth/time UIA traversal
- observation capped by lease capacity
- session-scoped element leases
- monotonically non-reused element refs
- current-snapshot-only lease resolution
- process/window identity binding
- semantic Invoke action
- semantic SetValue action
- exact SetValue readback verification
- stale snapshot/window/ref rejection before live UIA access
- fixed-capacity diagnostics ledger
- bounded redacted rotating diagnostic file sink (queue/file/retention caps; **PASS** including 10,000-event stress in CI run #236)
- process resource sampler
- repeated lease-cycle soak coverage
- Core architecture dependency guard against FlaUI/Windows/model/browser runtime leakage (**PASS** in CI run #232)
- deterministic WPF test target
- separate Windows safety test project
- `tools/test-windows.ps1` acceptance/resource harness
- Windows CI evidence artifact

## Memory/resource policy

Memory growth is a defect.

Current controls:
- bounded traversal
- bounded element lease dictionary
- old snapshot leases are cleared
- no live AutomationElement/COM objects retained in Core
- bounded diagnostics
- no screenshots in the Windows foundation
- no AI model loaded in the Windows foundation
- no polling loop
- process working set/private bytes/handles/threads can be sampled

Do not add an unbounded queue, cache, history, log, screenshot store, context window, or model lifetime.

## What remains unverified

- real Windows UIA observation on an interactive desktop
- real Invoke effect against the WPF fixture
- real SetValue/readback against the WPF fixture
- focus theft/user interference
- mixed DPI/multi-monitor behavior
- elevation/UIPI behavior
- long Windows soak/resource trend
- browser-extension IPC
- tiny GGUF runtime
- installer/GUI

## Next implementation order

1. wait for the resource-probe CI gate and fix any root cause
2. exact focus verification before any future physical input
3. post-action semantic effect/readback contracts
4. per-app UIA circuit breaker
5. automated interactive Windows acceptance runner
6. measured long-run resource/leak gates
7. browser companion IPC
8. vision/OCR only after semantic automation is reliable
9. tiny local GGUF runtime after deterministic routing foundation

## Recovery instructions

1. Inspect PR #6 head and its latest CI run.
2. Fix the first failing root cause; do not rerun unchanged failures repeatedly.
3. Run `.\tools\test-windows.ps1` on a real Windows development machine when available.
4. Preserve PASS/FAIL/BLOCKED/NOT RUN/UNVERIFIED language.
5. Do not claim production readiness from hosted CI alone.
