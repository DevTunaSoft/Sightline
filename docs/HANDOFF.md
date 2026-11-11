# Sightline Engineering Handoff

### 2026-11-11 — Follow-up hardening: multilingual prompt ceiling and Yahoo select-all scope

**Baseline:** same `develop` branch, existing audit #9 and open Windows PR #8. No new PR or branch, no duplicate implementation.

Additional changes since the preceding checkpoint: `2d4a4dd` refuses any active Select-all checkbox when evaluating Yahoo bulk Trash, **even when a search URL/control/count are present**; the selected message identity and page-spanning selection scope are still unknown. Regression test added at `348484b`. `8c78a90` adds a conservative 6,400-token heuristic ceiling to the existing 18k-char local planner budget; `f9304c2` adds multilingual input/fail-closed tests. `f3bf6ae` applies the same estimated token reserve to model-output repair attempts; no unbounded retry loop. Tests and payload refinements are in `fbf2785`, `408946d`, `8b23211`, `6e591d3`, `2f34b57`, `fc01962`.

**Executed evidence:** 16 original Yahoo skill + challenge-blocker tests **PASS** under isolated V8 URL/assert shims, 0 failed; 11 original planner-core tests **PASS** with the real checked action validator and page-bounder injected into V8, 0 failed; focused original-source planner-client checks showed omitted ref rejection (2 bounded attempts), visible-ref acceptance, and capped invalid-response feedback ending in a system guardrail. Full Node `npm run check`, actual Ollama model/tokenizer behavior, Chrome/Edge/Yahoo target acceptance, .NET/Windows, and performance soak remain **NOT RUN / UNVERIFIED**. GitHub DNS resolution fails for local git; no verified new CI result yet. The estimate is deliberately conservative, **not a proven tokenizer guarantee**, and cannot prove immunity to prompt injection.

**Behavioral caveat:** Select-all Trash remains fail-closed until reliable message identities and selected-count evidence exist. Do not auto-retry uncertain Trash actions or claim Yahoo acceptance.


### 2026-11-11 — Mail challenge safety and bounded local-planner prompt

**Baseline:** inspected `develop`, existing audit issue #9, open PR #8, and the current browser/planner tests before touching code. No duplicate feature branch or PR created.

**Changes:** `extension/skills/yahoo-mail.js` now ignores email body/subject phrases when detecting MFA/CAPTCHA/recovery while on the mailbox route, but still recognizes named authentication UI controls and non-mailbox login pages (commit `df7882a`; tests `b9b28a2`). This is structure-based preventive hardening, not verified Yahoo markup coverage.

`extension/planner-core.js` now projects semantic page state into a bounded prompt (11,000-character presented snapshot, 2,000-character visible-text slice, 18,000-character total message budget) while keeping original snapshot identity, sanitizing recent action history to omit typed values and URLs, and repeating untrusted-page security rules at the end of the prompt (commit `fbf2785`). `extension/planner-client.js` parses model decisions against the **presented** refs, blocking refs omitted from compacted pages; its one repair retry includes at most 500 characters of rejected model output and finishes with a trusted instruction under the same message budget (commits `408946d`, `2f34b57`). Tests added in `tests/planner-core.test.js` and `tests/planner-client.test.js` (commits `8b23211`, `6e591d3`, `fc01962`).

**Evidence:** PASS — 5 original Yahoo blocker tests and 9 original planner-core tests executed in isolated V8 with explicit URL/dependency shims; focused exact-source local-planner integration checks confirmed a trimmed ref was rejected after 2 bounded attempts, a visible ref accepted, and capped invalid-output feedback with final trusted guardrails. Source syntax checked for the planner client. GitHub commits and file readback are verified. These checks are **not the complete Node suite, a true Ollama tokenizer/context-window validation, or live installed Yahoo/Chrome/Edge acceptance**. BLOCKED: this environment cannot resolve github.com through git; `.NET` SDK unavailable. Full `npm run check` / browser acceptance **NOT RUN**; runtime performance remains **UNVERIFIED**.

**Remaining:** dynamic page/message-role challenge detection and local-model prompt truncation need actual browser/Ollama testing. Character budget is conservative but **not a tokenizer guarantee** for all languages/models. No claim of full prompt-injection resistance, production readiness or acceptance. Next: execute Node regression suite on the current `develop` SHA; investigate any failures, then validate with installed Chrome/Edge/Yahoo and local Ollama; continue Windows approval lifecycle and effect reconciliation.


### 2026-11-11 — Structural action evidence and Yahoo Trash fail-closed verification

**Baseline inspected:** `develop`, existing issue #9 and open PR #8. Browser write-ahead checkpoints/replay blockers already existed and were preserved; no duplicate recovery implementation or PR created.

