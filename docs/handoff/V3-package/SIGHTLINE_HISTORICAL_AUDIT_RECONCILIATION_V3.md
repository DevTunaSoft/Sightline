# Sightline — 35 Historical Audit Findings (Companion)

This is an extract of the V3 master handoff. All findings are historical and must be rechecked against current code; later source mitigations do not equal production acceptance.

# PART VI — HISTORICAL SECURITY / CORRECTNESS AUDIT: 35 FINDINGS AND RECONCILIATION

## VI.1 Why the historical audit belongs in the handoff

The local handoff materials include a **35-item historical Sightline audit** (“Complete issue list with recommended fixes”). It describes a previous code snapshot, not necessarily the current `develop` tree. Several findings have since driven concrete changes: credential redaction, action-time sensitivity, write-ahead checkpoints, UnknownEffect semantics, bounded DOM/label scans, stronger Yahoo guards, planner context limits, typed Windows action validation and approval primitives. Others remain incomplete or unverified. **A new engineer must not reimplement all 35 blindly.** The right workflow is to match each finding to the latest code and tests, confirm whether it still reproduces, then either close it with evidence or implement the smallest missing fix.

The historical audit itself warned that its author had not run the full repository test suite or compiled C# at that time. This edition preserves the findings as **risk prompts**, not as verified present-tense vulnerabilities. The current `docs/FEATURE_STATUS.md`, `docs/HANDOFF.md` and issue #9 may contain later evidence; source and actual execution take precedence.

### How to reconcile one historical finding

1. Identify the old affected module and the exact failure mode.
2. Search current `develop` for the function, new shared helper, or replacement implementation.
3. Inspect the complete current action path, not just the existence of a test name.
4. Run the old reproduction case against the exact current SHA.
5. If it fails, implement a focused fix and add a regression that would have failed before it.
6. Rerun the entire relevant suite, then real-browser/Windows acceptance when applicable.
7. Update issue #9, `docs/HANDOFF.md`, feature status and user manual; record evidence and any remaining risk.
8. Do not mark a security finding “resolved” solely because a source file contains a check or a synthetic V8 shim passed.

## VI.2 The 35 historical findings: status and exact next proof

**Status labels here are conservative:** “MITIGATED IN SOURCE; ACCEPTANCE OPEN” means later code/docs describe a fix, but the release-level real-machine gate has not passed. “RE-AUDIT” means this handoff does not have enough current evidence to certify the fix. “OPEN” means a known production capability is still absent. These labels are not a substitute for inspecting the latest code.

### HIST-01 — `verify` leaks sensitive field values

**Historical finding (H):** `verify` leaks sensitive field values.

**Historical proposed direction:** Block `verify`, `select`, `check`, `uncheck`, and `pressKey` on sensitive targets in the gate, the planner, and the adapter. Add a test for each.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Shared sensitive detector and adapter guards now exist; real-browser canary still required.

**Next proof required:** Verify `verify` never leaks sensitive field data or binary match oracles; test all action types. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-02 — `pressKey` is never gated

**Historical finding (H):** `pressKey` is never gated.

**Historical proposed direction:** Classify `pressKey` by the focused element and key. Treat `Delete` and `Backspace` as high-risk, and `Enter` as high-risk when it lands in a compose or confirm context. Remove `Delete` from `SAFE_KEYS` until it has a gate.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Current adapter rechecks sensitive focused fields; risk policy still needs real-site proof.

**Next proof required:** Test Enter/Delete/Backspace on focused controls and mail compose/confirm contexts. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-03 — Yahoo result count is misread

**Historical finding (H):** Yahoo result count is misread.

**Historical proposed direction:** Match “of N” first and take the last number in a range. Return `null` when the page is ambiguous, and show “about N” or “unknown” in the card rather than a wrong count.

**Reconciled status:** **RE-AUDIT**. Historical parser defect; current Yahoo scope logic must be inspected.

**Next proof required:** Test “Showing 1-50 of 300”, localized counts and ambiguous Yahoo result labels. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-04 — The destructive-scope check is weak

