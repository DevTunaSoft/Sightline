# Sightline Feature Status

Last updated: 2026-11-10

Status language: **Implemented**, **Automated-test verified**, **Real-machine verified**, **Production accepted**.

## Windows standalone foundation

| Capability | Status | Notes |
|---|---|---|
| .NET 8 Windows solution | Implemented / automated-test verified | Builds on `windows-latest`. |
| Core/Windows split | Implemented / automated-test verified | Core has no FlaUI dependency. |
| FlaUI UIA3 observer | Implemented / compile verified | Interactive desktop remains unverified. |
| Bounded UIA traversal/resolution | Implemented / automated-test verified | Node/depth/time bounded; actions fail closed on incomplete scans. |
| Element leases | Implemented / automated-test verified | Snapshot/process/window bound, non-reused refs, hard-bounded lazy storage. |
| Invoke | Implemented / compile verified | App-specific effect verification still required. |
| SetValue + readback | Implemented / compile verified | Exact value readback. |
| Focus verification | Implemented / automated-test verified | One focus request/readback; no polling. |
| User-activity lease | Implemented / automated-test verified | Win32 last-input stamp; no hook/poll loop. |
| UIA circuit breaker | Implemented / automated-test verified | Bounded process table + cooldown/half-open probe. |
| Diagnostics ledger | Implemented / automated-test verified | Fixed-capacity, lazy ring. |
| Persistent diagnostic sink | Implemented / automated-test verified | Bounded queue, rotation, retention, redaction, 10k-event stress. |
| Resource telemetry | Implemented / automated-test verified | Working set/private/managed heap/allocations/handles/threads. |
| Repeated-session soak | Implemented / automated-test verified | 100 warm-up + 1,000 measured cycles. |
| Idle allocation optimization | Implemented / automated-test verified | ~92.5% measured allocation reduction in run #251. |
| WPF test target | Implemented / compile verified | Interactive acceptance pending. |
| Interactive acceptance runner | Implemented / compile verified | `tools/test-windows.ps1 -Interactive`. |
| Bounded top-level window discovery | Implemented / automated-test verified | Win32 EnumWindows, capped results/title length, optional visibility/untitled filters, no polling. |
| Windows sensitive-control metadata/SetValue gate | Implemented / tests added, **NOT RUN** on latest code | Password/credential metadata redaction and deny-by-default actions; live UIA unverified. |
| Windows mutation approval boundary | Implemented / tests added, **NOT RUN** on latest code | No approval provider means no Invoke/SetValue. No end-user confirmation UI or single-use approval implementation yet. |
| Windows unknown-effect status | Implemented / **UNVERIFIED** | Mutation-phase exceptions and cancellations report UnknownEffect; crash-proof journaling/reconciliation remains missing. |
| Real Windows UIA actions | **Not yet verified** | Requires interactive desktop. |
| Browser companion IPC | Not yet implemented | Existing extension preserved. |
| Tiny local GGUF runtime | Not yet implemented | Planned after deterministic routing foundation. |

## Browser core

Browser semantic observation, typed actions, live revalidation, stale recovery, task limits, local Ollama planner, bounded vision fallback, diagnostics, and Yahoo Mail skill remain implemented/automated-test verified on `develop`.

## Acceptance still required

- interactive Windows UIA/actions and focus-interference testing
- mixed DPI/multi-monitor + elevation/UIPI
- active-UIA long-run soak
- installed Chrome/Edge acceptance
- live extension-origin Ollama acceptance
- real Yahoo controlled workflow
- installer/update lifecycle

Automated CI success is not production acceptance.
