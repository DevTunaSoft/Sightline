# Sightline Engineering Handoff

### 2026-11-11 — Independent sensitive metadata and action-time guard

**Reconciled actual `develop` baseline:** Audited current browser observer, shared field classifier, DOM adapter, action protocol, safety gate, user manual, audit issue #9, and open PR #8 (unrelated Windows inspection). No duplicate branch or PR, dependency, worker or polling was added. Previously implemented field-type/name/autocomplete checks and click/keyboard guards were preserved.

**Confirmed security gap:** The observer and adapter passed `name || id` as a single field. Thus a harmless `name` could hide a sensitive `id`, and prefixed HTML autocomplete tokens or accessible hints on text-entry controls were overlooked. These could cause the observer to expose a text field as nonsensitive and the adapter to act on it.

**Code:** `extension/page-observer-core.js` commits `edf09d4`, `835ce71` independently examine name and ID (each bounded at 256 chars), recognize space-delimited autocomplete tokens (including `section-login current-password`), inspect aria-label/placeholder on editable roles (but not ordinary Show password buttons), and conservatively deny overlong uninspectable metadata. Observer and action adapter call the same classifier with consistent metadata in commits `046f7ec` and `3c64674`. Max processed metadata is fixed and no data is cached.

**Regressions:** `tests/page-observer-core.test.js` (`dc324b5`, `d88c684`), `tests/dom-action-adapter.test.js` (`0688390`), and `tests/page-observer-snapshot.test.js` (`5de5af0`) cover name-masked password IDs, prefixed autocomplete, text-entry aria/placeholder, long strings, readonly observations, post-snapshot execution gating, credential redaction and ordinary button compatibility.

**Executed evidence:** `79/79 PASS` across the exact current GitHub observer-core, visibility, snapshot and DOM-adapter test functions in isolated V8 with URL/DOM/Abort shims. An initial local test harness omitted injected `PAGE_OBSERVER_LIMITS` and `DOMException`, producing 6 harness-related failures; after correcting the harness injection, all `78/78` tests passed, then the additional long-metadata test brought the current result to `79/79`, no failures. The final source and regression files were read back from `develop`. This is not the Node `npm run check` runner or installed browser.

**Still NOT RUN / UNVERIFIED:** complete Node suite, Chrome/Edge real-site credential controls, external linked-label-only custom fields, DOM change/race testing, actual memory/CPU/heap metrics, .NET/Windows acceptance and CI at this SHA. The credential guards are a partial security mitigation rather than complete browser safety certification. Next check linked-label-only controls with a bounded approach; add installed Chrome/Edge acceptance and measure long-session resource usage.


### 2026-11-11 — Bounded accessible-name extraction and reduced per-control allocations

**Baseline audited:** Existing `develop` code already had a hard-bounded DOM/frame scan, text normalizer, select-option limit and observer regression suite. Issue #9 remains the audit tracker and PR #8 remains the only open PR. A distinct allocation defect remained in `extension/page-observer.js`: `aria-labelledby` used unbounded `split/map/join`, and the live `element.labels` collection was expanded with `[...labels]` before applying its short text limit. This could allocate large temporary arrays/strings while observing a webpage despite the final name being capped.

**Implementation:** Commit `2085915` replaces both paths with incremental, bounded extraction: at most **16 referenced IDs** from the first **2,048 attribute characters**, or **16 indexed live labels**, and at most **4,096 source text characters** inspected per label aggregation. Ordinary short accessible names preserve their original output. Missing parts of a long name cause `snapshot.truncated = true` and end the current control scan so consequential actions cannot rely on an incomplete identity. The same fail-closed behavior applies to oversized aria/placeholder/title/fallback labels. Commit `eb69ec9` removes an unnecessary full control-descriptor spread/copy by sharing one tiny truncation-status object across the observation. No dependencies, event listeners, timers, worker, resident model or background polling were added.

**Regression tests:** Commit `0ca5572` adds integrated observer cases for thousands of `aria-labelledby` tokens, million-entry synthetic live label collections (index reads capped at 16), huge individual labels, and ordinary short `labels`/`aria-labelledby` output. **PASS: 50/50 original and new observer-core, visibility and integrated-snapshot tests**, executed against the latest GitHub `develop` source using isolated JavaScript V8 with controlled DOM/URL shims. No failures in the final regression run. GitHub source and test file commits/readback were verified.

**Limitations:** Full `npm run check` and installed Chrome/Edge acceptance remain **NOT RUN / UNVERIFIED**; direct git checkout still fails github.com DNS and the current container has no .NET SDK. An in-browser `textContent` getter can itself allocate within the browser; Sightline avoids additional unbounded aggregation and normalization but cannot promise a maximum browser heap from these unit checks. No real heap, CPU or scan-latency benchmark was executed. The deliberate safety tradeoff is that large accessible names now trigger incomplete observations rather than an action on a truncated label.

