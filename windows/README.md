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
- semantic Invoke and SetValue; SetValue verifies readback **internally**, never returns field text in receipts
- a changed-but-unverified SetValue reports `UnknownEffect` and must be reconciled before retry
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


## Typed Windows action limits

`DesktopActionValidation` rejects unsupported enum kinds, blank or oversized element references (128 characters maximum), Invoke payloads containing a value, and SetValue without a value or exceeding 4,000 characters. Validation runs before provider access or approval policy, and does not log rejected payloads. Exact .NET tests still require a real SDK/CI run on the latest commit.

## Durable Windows mutation journal (2026-11-11)

The Windows `Invoke` / `SetValue` executor now **requires both** a trusted action-approval provider and an explicit durable `IDesktopMutationJournal`. If either is missing, it refuses mutation before attaching to UI Automation.

`FileDesktopMutationJournal` uses exactly one pending write-through, create-new file and a small 256-byte stream buffer. No background thread, watcher, polling, queue, or in-memory history is created. The file contains only version, process ID, window handle, random record ID, action kind and time. **Field values, DOM text, snapshot IDs and element refs are not written.**

A record must be flushed to storage before the provider mutation begins. A **verified** SetValue clears it. An **unverified** Invoke now returns `UnknownEffect` with `Ok=false` even if the provider accepted the call, because an accepted UIA method is not proof of an application effect. Cancellation, provider failure or crash also leaves the record pending. An existing pending record blocks further mutations across process restarts. An Invoke requires *independent application-state verification* before a trusted host may call `TryCompleteVerified`. The controlled WPF acceptance runner provides this verification using its own `ResultText`; production does not yet provide a trusted reconciliation UI or persistent per-user journal path.

The journal's path must be a stable, access-restricted local path chosen by the trusted Windows host, not a webpage, AI-generated path or disposable temporary path. Do not manually delete pending records until the prior operation has been independently reconciled. A corrupt/partial pending record must fail closed.

**Verification status:** code and targeted XUnit tests committed, but the latest `.NET` build/test and interactive WPF acceptance are **NOT RUN / UNVERIFIED**. This is a safety foundation, not a production-ready Windows action workflow.


## Single-use Windows approval primitive (2026-11-11)

`OneShotDesktopActionApproval` is a lightweight Core implementation of `IDesktopActionApproval`. The *trusted host UI* must call `ArmAfterUserConfirmation(snapshot, action)` only after the user reviews the exact proposed operation; model output, webpage text, and remote code are **not** allowed to arm it.

The primitive stores only one 32-byte SHA-256 fingerprint and an expiration timestamp. The fingerprint binds process, window, snapshot identity and capture time, target reference/name/automation ID/type/depth, semantic action kind and any proposed value. It does **not** retain plaintext typed values or full snapshots. Strings are hashed directly from UTF-16 spans without allocating temporary plaintext encoding buffers, and differences between distinct UTF-16 sequences are preserved. The host's `IsApproved` call consumes a valid approval before UI Automation starts. Expiry is checked on use (default two minutes, maximum five); missing or ambiguous controls, a truncated observation, a changed action, clock faults or clock rollback are rejected. No timers or background services are used.

The disposable WPF acceptance runner now exercises this same primitive with **test-fixture-only** authorization checks and verifies a token cannot be reused. This is **not** a production confirmation dialog, review screen, or end-user approval flow.

**Verification gate:** Core XUnit tests for one-use behavior, concurrency, expiry, clock changes, value binding, duplicate controls and revocation are committed but **NOT RUN** in this environment (no .NET SDK). Real Windows acceptance remains **UNVERIFIED**.


**Additional fail-closed checks (2026-11-11):** The approval primitive revokes previous approval if an observed control list is malformed or throws during inspection. Credential-named and unidentifiable controls cannot be approved. A small Core result policy normalizes accepted-but-unverified UIA outcomes to `UnknownEffect` and strips any returned field text. Focused XUnit regressions are present, but the latest .NET build and Windows acceptance remain **NOT RUN / UNVERIFIED**.