**Change set:** `extension/skills/yahoo-mail.js` no longer treats disappearance of sampled mail rows, pagination changes, a falling result count, or untrusted page-body success text as proof that a Trash operation succeeded (commit `c2c1883`). Result-count decreases on an unchanged search route remain **supporting evidence only**, with `verified: null`. Fail-closed behavior intentionally requires manual reconciliation until a trustworthy result oracle exists. `tests/yahoo-mail-skill.test.js` and the Yahoo browser-task-runner fixtures were updated for this stricter contract (commits `35203bd`, `2efda0b`). **Production limitation:** automated Yahoo Trash completion is blocked by inconclusive verification, even when the UI may have executed the mutation; never auto-retry.

`extension/page-observer-core.js` now provides `hasTargetStructuralEffect`: rejects truncated/incomplete snapshots and duplicate targets; compares exact intended navigation, target disappearance and meaningful target control state rather than general visible text, volatile snapshot hashes or unrelated controls (commit `eae4c35`). `extension/page-agent.js` uses bounded re-observation against that predicate before treating a consequential action as changed (commit `0099d88`). Regression tests cover clocks, unrelated control changes, duplicated targets, target disappearance, checkbox changes, and false verification (commits `b4b1592`, `6ce251d`).

**Executed verification in this session:** PASS — original GitHub `tests/yahoo-mail-skill.test.js` through isolated V8 test shim: 10 passed, 0 failed; original GitHub `tests/page-agent.test.js` through isolated V8 dependency injection: 9 passed, 0 failed; original GitHub `tests/page-observer-core.test.js` through isolated V8 shims: 13 passed, 0 failed; three direct structural predicate checks passed; extracted source syntax compilation PASS. **Not equivalent to `npm test`:** tests ran with small shims, not the Node runner, Chrome, Edge, or actual Yahoo DOM; host URL handling was simulated. Full `npm run check` and installed-browser/Windows acceptance remain **NOT RUN / UNVERIFIED**, because repository checkout over GitHub DNS is unavailable. No CPU/RAM soak results recorded for these changes.

**Remaining:** #13/#14 site-specific effect oracles and real target-identity validation still need device acceptance, especially dynamic pages; #28 stable message-ID and observed selection confirmation remain incomplete. Review the tests on the exact latest `develop` commit, fix any regressions, and preserve fail-closed no-replay behavior.


### Browser confirmation and verification correctness — 2026-11-10

**Source on `develop`:** `40987f4` and `0673305`; regression test `abd3141`. Confirmation context is cleared at the beginning and in `finally` for each browser action invocation so failed/throwing actions cannot leave stale confirmation context attached to a later action. `verifyBrowserReceipt` rejects site-specific checks that are explicitly false or inconclusive, rather than accepting generic `receipt.ok` as proof of effect. Synthetic regression tests cover failed/inconclusive/passing site checks.

**Limitations:** Only actions with an applicable site-specific verifier gain this stronger effect requirement. Generic clicks and dynamic pages still lack a universal structural-effect oracle; do not claim complete audit #13/#14 resolution. Tests **NOT RUN** and installed-browser acceptance **UNVERIFIED** at this checkpoint. Prior browser crash/write-ahead mitigation was already implemented on this branch; it was not recreated.


### Browser crash-safe checkpoint hardening — 2026-11-10

**Scope:** Audit findings #15, #16 and #17, plus the browser portion of #9. Source commits include `8e9e4d6` (write-ahead record), `fc7bf05` (stop on failed persistence), `4a322c4` (sanitized error timeline), `d85e845` (review persistence before confirmation), `0ba5039` (stop on unverified effects), and subsequent tests through `b69d2bd`.

**Behavior changed:** `runTaskLoop` records each action with `UNKNOWN_EFFECT` and awaits the checkpoint **before** executing it. If saving fails, the action is not performed. If execution throws or an outcome cannot be determined, the in-flight record remains and the task stops. If saving the completed receipt fails, the operation is classified as uncertain rather than silently retrying. On task restoration, unknown/in-flight/no-verified-effect records return `ACTION_RECONCILIATION_REQUIRED` before observation, planning or execution. The panel refuses to start without the initial checkpoint, propagates checkpoint persistence failures, and does not open a high-impact approval card until the review save finishes. The checkpoint is bounded to 40 sanitized entries, without typed values or navigated URLs.

**Regression coverage added, but NOT RUN:** `tests/task-loop-core.test.js` covers write-before-execute order, pre-/post-execution checkpoint failures, execution exceptions, no replay of unknown and unverified actions. `tests/task-checkpoint.test.js` covers persisted secret-free unknown action and review state. `tests/browser-task-runner.test.js` covers storage failure and resume without running browser operations. Older tests were not removed.