**Next:** run exact-commit CI and installed-browser regression, benchmark heap/CPU for many labels and long mixed DOMs, and continue production Windows consent/reconciliation on a .NET-equipped machine. Maintain structured-first, bounded in-memory state and single authoritative handoff.


### 2026-11-11 — Bounded DOM read/verify and select-option scanning

**Baseline:** Continued from the same audited `develop` browser observer/text-normalizer checkpoint. Inspected `extension/dom-action-adapter.js`, its existing tests, validation, registry and action-executor instead of duplicating read/verify functions.

**Further confirmed CPU/RAM gaps:** Even with the shared text collector's scan budget, DOM `read`/`verify` continued walking text nodes while `collector.full` was false; extremely whitespace-heavy content could therefore keep scanning. `select` also used `Array.from(element.options)`, materializing an unbounded options array before checking a requested selection.

**Changes:** `extension/dom-action-adapter.js` (`8112cee`) caps read/verify text-node visits at 6,000, uses the existing 65,536-character shared source-scan limit, stops on either limit, marks partial reads `INCOMPLETE_OBSERVATION` and denies positive verification from incomplete text. Complete short reads/verification remain supported. `0e54532` removes the full options-array copy; it scans at most 2,048 live select options, returning `OPTION_SCOPE_UNVERIFIED` without mutation when a requested item cannot be found within the inspected prefix, and `OPTION_NOT_FOUND` when the inspected complete option list is empty or lacks the target. No new dependencies, timers or background services.

**Regression evidence:** `tests/dom-action-adapter.test.js` adds normal and oversized read/verify tests, bounded text node traversal, aggregate scan exhaustion and select-option limits (commits `5bac333`, `b3b8e62`). **PASS: 20/20 DOM adapter tests** executed against current GitHub source in isolated V8 with minimal DOM/Event/Abort shims. The previously recorded **45/45 observer tests** also passed against the exact current observer source in a separate isolated V8 run. **Total: 65/65 targeted checks PASS, 0 FAIL.** These do not replace full Node `npm run check` or installed Chrome/Edge acceptance.

**Repository integrity correction:** A GitHub write was briefly addressed to the literal root path `develop` on default `main` instead of `tests/dom-action-adapter.test.js` on branch `develop` (mistaken commit `a836297`). This was diagnosed from the actual commit's file list. The unintended `main/develop` file was deleted (`edc55d2`), its absence was read back, and the three select tests were committed to the correct existing test path on `develop` (`b3b8e62`) with a 20-test readback and PASS rerun. No extra branch or PR was created. All subsequent writes specify the exact `path` and `branch` explicitly.

**Remaining unverified:** Complete `npm run check`, GitHub Actions result for the final SHA, installed Chrome/Edge real-site read/verify/dropdown behavior, long-session RAM/CPU and scan-latency comparison, Windows .NET build and interactive acceptance. Local `git ls-remote` still cannot resolve github.com, and `dotnet` is missing. The added limits are architectural safeguards; no measured production memory improvement or bug-free claim is made.

**Next:** Execute repository-wide Node CI, then controlled Chrome/Edge large-DOM read/verify/select benchmarks and end-to-end safety checks. Review remaining accessibility-name/label construction paths for unbounded intermediate arrays. Continue Windows approval/reconciliation only with actual Windows CI and acceptance evidence.


### 2026-11-11 — Bounded text normalization and cumulative CPU safeguard

**Baseline:** Reviewed live `develop`, open PR #8, audit issue #9, current page observer/normalizer, integrated snapshot tests, feature status and roadmap. Existing lazy DOM/frame walkers and hard caps remain intact; no duplicate implementation, PR, branch, dependency, polling or background worker introduced.

**Confirmed defect:** `cleanPageText` and `createBoundedTextCollector` performed `String(...).replace(/\\s+/g, ' ').trim()` against complete DOM node strings *before* slicing to 240/8,000 output characters. An unusually large text node could create a proportional temporary normalized string, defeating the memory cap. Across many whitespace-heavy nodes, per-node input work could still be excessive despite the text-node count limit.

**Source changes:** `extension/page-observer-core.js` now uses a single internal bounded prefix normalizer. Small inputs keep the original fast regular-expression path, while longer values are streamed one UTF-16 code unit at a time, preserving whitespace collapsing and trailing-space semantics without materializing a giant normalized copy. It examines at most **32,768 UTF-16 units per value**, outputs at most **8,000 characters**, and the text collector additionally enforces **65,536 total source units per observation**. Exhausted scan budget returns an incomplete status; the caller cannot treat omitted text as a complete observation. Commits `7b23b69`, `4cc0a32`, `3d1bd1d`.