**Historical finding (H):** The destructive-scope check is weak.

**Historical proposed direction:** Require a search state visible in the page structure, not loose text. Check for select-all or an active selection covering more than the visible results, and deny by default in that case. Ask for explicit confirmation of the count.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Current user manual explicitly says bulk Select all Trash is blocked.

**Next proof required:** Prove exact selected scope; block Select all until stable message IDs exist. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-05 — Windows has no password handling, and `SetValue` echoes values

**Historical finding (H):** Windows has no password handling, and `SetValue` echoes values.

**Historical proposed direction:** Check UIA’s `IsPassword` and the same sensitive-name rules as the browser side. Refuse `SetValue` on sensitive controls, omit `Readback` for them, and redact their names in snapshots.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Windows receipt policy and sensitivity tests authored; latest .NET not run.

**Next proof required:** Windows IsPassword/credential fields, SetValue redaction and no secret receipt. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-06 — The Windows side has no confirmation gate

**Historical finding (H):** The Windows side has no confirmation gate.

**Historical proposed direction:** Port the browser gate (risk levels, confirmation keys bound to target and action) into Core. Until then, document that the Windows foundation must not be used autonomously.

**Reconciled status:** **PARTIAL / PRODUCTION UI OPEN**. Core one-use primitive exists; production confirmation UI does not.

**Next proof required:** Trusted user-facing WPF consent for exact action; no approval-provider bypass. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-07 — Windows element identity is weak

**Historical finding (H):** Windows element identity is weak.

**Historical proposed direction:** Record UIA `RuntimeId` plus parent path and bounding rectangle when observing. Re-check them before acting, and fail closed on mismatch.

**Reconciled status:** **PARTIAL / REAL UIA OPEN**. Stricter type/ID/name matching exists; runtime/geometry path remains incomplete.

**Next proof required:** Runtime/ancestry/window-generation identity and wrong-target race. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-08 — Unnamed Windows controls can never resolve

**Historical finding (H):** Unnamed Windows controls can never resolve.

**Historical proposed direction:** Fall back to `RuntimeId` plus the control’s path and sibling index when name and automation ID are both empty.

**Reconciled status:** **OPEN / DESIGN DECISION**. Current fail-closed empty-identity behavior is safe but limits functionality.

**Next proof required:** Unnamed control fallback without unsafe retargeting. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-09 — `SetValue` can report failure after it succeeded

**Historical finding (H):** `SetValue` can report failure after it succeeded.

**Historical proposed direction:** Track whether the side effect happened. Report `UNKNOWN_EFFECT` in that case, and require reconciliation before any retry.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Core receipt and Windows executor changed; latest .NET unexecuted.

**Next proof required:** Throw after provider mutation; require UnknownEffect and pending journal. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-10 — Diagnostic redaction misses quoted JSON

**Historical finding (H):** Diagnostic redaction misses quoted JSON.

**Historical proposed direction:** Allow optional quotes around keys and values, for example `(["']?)(password|…)1s*[:=]s*(["']?)[^s,"'}]+`. Add test cases for JSON, single-quoted, and spaced forms. Rate this Medium if logs stay local.

**Reconciled status:** **RE-AUDIT**. Do not infer sanitizer correctness from generic redaction claims.

**Next proof required:** Quoted JSON and key=value sanitizer canaries in browser and Windows logs. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-11 — Confirmation context can carry into the wrong action

**Historical finding (H):** Confirmation context can carry into the wrong action.

**Historical proposed direction:** Clear it in a `finally` after every execute, and key it to the confirmation key.

**Reconciled status:** **RE-AUDIT**. Review browser-task-runner finally/clearing and key binding.

**Next proof required:** Failed confirmation cannot leak context into next read/verification. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-12 — Sensitive-name matching has false positives

**Historical finding (H):** Sensitive-name matching has false positives.

**Historical proposed direction:** Use word boundaries and separator-aware matching, and add a test list of common false positives.

**Reconciled status:** **RE-AUDIT**. New detector improved metadata; false-positive suite still needed.

