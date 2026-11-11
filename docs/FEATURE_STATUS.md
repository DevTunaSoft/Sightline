# Sightline Feature Status

Last updated: 2026-11-11

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
| SetValue + readback | Implemented / regression tests added, **NOT RUN** | In-process comparison only; `Readback` is never returned. Mismatch returns `UnknownEffect` (no automatic retry). |
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
| Windows UIA target identity hardening | Implemented / tests added, **NOT RUN** | Matches all observed type/AutomationId/Name fields and refuses empty identity; runtime ID, hierarchy and geometry checks remain missing. |
| Windows focus sensitive-field protection | Implemented / tests added, **NOT RUN** | Refuses sensitive leases and rechecks the live password flag before focus; real Windows not verified. |
| Depth-boundary leaf truncation | Implemented / tests added, **NOT RUN** | Inspects existence of deeper child only; leaf at exact depth no longer incorrectly marked partial. |
| Windows typed action validation | Implemented / tests added, **NOT RUN** | 128-character max ref, 4,000-character max SetValue, typed payload validation before provider access. |
| Windows unknown-effect status | Implemented / **UNVERIFIED** | Mutation-phase exceptions and cancellations report UnknownEffect; crash-proof journaling/reconciliation remains missing. |
| Real Windows UIA actions | **Not yet verified** | Requires interactive desktop. |
| Browser companion IPC | Not yet implemented | Existing extension preserved. |
| Tiny local GGUF runtime | Not yet implemented | Planned after deterministic routing foundation. |

## Browser crash-recovery safeguards (2026-11-10)

| Capability | Status | Notes |
|---|---|---|
| Browser write-ahead action record | Implemented / tests added, **NOT RUN** | In-flight action checkpoint precedes execution; failed save blocks execution. |
| Unknown-effect replay prevention | Implemented / tests added, **NOT RUN** | Restored unknown/unverified effects block replanning; manual reconciliation still required. |
| Confirmation checkpoint serialization | Implemented / tests added, **NOT RUN** | Review checkpoint must persist before approval is shown. |
| Full crash recovery | **Incomplete / UNVERIFIED** | No automated effect reconciliation; installed-browser fault injection pending. |

## Browser memory and post-action safety (2026-11-11)

| Capability | Status | Evidence and limitation |
|---|---|---|
| Wait listener/timer cleanup | Implemented / isolated tests **PASS**, Chrome/Edge **UNVERIFIED** | 120 consecutive zero-delay waits retained no abort listeners after completion; cancelled wait also removed its listener. No background polling. |
| Browser DOM reference hard ceiling | Implemented / isolated tests **PASS**, installed-browser **UNVERIFIED** | Capped at 300 references even with Infinity/oversized constructor inputs; map cleared on snapshot replacement. |
| Small task-stall fingerprint | Implemented / isolated tests **PASS**, heap profiling **NOT RUN** | Replaces long retained JSON action keys with one numeric fingerprint; no typed text/URL retained in progress guard. |
| Post-dispatch unknown-effect classification | Implemented / isolated integration test **PASS**, real workflows **UNVERIFIED** | Mutation exceptions or cancellation after adapter dispatch report `UNKNOWN_EFFECT`, with sanitized message and crash replay blocked by checkpoint. |
| Complete Node/Chrome/Edge RAM and regression verification | **NOT RUN / BLOCKED** | Container has Node 22 but GitHub clone fails DNS; GitHub connector enables commits and isolated test execution only. No production RAM percentage claimed. |

## Browser confirmation and Windows readback safety (2026-11-11)

| Capability | Status | Notes |
|---|---|---|
| Browser single-use approvals | Implemented / 18 isolated regression checks PASS; full Node tests **NOT RUN** | Random 128-bit token, exact action/target/page binding, one pending ticket, five-minute use-time expiry; failed observation and RNG errors invalidate or refuse approval; no background timers. Installed Chrome/Edge unverified. |
| Browser action validation before confirmation | Implemented / isolated tests PASS; real browser **UNVERIFIED** | Reuses typed action protocol; oversized or invalid requests are denied before approval issuance and execution. |
| Browser verify receipt privacy | Implemented / 11 isolated adapter regressions PASS; full suite **NOT RUN** | Verification returns only match verdict/ref, not raw expectation text; installed-browser privacy acceptance unverified. |
| Windows secret-free SetValue receipt | Implemented / tests added, **NOT RUN** | Internal readback compares exact requested value but never returns field contents. Mismatch is UnknownEffect, not a retry-safe failure. |

## Browser security and local-planner hardening (2026-11-11)

| Capability | Status | Notes |
|---|---|---|
| Yahoo challenge identification from UI controls | Implemented / isolated checks PASS; full Node suite **NOT RUN** | Avoids treating quoted MFA/CAPTCHA email text as a real challenge; live Yahoo markup UNVERIFIED. |
| Yahoo selected-all Trash guard | Implemented / isolated checks PASS; installed browser **UNVERIFIED** | Refuses select-all bulk Trash until stable message identities and exact scope can be verified. |
| Conservative local planner context | Implemented / isolated checks PASS; real Ollama **UNVERIFIED** | 11k presented snapshot chars, 2k page-text chars, 18k message chars, 6.4k heuristic token ceiling for an 8,192-token configuration. Not a tokenizer guarantee. |
| Hidden planner refs / secret-bearing action history | Implemented / isolated checks PASS; installed browser **UNVERIFIED** | Validates model actions against only shown refs and omits typed data/URLs from action history. |
| Bounded invalid-output repair | Implemented / isolated checks PASS; real Ollama **UNVERIFIED** | One bounded retry can include up to 500 chars of rejected model output, followed by trusted guardrails. |

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