`extension/page-observer.js` propagates the shared scan budget into `buildPageSnapshot` and stops its text TreeWalker when the collector is exhausted, preserving `snapshot.truncated=true` for incomplete page coverage (`1ceb297`). No new retained DOM references, worker threads, timers, network calls or AI model activity.

**Regression coverage:** Original tests plus new huge-string, Unicode whitespace equivalence, leading-space budget, bounded configuration, aggregate source-scan, no fabricated separators, integrated snapshot exhaustion and seeded 160-case fuzz tests in `tests/page-observer-core.test.js` and `tests/page-observer-snapshot.test.js` (`c51c395`, `1e3d0bf`, `0bff20a`, `c3a7ef9`). The latest source and all three observer test files were fetched directly from GitHub and executed under isolated V8 with the existing URL/fake-DOM shims: **45/45 PASS, 0 FAIL**. This is a real isolated source-level check, **NOT** a full `node --test` or installed-browser run.

**Execution limitations:** Container has Node 22.16.0 but `git ls-remote` cannot resolve `github.com`; no working copy of the repository could be retrieved for `npm run check`. `dotnet` is absent; latest Windows build/XUnit/WPF acceptance **NOT RUN**. Actual Chrome/Edge allocation, retained heap, CPU and page-scan latency comparisons are also **NOT RUN/UNVERIFIED**. The low-allocation design is demonstrated by bounded scanning logic, **not** a measured production RAM reduction or proof of zero memory leaks.

**Next unblocked work:** When checkout/CI is accessible, run `npm run check` on the exact `develop` revision, then Chrome/Edge long-page and 1,000-cycle snapshot soak with before/after heap, idle CPU and scan latency measurements. Review accessibility-label construction for any remaining large intermediate arrays; preserve sensitive-field privacy and fail-closed truncated snapshots. Windows production approval UI and pending-action reconciliation still require real .NET/interactive acceptance.


### 2026-11-11 — Bounded nested-frame discovery and text-coverage integrity

**Baseline and no-duplication check:** Audited live `develop`, existing observer/test modules, audit issue #9 and the only open PR (#8, Windows process inspection). Interactive DOM observation was already lazy and capped, but `collectFrameContexts` still allocated the entire `querySelectorAll('iframe,frame')` result before applying its 20-frame limit. The page-text collector also failed to mark snapshot coverage incomplete when it filled its character budget. No new branch, dependency, background thread or polling was introduced.

**Code:**
- `extension/page-observer-core.js` adds an explicit `maxFrameNodesVisited: 6000` hard ceiling; `normalizeObservationLimits` prevents external overrides from increasing it (`8161185`).
- `extension/page-observer.js` shares one lazy `walkDocumentElements` helper between interactive discovery and nested-frame enumeration, avoiding an unbounded selector NodeList. Frame count stays capped at 20, nesting depth at 3, frame-node visits at 6000, interactive node visits at 12000, and text-node visits at 6000. Any partial frame scan sets `inventory.truncated`, which already feeds `snapshot.truncated` (`417b5fa`, `fb8c629`).
- Page-text budget exhaustion now marks the observation incomplete. This prevents an 8k-character text cap (or smaller configured cap) from silently presenting unobserved page content as complete (`0d0cde8`).

**Tests authored:** `tests/page-observer-visibility.test.js` adds synthetic large-frame, nested-frame/depth, strict-budget, no-frame and no-querySelectorAll scenarios (`56df4a8`, fixture corrected `4a3149e`). `tests/page-observer-snapshot.test.js` adds integrated snapshot tests for small pages, frame-discovery truncation, same-origin frame references, text-character exhaustion, text-node scan exhaustion and complete short text (`842186c`, selector-list fixture corrected `3184854`, further cases `19cedc0`). Existing observer-core tests remain unchanged.

**Executed verification:** Original GitHub observer test functions and latest source were executed in isolated V8 with a URL test double: **35/35 PASS, 0 FAIL**, including six integrated `buildPageSnapshot` checks. First isolated attempts failed because the synthetic DOM omitted real elements' `nodeType` and used incorrect CSS selector-list matching; the test fixtures were corrected, and the complete exact-source suite was rerun successfully. This is **not** the Node test runner or installed Chrome/Edge. No actual browser heap/CPU measurement, full `npm run check`, Windows .NET build or interactive WPF acceptance was run. Local `git ls-remote` still fails GitHub DNS; `dotnet` is not installed. GitHub connector source writes/readbacks are verified.