**Next proof required:** Shipping, mapping, compass, passenger vs real password/pin identifiers. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-13 — Verification is effectively empty

**Historical finding (H):** Verification is effectively empty.

**Historical proposed direction:** Give each consequential action an expected effect, such as text appearing or a control disappearing. Mark the task unverified or fatal when the effect is missing.

**Reconciled status:** **PARTIAL / ORACLE OPEN**. Structural checks exist; site-specific durable effect verification incomplete.

**Next proof required:** No `receipt.ok`-only success for consequential action; independent app state. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-14 — The “changed” check is driven by any text change

**Historical finding (H):** The “changed” check is driven by any text change.

**Historical proposed direction:** Compare structural state, such as the target’s presence, URL, and control states, and exclude volatile text.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Structural-effect helper documented; real dynamic-page tests needed.

**Next proof required:** Clock/ad/text changes must not verify a no-op click. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-15 — Progress is lost on error, and in-flight actions are unrecorded

**Historical finding (H):** Progress is lost on error, and in-flight actions are unrecorded.

**Historical proposed direction:** Write the action to the timeline with status `unknown` before executing, persist it, and return the timeline on the error path.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Write-ahead browser checkpoint in source; installed-browser crash tests missing.

**Next proof required:** In-flight checkpoint precedes execution; errors preserve timeline/unknown effect. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-16 — Resume can repeat an action that already happened

**Historical finding (H):** Resume can repeat an action that already happened.

**Historical proposed direction:** Use the write-ahead record from item 15. On resume, treat any `unknown` action as needing reconciliation, using `verify` against page state before any re-execution.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Unknown-effect replay blocking in source; fault injection required.

**Next proof required:** Restart after uncertain dispatch never automatically repeats mutation. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-17 — Confirmation UI has a race

**Historical finding (H):** Confirmation UI has a race.

**Historical proposed direction:** Await the checkpoint save, or put checkpoint writes on the same serialized queue, before showing the card.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Serialized confirmation checkpoint documented; real browser race test needed.

**Next proof required:** Checkpoint must persist before confirmation card appears. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-18 — The planner prompt likely overflows its context window

**Historical finding (H):** The planner prompt likely overflows its context window.

**Historical proposed direction:** Budget the snapshot in tokens against `num_ctx` minus the system prompt and a reserve. Repeat the key guardrails at the end of the prompt, and check Ollama’s truncation behavior before relying on either.

**Reconciled status:** **MITIGATED IN SOURCE; REAL MODEL OPEN**. Planner heuristic budgets implemented; tokenizer/runtime behavior unverified.

**Next proof required:** Real Ollama prompt fits context; guardrails cannot be truncated. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-19 — Confirmation keys break on dynamic pages

**Historical finding (H):** Confirmation keys break on dynamic pages.

**Historical proposed direction:** Bind the key to target identity, URL, and action, not the full snapshot hash.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Approval primitive updated; dynamic-page installed-browser test needed.

**Next proof required:** One-use approval survives harmless volatile text but rejects target/context change. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-20 — `select` doesn’t check that the target is a select

**Historical finding (H):** `select` doesn’t check that the target is a select.

**Historical proposed direction:** Require `tagName === 'SELECT'` and return `NOT_SELECTABLE` otherwise.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Adapter option guard and bounded scan documented; live browser proof missing.

**Next proof required:** Select only on SELECT, with <=2048 options and no side effect on overflow. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-21 — Challenge and MFA blockers match email bodies

**Historical finding (H):** Challenge and MFA blockers match email bodies.

**Historical proposed direction:** Detect challenges from the page’s structure, title, and URL, not from body text. Restrict text matching to known UI containers.

**Reconciled status:** **MITIGATED IN SOURCE; ACCEPTANCE OPEN**. Yahoo challenge detection moved toward UI structure; live markup unverified.

**Next proof required:** Quoted MFA text in email body does not trigger challenge state. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-22 — Email content is the injection surface

**Historical finding (H):** Email content is the injection surface.

