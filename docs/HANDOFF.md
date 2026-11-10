# Sightline Engineering Handoff

### Yahoo Mail bulk-action scope hardening — 2026-11-10

**Implemented in `develop` through `ce91b1f` (tests NOT RUN):** Search pagination total parsing now uses the explicit "Showing 1-50 of 300" total, or a labeled result count; ambiguous text produces no numeric count. A bulk Trash action cannot rely on arbitrary page/message text or a search URL alone: it requires a search route, an observed search control and a numeric result count. Selected-all on an unverified view is denied. Synthetic regression fixtures cover misleading search-result text, missing controls/count and Inbox select-all.

**Limitations:** The acceptance still requires real Yahoo search/selection tests with disposable messages, exact selection-set verification, and browser-origin JavaScript suite results. No claim of live Yahoo safety is made. The full Windows approval gate, unknown-effect journaling and retry prevention remain outstanding in [audit issue #9](https://github.com/DevTunaSoft/Sightline/issues/9).


### Windows sensitive UIA gate — 2026-11-10

**Implemented on `develop`, exact last source/test commit `ad28bf4` (tests NOT RUN):** `SensitiveControlPolicy` classifies password and credential/payment controls by UIA `IsPassword` plus bounded metadata matching. The desktop observer omits sensitive Name/AutomationId and marks leases as sensitive. The Windows action executor rejects sensitive leases before provider attach and rechecks the actual live provider before invoking or setting a value; denied actions do not return readback. Core and Windows safety regression tests cover sensitive/benign names, Invoke and SetValue rejection.

**Verification:** GitHub write success; local `dotnet` SDK unavailable and github.com DNS resolution failed, so no local .NET build/tests or live Windows acceptance. Report UNVERIFIED until `dotnet test windows/Sightline.Windows.sln -c Release` and `.\\tools\\test-windows.ps1 -Interactive` pass on the exact source revision. The separate **Windows confirmation policy (#6) remains NOT IMPLEMENTED** and desktop automation is not suitable for unrestricted autonomy.


## Security remediation checkpoint — 2026-11-10

A user-supplied 35-item reliability/security review is tracked in [issue #9](https://github.com/DevTunaSoft/Sightline/issues/9). **Treat it as triage, not 35 reproduced defects.** Current `develop` changes:
- Browser adapter refuses sensitive `verify`, `select`, `check`, `uncheck` and active `pressKey`. Safety gate/planner reject sensitive referenced operations; regression tests were added.
- Keyboard `Enter` and `Backspace` require high-impact confirmation, while `Delete` is no longer accepted by the typed protocol. Destructive label keywords were expanded.
- DOM `select` now requires an actual SELECT control; regression tests added.
- Windows diagnostic sanitizer handles quoted JSON and single-quoted assignments; synthetic canary regression cases added.
- Audit item #29 is stale: `npm run check` already invokes `npm test` from `package.json`.

**Verification:** GitHub file writes and readbacks PASS; full JS/.NET tests NOT RUN / UNVERIFIED at this checkpoint. Local clone failed due DNS, and the GitHub PR workflow/status lookup returned no results for the latest develop code. Do not infer CI or Windows safety acceptance. Recheck CI, run `npm run check` and Windows Core suite, and investigate failures before considering these fixes complete. The next high-risk work is Windows UIA secret handling/confirmation, then Yahoo destructive scope/count, then unknown-effect journaling/replay prevention. Do not duplicate existing PR #8 or other unmerged code.


Last updated: 2026-11-10

## Product

**Sightline** — *See. Understand. Act.*

Repository: DevTunaSoft/Sightline  
Integration branch: `main`  
Browser baseline: `develop`  
Current Windows work: `feature/windows-foundation-v0` / PR #6

## Direction

Lightweight standalone Windows application plus the existing Chrome/Edge browser companion. Core rule: **structured information before pixels; deterministic software before AI.**

## Verified automated checkpoint

- repository reconciliation: **PASS**
- browser validation: **PASS**
- extension packaging: **PASS**
- Windows restore/build: **PASS**
- Core tests: **PASS**
- Windows safety tests: **PASS**
- WPF fixture/interactive runner compilation: **PASS**
- bounded diagnostics/resource probes: **PASS**
- real interactive Windows UIA acceptance: **UNVERIFIED**

## Implemented Windows foundation

- .NET 8 dependency split
- FlaUI/UIA3 isolated in `Sightline.Windows`
- bounded/fail-closed UIA observation and target resolution
- session-scoped element leases and process/window identity binding
- Invoke + SetValue/readback
- stale-ref/window/snapshot rejection
- focus verification
- Win32 user-activity lease with no polling/hooks
- bounded per-process UIA circuit breaker
- bounded structured diagnostics + rotating/redacted file sink
- resource sampler with managed heap and total allocation
- repeated-session resource soak
- bounded top-level Win32 window discovery exposed through the long-lived automation session
- deterministic WPF target and acceptance harness

## Resource findings

Run #249: 1,000 short-lived session cycles allocated ~11.24 MB; forced GC returned live managed heap to ~0.3 MB, proving allocation churn rather than retained managed objects.

After lazy element/diagnostic storage, run #251 measured ~0.84 MB allocation for the same 1,000 cycles (~92.5% reduction). Post-GC managed heap ~0.32 MB; retained working set ~+0.23 MB; no positive private-memory growth; handles +1; threads +0.

Memory growth remains a defect. Do not introduce unbounded queues, caches, logs, screenshot stores, model contexts, or model lifetimes.

## Still unverified

- real interactive UIA observation/Invoke/SetValue
- focus theft/user interference
- mixed DPI/multi-monitor
- elevation/UIPI
- active-UIA long-run soak
- browser IPC
- tiny GGUF runtime
- installer/GUI

## Next implementation order

1. keep allocation/resource regression guards green
2. run `.\tools\test-windows.ps1 -Interactive` on a real Windows desktop
3. moving-target/geometry protection before any physical-input fallback
4. extend deterministic Windows capabilities from bounded window discovery into explicit launch/attach and process metadata
5. add filesystem capability after process/window behavior is stable
6. checkpoint + unknown-effect reconciliation contracts
7. bounded browser companion IPC
8. vision/OCR
9. tiny local GGUF runtime

## Recovery

Inspect PR #6 and latest CI first. Fix the first failing root cause and do not repeat unchanged failures. Preserve PASS/FAIL/BLOCKED/NOT RUN/UNVERIFIED language.