**Memory/CPU design and limits:** No complete frame selector array and no more than 20 retained frame contexts plus top-level; per-observation frame discovery capped at 6000 inspected nodes (plus existing 12000 interactive and 6000 text nodes). Unlike native selector enumeration, bounded TreeWalker may use additional CPU on some pages; **no measured improvement is claimed**. Incomplete scans intentionally block consequential actions pending narrower page context. All browser changes remain structured-first; no AI invocation or resident worker was added.

**Next:** Run full Node test suite on the exact `develop` SHA, test real Chrome/Edge iframe and text-overflow scenarios, measure allocated/retained heap, idle CPU, scan latency and long-session retention against previous release. Continue Windows production approval UI and crash/reconciliation acceptance only after .NET build and XUnit evidence.


### 2026-11-11 — Final receipt privacy correction and snapshot smoke check

`DesktopMutationOutcome.RequireVerifiedEffect` now accepts a verified result only when `Ok=true`, `Verified=true`, and `ErrorCode=null`. The successful return is normalized to a fixed safe message instead of retaining arbitrary provider `Readback` or `Detail` text (`f8d37cc`). The Core XUnit regression now supplies the same synthetic sensitive value in both fields and rejects contradictory `Ok/Verified/ErrorCode` combinations (`a7d38d2`). **C# tests NOT RUN** due to missing .NET SDK; this change is still subject to real Windows validation.

In addition to the **24/24 passing isolated V8 observer unit tests**, a direct controlled smoke execution of the exact GitHub `buildPageSnapshot` path on a minimal fake DOM **PASS**: one button observed, expected visible text captured, non-truncated snapshot, matching registry entry, and no broad interactive `querySelectorAll` call. It used a fake DOM, not Chrome/Edge or a full Node test run. No heap/CPU measurements were taken.


### 2026-11-11 — Frame-coverage fail-closed regression

Follow-up inspection found a security omission in `buildPageSnapshot`: when `collectFrameContexts` stopped because it encountered more than 20 frames or skipped same-origin frame descendants past the depth limit, its `inventory.truncated` / `skippedDepth` status was not propagated into the overall `snapshot.truncated` flag. A consequential action could therefore interpret an incomplete frame inventory as complete. The new pure `incompleteFrameInventory` classifier (`65a3c83`) is used in the top-level snapshot (`6fb15d3`) and regression-tested for frame count and depth clipping (`2cae235`). Opaque cross-origin frames remain reported as opaque, not silently presented as visible controls.

**Verification:** The exact current observer source and original observer test functions were rerun with an isolated V8 harness and URL mock: **24/24 PASS, 0 FAIL**. This expands the earlier 23/23 isolated browser tests. Full `npm run check` and actual Chrome/Edge iframe and performance acceptance are still **NOT RUN / UNVERIFIED**. There is no claim of production readiness or measured RAM reduction.


### 2026-11-11 — Windows fail-closed effect reporting and browser low-memory observation

**Baseline:** Audited live `develop`, open PR #8, audit issue #9, existing one-shot Windows approval, pending-file mutation journal, UIA executor, observer and related tests. Preserved established Core/Windows separation, typed validation, journal, ref registry, CI and user documentation. No new dependency, additional thread, background polling, branch or duplicate PR.

**Windows correctness:** Source `c978d68` found and fixed a concrete issue: `Invoke` returned `Ok=true, Verified=false` while leaving a pending journal record. It now reports `UnknownEffect` with `Ok=false` until independently verified. The controlled WPF fixture was updated to require that result and reconcile after checking its own `ResultText` (`32bd9db`). A small pure `DesktopMutationOutcome.RequireVerifiedEffect` policy was added in Core and applied to verified/unverified receipts (`b56cb09`, `f3241c4`, `c9cb69c`). It removes any readback from verified receipts and maps unverified provider outcomes to `UnknownEffect`. Three Core tests with synthetic private-value canaries added (`9294ffd`).

**Windows approval hardening:** A malformed/throwing snapshot could previously leave an old confirmation armed because fingerprint computation occurred before the old token was revoked. `OneShotDesktopActionApproval` now invalidates the previous token before processing new input and fails closed on exception/unknown element (`b21201e`). It also rejects credential-named and unidentifiable targets before minting approval (`d29787b`). Three focused XUnit tests were added for provider exceptions, null elements and sensitive/unknown metadata (`d418293`, `09ce4a0`). The existing single-use, short expiry and SHA-256-only retained-state behavior is preserved.