**Historical proposed direction:** Wrap page text in explicit untrusted delimiters in the planner payload. In mail contexts, require confirmation for typing into compose fields and for any key press. Add an injection test set to the suite.

**Reconciled status:** **MITIGATED IN SOURCE; ADVERSARIAL OPEN**. Typed actions and untrusted delimiters exist; real model injection test required.

**Next proof required:** Injected mail body cannot escalate to arbitrary code or unapproved mutation. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-23 — The high-impact keyword list has gaps

**Historical finding (H):** The high-impact keyword list has gaps.

**Historical proposed direction:** Add these terms. For autonomous mode, consider denying unrecognized destructive-looking labels by default.

**Reconciled status:** **RE-AUDIT**. Keyword list alone is not a complete semantic risk classifier.

**Next proof required:** Audit every high-impact verb, including revoke/reset/deactivate/clear all. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-24 — The depth limit flags leaves as truncated

**Historical finding (H):** The depth limit flags leaves as truncated.

**Historical proposed direction:** Set truncation only when the node at the limit has children, which requires querying for them. Alternatively, scope truncation to the affected subtree.

**Reconciled status:** **MITIGATED IN SOURCE; WINDOWS TEST OPEN**. Depth-boundary fix/test authored; latest XUnit not run.

**Next proof required:** Leaf at exact UIA depth cap not falsely marked truncated. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-25 — The diagnostics sink stops permanently after one error

**Historical finding (H):** The diagnostics sink stops permanently after one error.

**Historical proposed direction:** Catch and retry per write with backoff, reopen the file on failure, and open with `FileShare.ReadWrite | FileShare.Delete`.

**Reconciled status:** **RE-AUDIT**. Bounded sink exists; recovery/Windows file sharing fault injection required.

**Next proof required:** Disk/rotation failure does not permanently disable all diagnostic evidence. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-26 — Each action creates a new UI Automation instance

**Historical finding (H):** Each action creates a new UI Automation instance.

**Historical proposed direction:** Create one automation instance per session with a managed lifetime, and cache the process attachment. Measure per-call latency before and after.

**Reconciled status:** **RE-AUDIT / MEASURE**. Do not cache a provider without measured benefit and lifecycle safety.

**Next proof required:** Measure repeated UIA automation instance creation and disposal. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-27 — The Windows action model isn’t validated

**Historical finding (H):** The Windows action model isn’t validated.

**Historical proposed direction:** Validate `Ref` format and value length in the record or at the executor boundary.

**Reconciled status:** **MITIGATED IN SOURCE; WINDOWS TEST OPEN**. Typed Windows validation and tests added; latest .NET not run.

**Next proof required:** Reject invalid/oversized ref and value before provider access. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-28 — Yahoo sample comparison treats pagination as success

**Historical finding (H):** Yahoo sample comparison treats pagination as success.

**Historical proposed direction:** Compare stable message identifiers under an unchanged page or query, and never count a page change as verification.

**Reconciled status:** **MITIGATED IN SOURCE; YAHOO ORACLE OPEN**. Bulk Trash intentionally fails closed without stable identities.

**Next proof required:** Pagination/filter change must never prove Trash effect. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-29 — CI never runs the JavaScript tests

**Historical finding (H):** CI never runs the JavaScript tests.

**Historical proposed direction:** Add an `npm test` step.

**Reconciled status:** **HISTORICAL CLAIM OBSOLETE; VERIFY CI**. Current package.json includes Node syntax, release audit and npm test.

**Next proof required:** Confirm `npm run check` invokes `npm test` on exact SHA in workflow. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-30 — The Windows UIA path has no live tests in CI

**Historical finding (H):** The Windows UIA path has no live tests in CI.

**Historical proposed direction:** Run the interactive runner on a Windows desktop runner, or mark the gate as blocked until it runs.

**Reconciled status:** **OPEN / INTERACTIVE ACCEPTANCE**. Hosted compile is not interactive acceptance.

**Next proof required:** Run actual UIA desktop test outside headless CI. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-31 — `ElementLeaseRegistry.Register` throws at capacity

**Historical finding (H):** `ElementLeaseRegistry.Register` throws at capacity.

