# Sightline Windows Foundation

Status: **experimental / not production verified**

This directory is the lightweight Windows-native foundation for Sightline.

## Principles

- deterministic Windows APIs/UI Automation before AI
- bounded observation and bounded diagnostics
- no Electron
- no embedded heavyweight model
- no coordinate input in Foundation v0
- cancellation and explicit resource budgets
- browser extension remains the browser companion

## Build and test

On Windows with .NET 8 SDK:

```powershell
dotnet restore windows/Sightline.Windows.sln
dotnet build windows/Sightline.Windows.sln -c Release --no-restore
dotnet test windows/tests/Sightline.Core.Tests/Sightline.Core.Tests.csproj -c Release --no-build
```

The WPF test target is compiled by CI but interactive UIA acceptance remains a real-Windows acceptance gate.

## Foundation v0 acceptance

- Core has no FlaUI dependency.
- Windows adapter uses FlaUI UIA3 5.0.0.
- Observation has hard node/depth/time budgets.
- Diagnostics ledger has a fixed capacity.
- Test fixture is deterministic.
- Windows build/unit tests run in CI.
- Real interactive Windows UIA behavior remains UNVERIFIED until run on a desktop.