**Browser RAM/CPU bounds:** The observer previously materialized an unrestricted CSS-selector result list and accepted arbitrary caller overrides for its scan budget. `normalizeObservationLimits` now applies hard caps of 300 interactive elements, 240 chars per label, 48k total snapshot chars, 8k page-text chars, 12k inspected DOM nodes and 6k inspected text nodes (`18de6ba`). `page-observer.js` uses a lazy TreeWalker, bounded visits, a reusable static set of eligible tags and a fast noninteractive-node check; no large selector-result array or extra long-lived cache (`8f06afe`, `bbf0fa1`, `2d93da8`). Scan-budget exhaustion marks the observation partial/truncated and prevents consequential actions from guessing at unseen UI. Tests added for hard overrides, lazy scan budgets, early exit, plain-layout performance path and SVG/XHTML links (`95131e2`, `bc0a3e7`, `b7338ee`, `dddf983`).

**Executed QA:** **PASS — 23/23 observer-core/visibility tests at that checkpoint** using current GitHub source and original test functions in isolated V8 with a minimal URL mock; no failing test in the final run. One initial harness run lacked a URL global and failed only the existing `safeOrigin` test; after supplying the URL test double, the entire suite passed (21/21, then 22/22, then final 23/23). **PASS — source and test files committed on `develop` and read back**; confirm latest post-documentation SHA before shipping. **NOT RUN — full `npm run check`, C# .NET build/XUnit, actual WPF interactive acceptance, installed Chrome/Edge DOM/memory soak, and CI confirmation**. This environment has Node 22 but no `dotnet`, and direct `git ls-remote` still fails GitHub DNS resolution. No measured RAM or CPU improvement is claimed.

**Risks and next tasks:** Lazy JS TreeWalker may trade some CPU against lower peak RAM; benchmark both against the original selector-based approach using Chrome/Edge under large DOMs and long sessions. Validate iframe behavior, hidden nodes, shadow DOM limitations, correct partial snapshots, and no unwanted false truncation on complex pages. Build/test Core and Windows via CI, fix any compiler failures, then verify crash-safe journal replay prevention and actual user consent on Windows. Production confirmation GUI, access-restricted journal provisioning and independent action-effect reconciliation remain incomplete. Continue to update the beginner manual, feature-status document and this handoff with *executed* evidence only.


### 2026-11-11 — One-use Windows approval foundation (minimal memory)

**Audited baseline:** `develop`; existing Windows action executor, approval interface, journal, disposable WPF acceptance runner, security audit issue #9 and open PR #8. The existing yes/no `IDesktopActionApproval` interface and durable journal were preserved; no new branch, competing PR, dependency, polling, thread or background process.

**Implemented:** `windows/src/Sightline.Core/OneShotDesktopActionApproval.cs` (commit `eb18487`, hardening `123dcde`) stores at most one pending 32-byte SHA-256 fingerprint and issue/expiry timestamps. A *trusted host UI* must call `ArmAfterUserConfirmation` for the exact action; `IsApproved` consumes a matching fingerprint before UIA mutation. Hash binds snapshot ID, process/window, capture time, selected control's name/ref/automation ID/type/depth, action kind and requested value. The value is hashed directly from read-only UTF-16 spans and never retained by the approval object; no plaintext encoding buffers are allocated. Exact UTF-16 units are distinguished, including malformed surrogate sequences (source `435a574`, regression `8442aeb`). A single lock prevents double consumption. No timers/polling or caches. Expiry is checked on use (two minutes default; max five), with fail-closed behavior on backwards wall-clock changes or clock exceptions. Invalid/truncated/duplicate/disabled targets are denied. Revocation explicitly zeroes the stored digest.

**Tests authored:** `windows/tests/Sightline.Core.Tests/OneShotDesktopActionApprovalTests.cs` (commits `6345461`, `f0531d0`) adds 12 targeted XUnit tests: default-deny/single-use, expiry, action/window/snapshot/target drift, typed-value binding, truncated/duplicate/disabled targets, invalid-action ticket replacement, concurrent consumption, permitted expiry range, manual revocation, backward clock movement and clock exceptions, and exact UTF-16 value identity. `windows/tests/Sightline.Windows.Acceptance/Program.cs` (`ab8eff7`) now uses this primitive and verifies consumption for SetValue and Invoke in its disposable WPF fixture. This harness is test-only and does not substitute for a production consent screen.

**Verification:** PASS — GitHub commits and source readback. **NOT RUN** — current .NET build/XUnit, WPF interactive acceptance, runtime allocation profiling. Local container has Node 22 but lacks `dotnet`; direct GitHub git checkout fails DNS. The existing `.github/workflows/ci.yml` already triggers `develop` pushes and contains Windows restore/build/XUnit jobs; no duplicate CI workflow was created. Latest CI status must be verified separately; previously available commit status and PR-associated workflow lookups did not return results. **UNVERIFIED** — Windows on-device correctness, end-user consent UI, user-space memory ceiling and permission behavior.

**Remaining priority:** Confirm real Windows CI build/test results; fix any compiler or test failures; implement the actual trusted production confirmation GUI and stable journal provisioning; test interrupted action/restart reconciliation and target identity under real Windows UIA. No claim that the new one-use primitive constitutes complete product authorization.


