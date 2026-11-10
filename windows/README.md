# Sightline Windows Foundation

Status: **experimental / automated CI foundation verified; real desktop acceptance pending**

Sightline's Windows layer is intentionally lightweight: deterministic APIs/UI Automation first, AI only when needed later.

## Principles

- structured information before pixels
- deterministic Windows APIs/UIA before AI
- hard-bounded observations, leases, diagnostics, and resource probes
- no Electron, background polling loop, or embedded heavyweight model
- browser extension remains the browser companion

## Build and test

```powershell
.\tools\test-windows.ps1
```

For the real desktop vertical slice:

```powershell
.\tools\test-windows.ps1 -Interactive
```

Hosted CI does not substitute for interactive desktop acceptance.

## Implemented

- .NET 8 Core/Windows/App split
- FlaUI UIA3 isolated outside Core
- bounded UIA observation and fail-closed bounded target re-resolution
- session-scoped non-reused element refs
- stale snapshot/window/ref rejection
- semantic Invoke and SetValue; SetValue has exact readback verification
- exact focus request/readback
- zero-polling Win32 user-activity lease
- bounded per-process UIA circuit breaker
- fixed-capacity diagnostics and optional bounded rotating/redacted JSONL sink
- bounded top-level Win32 window discovery with capped title/result budgets
- deterministic WPF fixture + interactive acceptance runner
- working-set/private-memory/managed-heap/allocation/handle/thread probes

## Resource evidence

Run #249 exposed allocation churn in repeated short-lived sessions: about **11.24 MB allocated over 1,000 cycles**, with live managed heap returning to about **0.3 MB** after forced GC. That identified allocation churn rather than retained managed objects.

Element lease storage and the diagnostic ring were then made lazy. Run #251 measured the same 1,000 cycles at about **0.84 MB cumulative allocation**, a reduction of about **92.5%**. Post-GC managed heap returned to about **0.32 MB**, retained working-set delta was about **+0.23 MB**, private memory did not grow, handles were **+1**, and threads **+0**.

These are evidence points, not production ceilings. Active-UIA and real-machine long-run soak remain required.

## Safety boundary

An element action is allowed only after a complete unique bounded re-resolution. If node, depth, or time limits truncate the scan, Sightline fails closed rather than assuming the first matching control is unique.

## Action approval safety checkpoint (2026-11-10)

The Windows UIA mutation entrypoint now requires a trusted `IDesktopActionApproval`. Without one, `Invoke` and `SetValue` fail closed with `ConfirmationRequired` before attaching to a process. Approval callback exceptions also deny. The interactive WPF acceptance runner has a narrowly scoped test-only approval tied to its disposable test process and known controls.

**This is NOT a shipped confirmation dialog or user authorization lifecycle.** Production callers must implement a secure user-approval workflow binding the exact task, target, action, snapshot/window identity and expiry, with single-use semantics; page text/model output must never supply approval. The existing fallback is deny by default. Real Windows operation remains UNVERIFIED on this change.

If UI Automation throws or is interrupted after a mutation begins, the executor now reports `UnknownEffect` rather than suggesting the action did not happen. A durable write-ahead ledger and recovery reconciliation are still required before autonomous retries.

Security changes and their synthetic tests are committed on `develop` but were **NOT RUN** in this hosted environment (no .NET SDK and unavailable GitHub DNS). Execute `.\tools\test-windows.ps1` on a supported Windows machine and retain evidence before considering the fix accepted.

