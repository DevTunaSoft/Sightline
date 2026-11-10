# Sightline Source Map (branch-aware)

**This map is grounded in the paths reported in PR #6 on 2026-11-10; these files may not exist on `main` until integration.** Confirm live files, signatures, branches and ownership before modifying. This document is navigational rather than generated API documentation.

## Browser extension and tests

- `extension/`: Manifest V3 Chrome/Edge companion and side-panel UX. `extension/browser-task-runner.js` is listed in PR #6 for bounded task execution; `extension/diagnostics-core.js` for sanitized diagnostics.
- `tests/`: Browser automated unit/fuzz/integration fixtures; PR #6 lists `tests/browser-task-runner.test.js`.
- `tools/`: Developer entrypoints, including browser acceptance starter and Windows validation PowerShell script where present.

## Windows foundation in PR #6

| Path | Expected responsibility |
|---|---|
| `windows/Sightline.Windows.sln` | Windows .NET 8 solution root |
| `windows/src/Sightline.Core/` | Platform-independent contracts, leases, action/observation models, safety, diagnostics, resource telemetry |
| `windows/src/Sightline.Core/Actions.cs` | Typed action core |
| `windows/src/Sightline.Core/Observation.cs` | Bounded observation model |
| `windows/src/Sightline.Core/ElementLeases.cs` | Session-scoped stable/non-reused reference handling |
| `windows/src/Sightline.Core/Diagnostics.cs`, `DiagnosticSanitizer.cs`, `BoundedDiagnosticFileSink.cs` | Bounded structured evidence and redaction |
| `windows/src/Sightline.Core/Focus.cs`, `InputSafety.cs` | Focus and user activity policy primitives |
| `windows/src/Sightline.Core/ResourceTelemetry.cs` | Resource counters |
| `windows/src/Sightline.Windows/` | FlaUI UIA3 / Win32 platform implementation |
| `FlaUiDesktopObserver.cs`, `FlaUiElementResolver.cs` | UIA observation and element resolution |
| `FlaUiActionExecutor.cs`, `FlaUiFocusVerifier.cs` | UIA Invoke/SetValue/focus behavior |
| `UiaCircuitBreaker.cs`, `UiaRuntimeOptions.cs` | Provider fault containment and runtime caps |
| `Win32UserActivityDetector.cs`, `WindowsAutomationSession.cs` | User activity and session wiring |
| `windows/src/Sightline.App/` | Windows host bootstrap (not a completed end-user GUI) |
| `windows/tests/Sightline.Core.Tests/` | Contracts, boundedness, architecture guard |
| `windows/tests/Sightline.Windows.Tests/` | Platform adapter safety tests |
| `windows/tests/Sightline.Windows.TestTarget/` | Deterministic WPF interactive fixture |
| `windows/tests/Sightline.Windows.Acceptance/` | Interactive UIA acceptance runner |
| `tools/test-windows.ps1` | Windows build/test/resource/interactive entrypoint |

**Dependency rule:** `Sightline.Core` must not import FlaUI, browser, UI runtime or model implementation. Model/backend and IPC ownership remain **future design work**, not shipped architecture.

## Documentation and governance

- `README.md`: entrypoint, branch caveats, product scope.
- `docs/PROJECT_BRIEF_AND_TAKEOVER.md`: mission, design, continuity.
- `docs/REQUIREMENTS_AND_ACCEPTANCE.md`: feature IDs and evidence gates.
- `docs/DEVELOPMENT_LEDGER.md`: append-only verified checkpoints.
- `docs/RELEASE_READINESS.md`: release-blocking acceptance matrix.
- `docs/DECISIONS.md`: architectural rationale.
- `SECURITY.md`: security policy; `CONTRIBUTING.md`: change discipline.
- `docs/ROADMAP.md`, `docs/HANDOFF.md`, and branch-specific `docs/ARCHITECTURE.md`, `docs/FEATURE_STATUS.md`, `docs/USER_MANUAL.md`: maintain in lockstep with implementation.

## Responsibility decision tree

To fix a browser targeting/selection issue, start with the extension DOM/action layer and browser tests. For Windows stale refs or UIA timeouts, inspect the platform adapter and Core contracts with safety tests. For memory/CPU/log leakage, inspect bounded lifetimes in Core and relevant adapters, then measure reproducibly. For AI results, verify deterministic observation first before editing model prompts or adding dependencies. For safety/permission issues, inspect policy boundaries and fail-closed behavior before adding new actions.

Update this map as source structure evolves; replace assumptions with exact code links, signatures and confirmed commits once merged.