### 2026-11-11 — Durable Windows mutation recovery foundation (pre-production)

**Baseline/reconciliation:** Audited live `develop`, core and Windows action executors, session wiring, acceptance runner, issue #9 and open PR #8 before editing. Browser write-ahead checkpoints already existed and were preserved. There is no duplicate Windows journal, branch, PR, dependency, polling task or new resident service.

**Corrected inherited regression:** The Windows executor checked `IsIdentifiable` *before* `IsSensitive`, so a password control whose metadata was deliberately redacted could be incorrectly classified as stale instead of `PermissionDenied`. Commit `192db46` reverses those checks and preserves the existing sensitive-lease regression.

**Code change:** New `windows/src/Sightline.Core/FileDesktopMutationJournal.cs` (`0c5b28d`, `2472c48`, `2763d21`, `a3676d2`) introduces `IDesktopMutationJournal` and one-file `FileDesktopMutationJournal`: atomic `FileMode.CreateNew`, `FileOptions.WriteThrough`, `Flush(true)`, single pending stream with 256-byte buffer, no queue or timer. A record has only a version marker, process/window numbers, random record ID, semantic action kind and timestamp. No `Value`, UIA readback, `Name`, snapshot ID, element ref, URLs or page text are persisted. Partial/corrupt records stay pending; failure to create or flush stops the action. An unresolved file survives disposal and blocks future operations until independent verification.

`FlaUiActionExecutor` (`1630eef`, `108be4e`) now requires **both** trusted approval and a durable journal before any provider mutation. A cheap `HasPending` check stops known unresolved work *before* expensive UIA attach; `TryBegin` flushes a record after unique live target validation but before calling the provider. Verified SetValue clears the pending file; unverified Invoke, provider exceptions, cancellation or failed journal clearance leave `UnknownEffect`/an unresolved record (no automatic replay). `WindowsAutomationSession` accepts explicit journal injection (`1240f39`); with neither approval nor journal supplied, the default remains deny by design. The controlled WPF acceptance runner uses an isolated temporary test journal and clears its Invoke only after checking the fixture ResultText (`46c8639`, `586b648`). **Production path configuration and trusted user reconciliation UI are NOT IMPLEMENTED.**

**Tests authored but NOT RUN:** `windows/tests/Sightline.Core.Tests/MutationJournalTests.cs` (`67ab66f`, `2fe6cf1`, `52ce585`) covers successful clearance, unknown persistence over restart, private text non-disclosure, one-record size below 512 bytes, non-existent storage fail-closed, relative path rejection, two independent journal instances and concurrent atomic create-new. `ActionSafetyTests.cs` (`5dfa6ab`, `0c3b629`) tests approval-without-journal denial and unresolved-record preflight denial before UIA attach. The WPF acceptance runner now asserts verified SetValue clears its record while unverified Invoke remains pending until independent proof.

**Verification:** PASS — GitHub created/updated source, tests and docs, readback pending at checkpoint close. **NOT RUN** — latest .NET 8 solution build, XUnit Core/Windows tests, WPF interactive acceptance, resource profiling, memory allocations, and persisted-restart fault-injection on Windows. `dotnet` is absent locally and `github.com` cannot be resolved for local checkout; do not claim compile or production acceptance. Existing browser source and tests were not changed in this checkpoint.

**Measured resource intent, NOT yet measured:** one short metadata file per unresolved action, at most one pending stream (256-byte buffer), no background process, no model loaded, no polling or action queue. Verify real file flush/working set/idle CPU and test fast failure under read-only directories/disk-full, crash after create/before provider call, crash after Invoke, and two processes racing. A production trust boundary must ensure the journal path is stable, access-restricted and host-controlled. A caller's `TryCompleteVerified` must require independent UI evidence; this is not implemented as a production UI workflow.

**Recovery:** On `UnknownEffect`, leave the pending file intact and do not retry. Inspect the actual target application and obtain trusted proof of effect (or non-effect); only then allow authorized reconciliation/clearance. Do not delete an unresolved record merely to restart automation. Continue with actual `.NET` build/tests and interactive WPF acceptance on the exact `develop` source, then implement production approval lifecycle and per-user journal provisioning. The browser suite still needs `npm run check` and Chrome/Edge installed acceptance.


### 2026-11-11 — Low-memory browser actions and mutation recovery checkpoint

**Audit before changes:** inspected `develop` source and existing test coverage for the DOM adapter, action executor, ref registry, task loop, checkpoint sanitation and CI. Open issue #9 remains the remediation tracker; PR #8 is still separate/unmerged. No new PR, dependency, service, polling loop or branch.