**Historical proposed direction:** Return a result type that the observer can convert into a truncated snapshot.

**Reconciled status:** **RE-AUDIT**. Inspect current ElementLeases and observer error handling.

**Next proof required:** Lease registry capacity returns bounded failure/truncation, not unhandled exception. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-32 — `classifyFailure` misses some messages

**Historical finding (H):** `classifyFailure` misses some messages.

**Historical proposed direction:** Add an explicit code for origin changes, and map by error code rather than message text where possible.

**Reconciled status:** **RE-AUDIT**. Prefer typed error code to parsing exception message.

**Next proof required:** Origin-change failures have stable error codes and accurate diagnostics. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-33 — Planner retries don’t show the model its bad output

**Historical finding (H):** Planner retries don’t show the model its bad output.

**Historical proposed direction:** Append the invalid assistant output before the corrective message.

**Reconciled status:** **MITIGATED IN SOURCE; MODEL ACCEPTANCE OPEN**. One bounded invalid-output retry documented; real model needed.

**Next proof required:** Bound rejected model response and repair retry; preserve trusted guardrails. **Priority:** P1. Do not close or reimplement until current code and tests have been checked.

### HIST-34 — Branches have drifted

**Historical finding (H):** Branches have drifted.

**Historical proposed direction:** Rebase PR #6 onto `develop` or the reverse, then reconcile the handoff so it matches the code on each branch.

**Reconciled status:** **CONFIRMED CURRENT BRANCH DIVERGENCE**. GitHub compare reports develop +532/-17 vs main; counts are snapshot.

**Next proof required:** Audit `main`, `develop`, open PR #8 before integration. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.

### HIST-35 — The default branch has no code

**Historical finding (H):** The default branch has no code.

**Historical proposed direction:** Make `develop` the default branch or merge the code into `main`.

**Reconciled status:** **CONFIRMED DEFAULT-BRANCH RISK**. Default branch is main, active alpha source on develop; do not blindly switch.

**Next proof required:** Document correct clone/checkout and safe integration strategy. **Priority:** P0. Do not close or reimplement until current code and tests have been checked.


## VI.3 Audit cross-cutting themes and why they drove recent changes

The 35 findings cluster into six causal themes. **Privacy and secret exposure** drove sensitive-field redaction, action-time linked-label checks and secret-free receipts. **False action success** drove structural-effect checks, unknown-effect status and application-side verification requirements. **Crash/replay** drove browser write-ahead checkpoints and the Windows single-action journal. **Resource safety** drove lazy bounded DOM/frame scans, capped labels/options/text and short-lived refs. **Provider and UX trust** drove stronger Windows identity, focus checks, circuit breaker and one-use approval primitives. **Engineering process** drove branch audits, explicit evidence labels, CI check requirements and the authoritative handoff.

Do not reduce this history to “we fixed 35 bugs.” Many were partial or hypothetical at the time, some are still blocked, and some are not reproducible against current source. The important lesson is to preserve the failure-mode tests and the safety invariants even when refactoring for speed or memory.

## VI.4 Five new audit questions raised by the latest state

1. **Cross-label consistency:** Does `hasSensitiveAssociatedLabel` cover real browser shadow DOM, `label[for]` across roots, custom role textboxes and dynamically reassigned labels without exceeding budgets? The isolated tests do not establish complete coverage.
2. **Source-documentation drift:** Does the latest `docs/FEATURE_STATUS.md` still contradict `windows/README.md` about the one-use Windows approval primitive? Correct the stale row after source inspection and .NET verification.
3. **Branch integration risk:** Why is `develop` 532 ahead and 17 behind `main`, and which 17 main-side commits must be preserved? Do not force merge or duplicate PR #8.
4. **Resource claims:** Can the latest browser changes be measured as lower peak allocation and stable retained heap on real Chrome/Edge? Source-level caps are not enough.
5. **Effect oracle quality:** Which browser and Windows actions can provide independent application-side proof today, and which must return UnknownEffect? Make the capability table explicit so the UI never overpromises.


---
