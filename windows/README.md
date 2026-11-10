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
- deterministic WPF fixture + interactive acceptance runner
- working-set/private-memory/managed-heap/allocation/handle/thread probes

## Resource evidence

Run #249 exposed allocation churn in repeated short-lived sessions: about **11.24 MB allocated over 1,000 cycles**, with live managed heap returning to about **0.3 MB** after forced GC. That identified allocation churn rather than retained managed objects.

Element lease storage and the diagnostic ring were then made lazy. Run #251 measured the same 1,000 cycles at about **0.84 MB cumulative allocation**, a reduction of about **92.5%**. Post-GC managed heap returned to about **0.32 MB**, retained working-set delta was about **+0.23 MB**, private memory did not grow, handles were **+1**, and threads **+0**.

These are evidence points, not production ceilings. Active-UIA and real-machine long-run soak remain required.

## Safety boundary

An element action is allowed only after a complete unique bounded re-resolution. If node, depth, or time limits truncate the scan, Sightline fails closed rather than assuming the first matching control is unique.