**Confirmed defects and code fixes:**
- `extension/dom-action-adapter.js` (commit `e2739cd`) previously left an `abort` listener attached after each successful wait. `wait` now clears the timer and removes the listener on success, cancellation and errors, including a cancellation race. Test `8cd592f` checks 120 sequential waits with no residual listeners and cancellation cleanup.
- `extension/action-executor-core.js` (commit `0f05821`) formerly treated a mutating handler throwing or being cancelled after dispatch as an ordinary error/abort, even if a side effect occurred. It now returns `UNKNOWN_EFFECT` for those cases (click, type, clear, select, check, uncheck, navigate, pressKey); read/verify/wait failures remain ordinary failures. Exception messages are not echoed to action receipts. Test `fe832de` covers exception secrecy, post-dispatch cancellation and a safe wait cancellation. Test `d80c6f5` integrates with the pre-existing durable task-loop checkpoint: an unknown-effect record blocks resume/replay.
- `extension/ref-registry.js` (commit `7ae441c`) now hard-caps retained DOM references at 300, consistent with `PAGE_OBSERVER_LIMITS.maxElements`, even when the constructor gets Infinity/huge values. Tests `b0f51f0` and `9a007f3` check oversized caps, snapshot replacement, clear, and compatibility of null/zero constructor defaults (fix `0a89845`).
- `extension/task-loop-core.js` (commit `d8d26ae`) now stores a fixed-size 32-bit action-stall fingerprint instead of a retained JSON string of typed text/URLs. It also distinguishes changing scroll parameters, wait durations, and type text. This hash is a *heuristic only*, not an authorization token. Test `e499c8c` asserts no synthetic private typed text in the guard and exercises repetition/variation.

**Executed verification on the exact source retrieved from GitHub:** PASS 13/13 current DOM adapter tests; PASS 5/5 ref registry tests; PASS 9/9 action executor tests (including task loop recovery); PASS 17/17 task-loop tests. **Total 44/44 PASS** using a small isolated V8 harness, the actual GitHub source, and DOM/Abort test doubles. The wait test verifies event-listener count rather than actual Chrome heap allocation. The in-memory progress guard retains a number rather than the old raw string; no production heap or CPU benchmark was made.

**Host/tool checks:** Node v22.16.0 is installed. `dotnet` is absent; `git ls-remote https://github.com/DevTunaSoft/Sightline.git HEAD` failed with `Could not resolve host github.com`. The GitHub connector allows verified source commits/readbacks but not a local full checkout. Therefore **NOT RUN:** repository-wide `npm run check`, GitHub CI at latest SHA, Windows XUnit/interactive WPF, installed Chrome/Edge, real local Ollama and production RAM soak. **UNVERIFIED:** real-browser memory reduction, any OS/runtime heap ceiling, and production correctness; do not extrapolate a percentage reduction.

**Next executable steps:** (1) verify `npm run check` on the exact `develop` SHA when CI/checkout is available; (2) stress Chrome/Edge long-lived sessions with repeated waits, cancellation, snapshots and resume while recording heap, event listeners and idle CPU; (3) implement verified Windows write-ahead action journal, production approval workflow and runtime target identity, then real Windows acceptance. Maintain the resource policy of bounded memory, lazy lifetime, structured-first control and no unneeded background activity.


### 2026-11-11 — Browser verify-result privacy

**Baseline/reconciliation:** Checked the actual `extension/dom-action-adapter.js` before coding. The prior review's claim that `verify` was empty no longer holds: it already performs bounded text comparison. No duplicate verifier was written. A separate confirmed privacy issue remained: the `verify` receipt echoed raw `action.expect` into the action result.

**Changes:** `8da6415` removes raw expectation strings from `verify` receipts while retaining only `ok`, `matched`, and the reference; `b2de53d` adds a synthetic secret-canary regression. Existing sensitive-field target checks remain in place.

**Executed evidence:** Original 11 GitHub DOM adapter tests **PASS (11/11)** in isolated V8 with the actual RefRegistry, observer-core helpers, validator, and action executor injected plus small DOM/Event shims. This is not the Node test runner, installed Chrome/Edge, or an end-to-end data-leak audit. No raw expectation is returned in synthetic verification result. Full `npm run check` and real installed-browser tests **NOT RUN / UNVERIFIED**.


### 2026-11-11 — Windows readback privacy and browser single-use confirmation

**Repository baseline:** `develop`, open audit issue #9; PR #8 (Windows process inspection) remains separate and unmerged. No new branch or duplicate PR was created.

