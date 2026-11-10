# Sightline Windows Foundation

Status: **experimental / automated CI foundation verified; real desktop acceptance pending**

This directory contains Sightline's lightweight Windows-native foundation.

## Principles

- deterministic Windows APIs/UI Automation before AI
- structured information before pixels
- hard-bounded observations, leases, and diagnostics
- no Electron
- no embedded heavyweight model
- no coordinate input in Foundation v0
- cancellation and explicit resource budgets
- browser extension remains the browser companion

## Build and test

On Windows with .NET 8 SDK:

```powershell
.\tools\test-windows.ps1
```

Or manually:

```powershell
dotnet restore windows/Sightline.Windows.sln
dotnet build windows/Sightline.Windows.sln -c Release --no-restore
dotnet test windows/tests/Sightline.Core.Tests/Sightline.Core.Tests.csproj -c Release --no-build
dotnet test windows/tests/Sightline.Windows.Tests/Sightline.Windows.Tests.csproj -c Release --no-build
```

## Implemented foundation

- FlaUI UIA3 adapter isolated from Core
- bounded observation
- session-scoped, non-reused element refs
- stale snapshot/window/ref rejection
- semantic Invoke
- semantic SetValue with exact readback verification
- fixed-capacity diagnostics
- structured UIA diagnostics that exclude SetValue text
- optional bounded rotating/redacted JSONL sink
- process RAM/private-memory/handle/thread sampling
- deterministic WPF target
- core and Windows safety regression suites

## Verification boundary

Hosted Windows CI verifies restore, compile, non-interactive safety tests, the WPF target build, an empty-process resource probe, and an idle automation-session resource probe. The current CI resource baseline is ~22.9 MiB working set / ~7.3 MiB private memory, 183 handles, and 8 threads.

It does **not** prove interactive desktop UIA behavior. Real observation/actions, focus behavior, DPI, elevation, user interference, and long-run leak behavior remain real-machine gates.
\n## Real desktop vertical-slice acceptance\n\nOn an interactive Windows development machine, run:\n\n```powershell\n.\\tools\\test-windows.ps1 -Interactive\n```\n\nThat launches the controlled WPF fixture and attempts bounded observe -> SetValue/readback -> re-observe -> Invoke -> result readback. A PASS from hosted CI alone does not substitute for this run.\n
## Current resource evidence

CI run #238 measured 24,117,248 bytes working set, 7,778,304 bytes private memory, 183 handles, and 8 threads for the lightweight process probe. The idle session sample added 2 handles and 0 threads; RSS/private deltas were negative due to normal process-sampling/GC noise. These are evidence points, not production limits. Repeated active-UIA soak testing is still required.

## Fail-closed action resolution

Element actions require a complete, unique UIA re-resolution scan. If the node, depth, or time budget truncates the scan, Sightline rejects the action rather than assuming the first matching control is unique. Increase a bounded resolution budget or narrow the target window when a legitimate action cannot be resolved. This prevents acting on a similarly named control outside the observed region. Core regression tests cover depth and exact-node budget exhaustion; real interactive desktop validation is still required.


## Repeated-session resource soak

CI now creates and disposes 100 lightweight `WindowsAutomationSession` instances and records process resource samples every 10 cycles. The probe emits start/end/peak working set, private memory, handle count, and thread count plus the bounded sample series.

This is evidence, not an invented production ceiling. It is designed to expose obvious monotonic resource drift before interactive UIA soak testing is available. The probe does not touch the desktop and does not add a background service or polling loop.
