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
- process RAM/private-memory/handle/thread sampling
- deterministic WPF target
- core and Windows safety regression suites

## Verification boundary

Hosted Windows CI verifies restore, compile, non-interactive safety tests, the WPF target build, and a lightweight resource probe. The current CI resource baseline is ~22.9 MiB working set / ~7.3 MiB private memory, 183 handles, and 8 threads.

It does **not** prove interactive desktop UIA behavior. Real observation/actions, focus behavior, DPI, elevation, user interference, and long-run leak behavior remain real-machine gates.
\n## Real desktop vertical-slice acceptance\n\nOn an interactive Windows development machine, run:\n\n```powershell\n.\\tools\\test-windows.ps1 -Interactive\n```\n\nThat launches the controlled WPF fixture and attempts bounded observe -> SetValue/readback -> re-observe -> Invoke -> result readback. A PASS from hosted CI alone does not substitute for this run.\n