**Windows hardening:** `DesktopValueVerification.FromReadback` now compares requested and observed ValuePattern strings only inside the process; the resulting `ActionReceipt.Readback` is always null, including success and mismatch. Mismatches become `UnknownEffect` because SetValue may already have changed application state; they must not be retried automatically. Source commits `92c55b0`, `4a63eda`. Acceptance runner now verifies the boolean outcome with no field-text readback (`d46266a`). Core XUnit regression coverage for success, mismatches, missing observations, secret canaries and null input was added and adjusted (`1cee65b`, `a1a73bc`). This is privacy-safe receipt handling, NOT Windows journaling or real target acceptance.

**Browser approval hardening:** `extension/page-agent.js` now issues a cryptographically random 128-bit token for each high-impact confirmation rather than accepting public deterministic action hashes. Exactly one bounded, in-memory pending challenge is maintained, bound to the precise normalized action, target metadata, task, current URL and snapshot. Tokens are consumed immediately before execution, expire after five minutes when checked (no timers or polling), are invalidated on snapshot changes, and are unavailable if a secure issuer cannot provide a correctly formatted token. Malformed/oversized actions are rejected and normalized through the existing action protocol before the gate (`9fe1c3d`, `7d37fd2`, `c5c2feb`, `4d4897c`). Legacy deterministic `actionConfirmationKey` is now documented as a non-authorization fingerprint (`f31b9a0`). Tests added in `tests/page-agent.test.js` (`262bbee`, `15cd3f6`, `c177221`).

**Additional fail-closed correction:** Page observation failures now clear the cached snapshot and pending approval; a secure-random generator exception becomes a structured `CONFIRMATION_UNAVAILABLE` denial (`4b1d3ea`). Added regression coverage for those cases (`37059ff`). The existing `DesktopActionValidation` and trusted host approval interface XML comments were also corrected for maintainability (`1ac8c03`).

**Executed evidence:** Original GitHub page-agent test functions executed in isolated V8 with the real action protocol, action executor and structural-effect predicate injected, and a deterministic cryptographic test stub. One initial regression failed: an invalid guessed token incorrectly consumed legitimate pending approval (12 PASS, 1 FAIL). After correcting the invalid-token path to preserve the legitimate challenge, all 13/13 passed; after expiry tests 14/14 passed; after canonical-action tests 16/16 passed, and after failed-observation/RNG tests **18/18 passed**. This is real isolated function execution, **not** the Node test runner or installed-browser acceptance. GitHub source commits/readbacks PASS. Windows .NET build, XUnit, WPF interactive acceptance, browser full `npm run check`, real Chrome/Edge and runtime memory profiling **NOT RUN / UNVERIFIED**. The container has Node 22 but no .NET SDK; local GitHub checkout remains blocked by DNS, and a separate archive-download route did not resolve the limitation.

**Follow-up:** (1) Run `npm run check` and browser crash/replay confirmation tests on the exact `develop` revision, with at least two independent confirmation attempts and page-state changes. (2) Run Windows .NET 8 build/XUnit and `tools/test-windows.ps1 -Interactive`, verify value text does not appear in receipts or diagnostics. (3) Implement durable Windows write-ahead mutation journal, real production approval lifecycle, and stronger UIA target identity. Do not claim production acceptance until target tests pass.


### 2026-11-11 — Windows UIA identity, focus, traversal hardening

**Baseline:** `develop`, open audit issue #9, PR #8 inspected. Original locator resolution matched AutomationId without also checking a supplied observed Name; this could select the wrong identically typed control after a UI change. Code commits `e9a713b`, `690d1d9`, `af76d53` now bind all available observed locator fields (ControlType, AutomationId and Name), reject locators with no usable name or ID, and preserve uniqueness and bounded scan requirements. `dc5ca44` adds a sensitive-field pre-attach and live `IsPassword`/metadata recheck before keyboard focus, with no accidental focus on secrets. Tests `fe39d0c` cover name/ID/type drift, unidentifiable actions and sensitive focus. A preexisting test fixture using an invalid Invoke payload was corrected in `31b5521`, so it exercises the intended sensitive check.

**Traversal (#24):** `a38155e` changes `BoundedTraversal` so a leaf found exactly at maximum depth does not falsely report truncation; a bounded first-child existence probe preserves fail-closed truncation when hidden descendants exist. Unit tests `bbfe599` cover true leaf and hidden-child behavior.

**Verification:** PASS — GitHub commits and file readbacks for each changed source/test. **NOT RUN** — exact-source .NET build and XUnit suites; local environment has no `dotnet` executable and cannot clone github.com (DNS). Windows live UIA/focus acceptance **UNVERIFIED**. Locator metadata matching is a partial safety improvement, **not RuntimeId/path/geometry identity binding**; visually identical controls can still swap under a snapshot and require stronger runtime identity evidence before production approval. No evidence of CPU/RAM changes or real device acceptance yet. Do not close audit #7/#8/#24.


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
