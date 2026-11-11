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
| SetValue + mutation receipts | Implemented / C# regressions added, **NOT RUN** | Verified receipts contain only fixed safe text; provider readback/detail is discarded. Unverified Invoke and SetValue effects report `UnknownEffect` and block automatic continuation. |
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
| Windows single-mutation write-ahead journal | Implemented / XUnit tests added, **NOT RUN** | Atomic create-new write-through record before provider mutation; one file, no queue or polling; blocks unresolved crash/restart actions. WPF runner wired for external verification, real Windows UNVERIFIED. |
| Single-use Windows approval primitive | Implemented / targeted XUnit tests added, **NOT RUN** | In-memory 32-byte SHA-256 digest; one pending approval; exact snapshot/action/target binding, max five-minute use-time expiry, clock-failure and rollback denial. Disposable WPF acceptance fixture wired; no production approval UI. |
| Production Windows journal path and reconciliation UI | **NOT IMPLEMENTED** | Host must provide access-restricted stable per-user path and explicit independently verified resolution; default action still denied without injected approval and journal. |
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

## Bounded DOM and text observation (2026-11-11)

| Capability | Status | Evidence and limitation |
|---|---|---|
| Hard observer overrides | Implemented / isolated JS checks **PASS** | 300 control refs, 8k visible text chars, 48k snapshot chars; caller overrides cannot raise limits. |
| Lazy browser DOM and frame scanning | Implemented / isolated JS checks **PASS** | Shared lazy walker; at most 12,000 interactive DOM nodes, 6,000 text nodes and 6,000 frame-discovery nodes per scan. No unbounded frame/interactive selector result arrays. |
| Bounded accessible names and label references | Implemented / 50 isolated observer tests **PASS**, Chrome/Edge **UNVERIFIED** | Reads at most 16 `aria-labelledby` IDs (within 2,048 attribute characters) or 16 live labels, scans up to 4,096 label-text characters, and marks incomplete names as partial snapshots. Avoids full label-list and joined-string allocations. |
| Bounded text normalization and shared scan CPU budget | Implemented / isolated tests **PASS**, Chrome/Edge **UNVERIFIED** | Normalizes huge strings without allocating an equally huge cleaned copy; per-value scan capped at 32,768 UTF-16 units, cumulative page-text scan at 65,536 units, output at 8,000 chars; overflow marks observation incomplete. |
| Bounded DOM read and verification | Implemented / 20 isolated adapter tests **PASS**; full suite **NOT RUN** | Read/verify stop after 6,000 text nodes or 65,536 examined characters; incomplete reads are flagged and partial text never proves successful verification. |
| Bounded select options | Implemented / isolated adapter tests **PASS**; live sites **UNVERIFIED** | Scans at most 2,048 live option entries, without `Array.from`; unknown scope blocks selection instead of guessing. |
| Incomplete large pages and nested frames | Implemented / isolated JS checks **PASS**, installed browsers **UNVERIFIED** | Marks DOM/text scan limits, exhausted visible-text budget, frame-count and frame-discovery limits, and nested-frame depth limits as truncated; consequential actions fail closed. |
| Chrome/Edge memory and CPU regression | **NOT RUN** | 45/45 observer unit, deterministic fuzz and integrated-snapshot tests pass under isolated V8 shims; measured browser heap/CPU and full Node suite still required. |

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

## Credential metadata and action-time protection (2026-11-11)

| Capability | Status | Evidence and limitation |
|---|---|---|
| Independent credential metadata checks | Implemented / isolated tests **PASS**, browser **UNVERIFIED** | A harmless name cannot mask a sensitive ID; prefixed password/OTP/payment autocomplete tokens, editable aria-labels, placeholders and contenteditable roles are checked. |
| Long metadata fail-closed | Implemented / isolated tests **PASS** | Name, ID, accessible hint or autocomplete exceeding a 256-character inspection bound is treated as sensitive instead of trusting only its prefix. |
| Unified observation/action gating | Implemented / 79 isolated tests **PASS**; full Node **NOT RUN** | Shared deterministic detector runs when describing controls and immediately before DOM actions, including focused-key dispatch; ordinary Show password buttons remain clickable. |
| Dynamic linked-label-only custom inputs | **UNVERIFIED** | Custom text inputs identified solely through separate associated label nodes still require dedicated installed-browser safety checks. |

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