**Evidence:** GitHub source/test commits are recorded; GitHub readbacks are required at the latest revision. Node 22 exists locally but checkout/clone cannot resolve github.com, so JS suite execution is **BLOCKED/NOT RUN**; no installed Chrome/Edge real crash-fault acceptance. This is **fail-closed preservation and manual reconciliation**, not automated idempotent effect recovery. Windows write-ahead journaling and real acceptance remain outstanding. Next tasks: run `npm run check` on `develop`, examine failing tests, perform controlled browser crash/restart recovery, implement durable effect reconciliation where safe. Avoid any automatic replay of uncertain destructive operations.


### Browser observer and action hardening — 2026-11-10

Reviewed five new source observations against `develop`, with source+regression changes through commit `3ee180b`. **All changes are committed; tests NOT RUN / UNVERIFIED.**

1. `page-observer.js`: empty/whitespace/undefined CSS opacity is no longer coerced to zero. Truly zero opacity, hidden display/visibility and zero-sized elements still fail observation. Deterministic `tests/page-observer-visibility.test.js` was added.
2. `browser-bridge.js`: strict http/https allowlist now stands alone without redundant prohibited-scheme set. Agent bootstrap uses a bounded 8-delay backoff (20–200 ms), revalidating the task tab before retry; tests cover slower readiness and rejected schemes. No background polling or dependency added.
3. `dom-action-adapter.js`, `safety-gate.js`, `planner-core.js`: sensitive `click` is now refused at execution, risk-gating and planning boundaries; a previously missed sensitive `uncheck` guard was also added, with tests.
4. `dom-action-adapter.js`: value assignment now searches a capped (12-level) prototype chain for an inherited `value` setter and falls back to direct assignment; regression test exercises a setter above the immediate prototype.
5. Browser tests updated in `tests/dom-action-adapter.test.js`, `tests/safety-gate.test.js`, `tests/planner-core.test.js`, and `tests/browser-bridge.test.js`.

**Verification status:** PASS — GitHub source/test commits and readbacks. BLOCKED — local `git ls-remote` reports DNS resolution failure for github.com. NOT RUN — `npm run check` / installed Chrome and Edge smoke tests on exact updated commit. Remaining concerns: values in sensitive fields must never appear in general document text, focus/keyboard authorization still needs live tests, confirmation and crash recovery remain high priority in audit issue #9.


### Browser sensitive-name classifier — 2026-11-10

Audit #12 addressed in `develop` through `57f3533`: detection now matches normalized name tokens instead of arbitrary substrings, preventing ordinary fields such as `shipping`, `mapping` and `compass` from being treated as passwords. CamelCase, underscore and dash credential names remain recognized. Input-name inspection is capped at 256 characters. Targeted tests added in `tests/page-observer-core.test.js`; **full JavaScript suite NOT RUN / UNVERIFIED** on the latest branch.


### Windows typed action bounds — 2026-11-10

Implemented on `develop` through `6e53264`: `DesktopActionValidation` rejects unsupported action types, missing/oversized refs, invalid Invoke payloads, missing SetValue values and SetValue text over 4,000 characters before approval/provider access. Focused Core regression test added. **NOT RUN / UNVERIFIED** on this commit: local .NET SDK unavailable. Continue with Windows build/CI acceptance, production approval UI and durable unknown-effect journaling.


## Windows action safety checkpoint — 2026-11-10

**Development branch:** `develop`; source/test commits include `0bdf8e1` (approval interface), `70bcb7f` (denial and mutation-phase uncertainty), `90ebc88` (session injection), `1ddead4` (WPF fixture-only approval), `50f8ea9` (denial tests), and `586892f` (approval exception fail-closed).

**Implemented:** All UIA `Invoke` and `SetValue` calls now require an explicit trusted `IDesktopActionApproval` policy; default is `ConfirmationRequired` and no provider attach. Approval exceptions fail closed. The acceptance runner has a tightly scoped test-target-only approval. A provider exception or cancellation after beginning mutation is classified `UnknownEffect` to prevent misleading safe-to-retry conclusions. Focused tests were added for absent, denying and throwing approval providers, and for sensitive values not appearing in denials/diagnostics.

**NOT IMPLEMENTED:** Production confirmation UI, time-limited single-use approval tickets, unknown-effect write-ahead journal / crash recovery, post-action verification after Invoke, and real interactive Windows acceptance. Do not call audit #6 or #9 closed. **NOT RUN / UNVERIFIED:** No local .NET SDK; no Windows CI evidence inspected for these latest commits. Required next: run the exact source through the Windows build/tests and interactive acceptance, then add a durable unknown-effect transaction/reconciliation layer.


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
