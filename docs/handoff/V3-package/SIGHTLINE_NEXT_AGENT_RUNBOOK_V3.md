# Sightline — Next Coding Agent Runbook (Companion)

This is an extract of the V3 master handoff. Start here for prioritized 20-work-package execution, branch/PR safeguards, design decisions, and continuation prompt. Read the master for the full context.

# PART VII — DECISION RECORDS, EXECUTION PLAN AND TAKEOVER RUNBOOK

## VII.1 Causal chain: user requests → engineering changes → tests → next evidence

This is the central answer to the request for a conversation-aware handoff. It is not enough to say “the observer is bounded.” The next engineer must understand **why it became bounded**, **which request made the change necessary**, **which failure it addressed**, **what proof exists**, and **what is still missing**.

### Chain A: “everything has to be light on memory” → lazy bounded DOM/frame scanning

**Origin:** Repeated user direction on November 8–11 that the code, app, testing and logging must use minimal memory. **Observed engineering problem:** a seemingly small semantic snapshot could still allocate enormous intermediate DOM lists, label arrays or normalized strings. For example, `querySelectorAll('iframe,frame')` collects all matches before a later frame-count cap; `aria-labelledby` splitting and label spreading can create large arrays before the output is truncated; whole-string regex normalization can allocate large copies. **Design response:** shared lazy TreeWalker, hard node/frame/text budgets, bounded incremental label extraction and normalization, and explicit incomplete-observation reporting. **Relevant recent commits recorded in the ledger:** frame discovery `417b5fa`, text overflow `0d0cde8`, accessible names `2085915`, descriptor copy reduction `eb69ec9`, label helper metadata reuse `fce4561`. **Evidence:** isolated observer tests through 86/86 combined observer/adapter checkpoint. **Still needed:** real Chrome/Edge heap/CPU measurements, large DOM and dynamic-frame acceptance. **Why not just raise caps?** That would violate the standing resource requirement and still not prove complete coverage.

### Chain B: “make testing robust and autonomous” → deterministic fixtures and failure injection

**Origin:** User asked for automated, comprehensive testing and robust logging rather than relying on manual troubleshooting. **Observed problem:** source-level tests cannot prove actual installed-browser messaging, UIA focus behavior, or long-run memory stability. **Design response:** Node test suite, release audit, browser localhost fixture, local Ollama acceptance command, Windows PowerShell build/interactive test script, structured diagnostic evidence and a roadmap for fault injection. **Evidence:** current scripts and docs exist; recent isolated V8 test checkpoint passed 86/86. **Still needed:** run the full native suite on exact SHA, installed Chrome/Edge self-test, real Windows interactive test and long-session profiling. **Why not claim the test harness is sufficient?** The fake DOM and isolated V8 cannot reproduce every browser realm, extension permission or Windows UIA provider behavior.

### Chain C: “logging must be robust but light” → bounded structured diagnostics

**Origin:** User requested retained information to verify what was implemented and to diagnose later failures, while maintaining strict memory limits. **Observed problem:** an unbounded event stream or screenshot history could consume RAM, disk and sensitive content. **Design response:** fixed-capacity event tail, sanitized structured fields, rotating/redacted Windows JSONL sink, correlation IDs, checkpoint/effect receipts, explicit export and retention limits. **Evidence:** repository diagnostics modules and hosted Windows synthetic tests are documented. **Still needed:** disk-full, rotation, JSON redaction, queue overflow and real long-run soak. **Why not log all raw prompts and pages?** It would violate privacy and memory constraints and make evidence harder to interpret.

### Chain D: “see, understand, act” → typed semantic execution instead of screenshot chat

**Origin:** Founding visual AI request and selected tagline. **Observed product gap:** describing a screen is not completing a task. **Design response:** DOM/UIA semantic observation, optional local planner, typed action protocol, trusted adapter, effect verifier, task checkpoint and recovery. **Evidence:** browser alpha and Windows foundation modules exist. **Still needed:** unified Windows host, cross-surface IPC, trusted Windows consent, robust app-side oracles and real task acceptance. **Why not make AI click coordinates directly?** Coordinate guesses are fragile, hard to verify and potentially unsafe.

### Chain E: “I want a small local streamed model” → optional inference tier

**Origin:** Explicit user request for built-in tiny memory-efficient local AI. **Observed constraint:** an always-on model can dominate RAM and CPU, even when the user is idle. **Design response:** deterministic no-model route, browser local Ollama as current integration, planned optional quantized GGUF with lazy load, token streaming, bounded context, cancellation and unload. **Evidence:** Ollama integration and context budgets documented; GGUF not implemented. **Still needed:** choose a tested model/runtime and benchmark actual memory/latency/accuracy. **Why not bundle a large model now?** It would break the resource contract before the deterministic Windows foundation is accepted.

### Chain F: “the app should actually delete/search mail” → safety and effect verification

**Origin:** Concrete Yahoo Mail workflow request. **Observed problem:** bulk selection, pagination, stale results and server-side asynchronous effects can make a click appear successful when the intended messages were not moved. **Design response:** origin/tab pinning, explicit confirmation, selected-all guard, challenge handling, `NO_VERIFIED_EFFECT`, `UNKNOWN_EFFECT` and no blind replay. **Evidence:** Yahoo skill and browser checkpoint code; real account acceptance missing. **Still needed:** stable message identifiers and independent Trash verification on disposable data. **Why stop rather than retry?** Repeating a destructive action after an uncertain result can compound damage.

### Chain G: “Windows, clean code, low memory” → .NET Core/Windows separation

**Origin:** User required native Windows capability and low memory. **Observed tradeoff:** an Electron shell or always-on browser engine would add significant baseline cost and couple Windows automation to UI rendering. **Design response:** .NET 8/WPF host, dependency-free Core contracts, FlaUI/UIA3 adapter, Win32 process/window discovery, bounded leases and circuit breaker. **Evidence:** Windows foundation and synthetic allocation measurements; interactive acceptance incomplete. **Still needed:** production consent/recovery UI, stable journal path, real UIA tests and packaging. **Why keep browser extension separate?** It uses the user's existing Chrome/Edge session and avoids embedding another browser runtime in the Windows app.

### Chain H: “keep the manual and verification log current” → documentation as an acceptance gate

**Origin:** User explicitly requested an instructional manual and retained evidence for future verification. **Observed problem:** documentation often drifts after code changes, and optimistic status claims can outlive the exact test environment. **Design response:** `docs/USER_MANUAL.md`, `docs/HANDOFF.md`, `docs/FEATURE_STATUS.md`, `docs/ROADMAP.md`, issue #9 and this takeover dossier. **Evidence:** files exist and were inspected on `develop`. **Still needed:** reconcile stale Windows approval status row, verify all instructions against actual UI, and record latest SHA/CI evidence. **Why not rely on chat history alone?** Conversations are difficult to audit and cannot replace source-linked test records.

### Chain I: “keep coding; avoid loops” → prioritized work and GitHub reconciliation

**Origin:** Repeated authorization to proceed autonomously, with anti-loop and duplication safeguards. **Observed problem:** repeated research or unverified retries can consume time without producing working software, while parallel branches can drift. **Design response:** one authoritative ledger, small focused commits, two-failure pivot, source/PR audit, explicit PASS/FAIL/UNVERIFIED statuses. **Evidence:** open PR #8 and audit issue #9 were identified; branch divergence is real. **Still needed:** safely reconcile `main`/`develop` and establish exact-commit CI before major new features. **Why not force merge to main immediately?** `main` contains 17 commits absent from `develop`; blindly replacing either side risks losing work.

## VII.2 Architecture Decision Records (ADRs) to preserve

| ADR | Decision | Alternative rejected/deferred | Reason | Revisit only when |
|---|---|---|---|---|
| ADR-001 | Structured DOM/UIA before screenshots | Screenshot-first control | Lower cost, more precise identity | Structured interface demonstrably insufficient |
| ADR-002 | Deterministic before AI | Model for every click | Less RAM, latency and uncertainty | Measured reasoning benefit |
| ADR-003 | .NET 8/WPF Windows host | Electron shell | Avoid extra resident browser engine | Measured requirements justify tradeoff |
| ADR-004 | Preserve Chrome/Edge extension | Replace user browser | Existing sessions, native DOM access | Strong compatibility reason |
| ADR-005 | Core independent of adapters | Monolithic application | Testability, unloadability, safety | Never without redesign review |
| ADR-006 | Bounded observations | Full DOM/UIA dumps | Memory/CPU and privacy | Only with measured explicit scope |
| ADR-007 | Fail closed on truncation | Act on first matching subset | Prevent wrong-scope mutation | Trusted narrower observation available |
| ADR-008 | Typed actions | Free-form model code | Least privilege and audit | Never for untrusted model output |
| ADR-009 | One-use approval | Generic remembered consent | Context can change | Trusted product policy review |
| ADR-010 | Pre-mutation journal | Post-action-only checkpoint | Crash/replay safety | Never for consequential actions |
| ADR-011 | UnknownEffect on ambiguity | Automatic retry | Avoid duplicate irreversible effects | Independent effect oracle exists |
| ADR-012 | Sanitized bounded logs | Raw transcript/screenshot archive | Privacy and low memory | Explicit user consent and strict scope |
| ADR-013 | Local Ollama currently | Mandatory cloud inference | Local-first control | User explicitly chooses cloud option |
| ADR-014 | Future tiny GGUF optional | Large bundled always-on model | Idle memory and install size | Benchmark justifies choice |
| ADR-015 | Event-driven idle behavior | Continuous polling | Near-zero idle CPU | Polling required and measured |
| ADR-016 | Browser fixture before real mail | Test on production mailbox | Avoid irreversible user-data damage | Never as first test |
| ADR-017 | Real Windows interactive acceptance | Hosted CI only | UIA/focus requires desktop | Never waive release gate |
| ADR-018 | Preserve `develop` until reconciliation | Force-update main | Diverged histories and open PR | Reviewed integration plan approved |
| ADR-019 | Manual alongside code | End-of-project documentation | Prevent user confusion/drift | Never |
| ADR-020 | Evidence-based status | “Looks good” release claims | Trustworthy handoff | Never |

## VII.3 Current GitHub topology and integration safeguards

**Verified snapshot:** GitHub reports default branch `main`, active engineering work on `develop`, additional branches `feature/windows-foundation-v0`, `feature/windows-process-inspection-v0`, `feature/windows-window-discovery-v0`, and open PR #8 titled **Windows capability v0: bounded on-demand process inspection**. A compare of `main...develop` reported diverged histories with `develop` 532 commits ahead and 17 behind and 126 changed files. Issue #9 is the active audit tracker. These facts must be refreshed before any merge or new branch.

**Safe integration procedure:** fetch all refs; inspect both branch logs and merge base; inspect open PR #8's diff and target branch; identify which main-only commits matter; run tests on the intended merge result; use normal protected integration, not force pushes. Do not create a new PR for work already in #8. Do not silently close #8 because a similar feature appears on `develop`; compare actual code. Do not treat the repository default branch as the latest software unless its source and tests prove that.

**Potential documentation cleanup:** The default-branch README may not describe the current alpha. Consider updating repository navigation to explain `develop` as the current development baseline after reviewing branch governance. This is a repository-management task, not permission to overwrite main.

## VII.4 Prioritized 20-work-package execution plan

Each work package is a **bounded deliverable** with prerequisites, definition of done and expected evidence. Complete high-priority safety and acceptance work before broadening scope. Independent work can proceed in parallel only when file ownership does not conflict.

### WP-01 — Reconcile repo baseline and docs [P0]

**Prerequisites:** No prerequisite. **Task:** Review branches, PR #8, issue #9, recent commits, stale Windows approval row. **Definition of done:** One signed-off exact SHA baseline and corrected feature-status contradiction. **Required evidence:** GitHub comparison, source diff, docs commit, no force push.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-02 — Run full Node suite at exact SHA [P0]

**Prerequisites:** WP-01. **Task:** Run npm run check and release audit; investigate failures and rerun. **Definition of done:** All native Node checks PASS or exact blocker recorded. **Required evidence:** Console logs, test count, SHA, environment.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-03 — Installed Chrome self-test [P0]

**Prerequisites:** WP-02. **Task:** Load unpacked, run loopback fixture, collect all lines. **Definition of done:** Fixture PASS; no sensitive leak; no unauthorized action. **Required evidence:** Browser version, report, console, SHA.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-04 — Installed Edge self-test [P0]

**Prerequisites:** WP-02. **Task:** Repeat with Edge; compare differences. **Definition of done:** Same functional/safety outcomes as Chrome. **Required evidence:** Edge version, report, console, SHA.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-05 — Browser credential adversarial acceptance [P0]

**Prerequisites:** WP-03/04. **Task:** Custom labels, shadow DOM, dynamic field changes, canaries. **Definition of done:** No credential read/write/verify leak; benign controls still work. **Required evidence:** Canary assertions, fixture source, logs.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-06 — Browser memory and CPU benchmark [P0]

**Prerequisites:** WP-03/04. **Task:** Large DOM/frames/labels, repeated tasks, idle soak. **Definition of done:** Measured stable resource trend; no unacceptable regression. **Required evidence:** Raw measurements, p95/peak, baseline comparison.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-07 — Browser crash/replay fault injection [P0]

**Prerequisites:** WP-03. **Task:** Kill at every checkpoint/dispatch boundary. **Definition of done:** No duplicate mutation; unknown effect stops. **Required evidence:** Fixture counter, checkpoint evidence.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-08 — Effect oracle capability matrix [P0]

**Prerequisites:** WP-07. **Task:** List each action and proof tier; tighten false success. **Definition of done:** Consequential actions require independent effect proof. **Required evidence:** Matrix, failing-then-passing tests.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-09 — Yahoo disposable-mail verification [P0]

**Prerequisites:** WP-08. **Task:** Stable IDs/scope, pagination, Trash check, confirmations. **Definition of done:** Controlled search/Trash correct, no ambiguous bulk action. **Required evidence:** Disposable account report, IDs sanitized.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-10 — Latest Windows .NET build/XUnit [P0]

**Prerequisites:** WP-01. **Task:** Run test-windows.ps1, fix compile/test issues. **Definition of done:** Exact latest Windows code builds and tests PASS. **Required evidence:** Build/test logs, SHA, SDK version.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-11 — Windows interactive UIA fixture [P0]

**Prerequisites:** WP-10. **Task:** Run -Interactive with focus, duplicate refs, provider faults. **Definition of done:** Controlled UIA actions safe and correct. **Required evidence:** Fixture logs, Windows build, screenshots only if redacted.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-12 — Production Windows trusted consent [P0]

**Prerequisites:** WP-11. **Task:** Implement real review UI using existing one-use primitive. **Definition of done:** Exact action/target displayed; denial/expiry/reuse work. **Required evidence:** WPF acceptance tests, user-manual steps.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-13 — Stable Windows journal/reconciliation [P0]

**Prerequisites:** WP-11/12. **Task:** Choose secure per-user path and trusted recovery UI. **Definition of done:** Crash survives; unknown mutation cannot auto-repeat. **Required evidence:** Kill/restart tests, ACL checks, sanitized record.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-14 — Windows active-UIA resource soak [P0]

**Prerequisites:** WP-11. **Task:** Measure providers, handles, threads, CPU, heap over time. **Definition of done:** No sustained growth or UI hang under controlled load. **Required evidence:** Resource report with p95/peak and trend.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-15 — Local Ollama real-model acceptance [P1]

**Prerequisites:** WP-03/04. **Task:** Extension-origin planning, context, stream/cancel, loopback. **Definition of done:** Bounded valid actions; no external exfiltration. **Required evidence:** Model/quantization/latency/memory report.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-16 — Cross-surface IPC design + spike [P1]

**Prerequisites:** WP-12/13. **Task:** Versioned authenticated bridge with size and origin limits. **Definition of done:** Browser and host exchange typed observation/action safely. **Required evidence:** Threat model, integration tests, RAM baseline.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-17 — Tiny GGUF runtime feasibility [P1]

**Prerequisites:** WP-15. **Task:** Benchmark 2–3 small local models and streaming/unload. **Definition of done:** Selected optional path meets measured memory and task quality. **Required evidence:** Comparative benchmark and license audit.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-18 — In-app autonomous QA/diagnostics UX [P1]

**Prerequisites:** WP-06/14. **Task:** Expose safe fixture self-tests, logs and export in UI. **Definition of done:** User can run diagnostics without developer tooling. **Required evidence:** User manual walkthrough, bounded memory test.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-19 — ROI vision fallback for Windows [P2]

**Prerequisites:** WP-11/16. **Task:** On-demand redacted capture and typed verified actions. **Definition of done:** Semantic failure path can operate safe visual fixture. **Required evidence:** Privacy/ROI/memory/accuracy acceptance.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.

### WP-20 — Release, branding, installer and manual [P2]

**Prerequisites:** All applicable P0/P1. **Task:** Vision Lens assets, installer/update, final docs and gate audit. **Definition of done:** Production gate report PASS or explicit blockers; no false claims. **Required evidence:** Signed/unsigned provenance, install tests, release manifest.

**Coding constraints:** smallest maintainable diff; preserve existing APIs and safety gates; no new resident workers, unlimited caches, unbounded logs or unrelated refactors; record before/after resource measurements when changing hot paths. **Documentation:** update the authoritative ledger, feature status and user manual for any user-visible change. **Failure handling:** two-failure pivot; do not mask a blocker with optimistic language.


## VII.5 Independent workstream ownership (if parallel agents are available)

A lead agent should coordinate rather than have multiple agents edit the same file. Suggested isolated workstreams: **Browser QA/performance** owns fixture and benchmark files; **Windows safety/host** owns WPF consent and journal integration; **Security reviewer** performs read-only threat/secret audits and proposes tests; **Documentation/UX** owns manual and user-facing language; **Integration lead** owns shared Core contracts, cross-surface interfaces and merges. If parallel execution is unavailable, work serially by highest-priority unblocked item. Never invent agent execution or claim an independent review that did not occur.

Every workstream must start with current SHA, file ownership, acceptance criteria and a stop condition. Merge only verified changes after a shared integration test. Avoid broad simultaneous changes to `extension/page-observer-core.js`, `extension/dom-action-adapter.js`, `windows/src/Sightline.Core`, or the authoritative handoff.

## VII.6 Definition of done for one code change

A task is done only when: (1) the requirement and failure mode are identified; (2) the current repo was audited for duplicates; (3) focused code is implemented; (4) unit and integration tests actually execute; (5) regressions are investigated and rerun; (6) security/privacy and memory budgets are preserved; (7) target-platform acceptance is performed or clearly marked blocked; (8) documentation and end-user instructions match behavior; (9) the commit and exact evidence are recorded; and (10) the next task is unambiguously stated. “Code committed” is a checkpoint, not equivalent to production completion.

## VII.7 First-day runbook for the next coding agent

1. Read this V3 preface, Part III requirement ledger, and Part VII branch safeguards.
2. Retrieve `develop` and `main`, inspect open PR #8, issue #9, CI workflows and exact source head.
3. Confirm whether the historical Windows approval-status contradiction is still present; correct only after source verification.
4. Run `npm run check` on the exact `develop` SHA and capture full results. If checkout is blocked, use a different legitimate access route; do not claim PASS.
5. Run `.\tools\test-windows.ps1` with .NET 8 on a Windows machine. Record failures, fix root causes, rerun.
6. Run the installed Chrome and Edge self-test against the localhost fixture. Confirm all gates; do not test destructive actions on real user data.
7. Run credential/adversarial fixtures, then memory/CPU benchmarks with fixed baselines.
8. Implement the highest-priority unblocked fix revealed by real tests, preferably a missing production Windows consent/reconciliation piece or a confirmed browser safety gap.
9. Update `docs/HANDOFF.md`, `docs/FEATURE_STATUS.md`, `docs/ROADMAP.md`, `docs/USER_MANUAL.md`, and issue #9 with exact evidence.
10. Commit focused changes on the intended integration branch according to current repository policy; avoid duplicate PRs and preserve `main`-only work.

## VII.8 Common mistakes to avoid

**Mistake: Treat a low retained heap as low CPU.** Incremental DOM scanning can still visit thousands of nodes. Measure latency and CPU separately. **Mistake: Make an unbounded DOM getter safe by truncating afterward.** The allocation may already have happened; bound traversal before materialization where possible. **Mistake: Overuse fail-closed rules until the app is unusable.** Include benign compatibility cases and narrow observations. **Mistake: Reuse an old approval after a failed snapshot.** Revoke before error-prone work. **Mistake: Treat UIA Invoke success as effect proof.** Require independent readback/oracle. **Mistake: Retry unknown actions.** Reconcile first. **Mistake: Put raw task content in logs.** Use synthetic canaries and structured codes. **Mistake: Claim latest tests passed because the README says the suite passes.** Run the exact SHA. **Mistake: Merge `develop` into `main` blindly.** The branches diverged. **Mistake: Keep researching indefinitely.** Once the architecture is sufficient, implement the next unblocked acceptance gate.

## VII.9 Release-readiness decision framework

A production release should not be declared because the UI looks polished, the extension loads, or a model can click a button. At minimum: browser and Windows installed acceptance, independent effect verification for enabled consequential actions, trusted consent, safe crash recovery, secret redaction, bounded diagnostics, real resource soak, versioned installer/update lifecycle, user manual accuracy and complete release provenance must pass. Capabilities that do not meet their gate must remain disabled, experimental or explicitly unavailable. A limited safe alpha can ship with honest labels; an unsafe feature must not be silently enabled just to claim completeness.

## VII.10 Final no-ambiguity status for the incoming engineer

**What exists in source:** Chrome/Edge MV3 browser alpha, semantic DOM observation, typed actions, safety and confirmation gates, local Ollama planner integration, bounded vision fallback, checkpoint/recovery primitives, diagnostics, Yahoo skill; .NET 8/WPF Windows foundation, Core/Windows separation, UIA/Win32 observer/actions, bounded leases and diagnostics, single-use approval primitive, single-pending-mutation journal and unknown-effect handling. This is not a production certification.

**What has recent targeted execution evidence:** 86/86 observer + DOM-adapter test functions in isolated V8 against current GitHub source. Historical Windows synthetic allocation evidence exists but latest Windows XUnit and interactive tests were not run in the recent checkpoint.

**What is clearly incomplete:** Windows production confirmation and reconciliation UI; stable production journal path; browser↔Windows IPC; embedded tiny streamed GGUF runtime; fully accepted Windows ROI vision; reliable Yahoo bulk destructive-effect oracle; complete installed-browser, active UIA and end-to-end memory acceptance; production installer/update lifecycle.

**What to do next:** Establish exact-commit full test evidence, run real Chrome/Edge and Windows fixtures, fix confirmed defects, measure resource usage, and complete the trusted Windows consent/recovery path. Preserve the original product vision and all explicit user constraints while advancing actual working software.

## VII.11 Ready-to-paste continuation instruction for a new coding agent

> You are taking over **Sightline**, a low-memory, local-first Windows visual AI assistant with a Chrome/Edge MV3 companion. The original user requirement is to build working software that can **See. Understand. Act.** across webpages and native Windows applications. **Strict resource limits, clean modular code, deterministic before AI, privacy, trusted approvals, independent effect verification, crash-safe recovery, robust autonomous QA/logging, and an evolving user manual are mandatory.**
>
> Read `SIGHTLINE_MASTER_HANDOFF.md` (this dossier), then inspect the live `DevTunaSoft/Sightline` repository. **`main` is the default branch but `develop` contains active alpha work; they diverged as of 2026-11-11.** Inspect open PR #8 and audit issue #9 before coding. Do not duplicate features or create redundant PRs. Never force-merge branch histories without review.
>
> The most recent isolated browser observer/adapter checkpoint passed **86/86 targeted test functions**, but this is **not** the native full Node suite or installed-browser acceptance. Latest Windows XUnit, real WPF UIA, real Ollama and browser heap/CPU acceptance remain unverified. Re-run full tests on the exact current SHA; record PASS/FAIL/BLOCKED/NOT RUN/UNVERIFIED accurately. Prioritize full test execution, browser security/performance, production Windows consent/reconciliation and independent effect oracles before optional model/vision features.
>
> Work autonomously within scope: audit, choose highest-priority unblocked task, implement minimal clean changes, test, diagnose root cause, rerun, document, commit and continue. After two identical failures, change approach. Keep one authoritative development ledger in `docs/HANDOFF.md`, update `docs/USER_MANUAL.md`, `docs/FEATURE_STATUS.md`, `docs/ROADMAP.md` and issue #9. Do not claim production readiness or measured RAM improvements without real evidence. Preserve the original Vision Lens branding and **See. Understand. Act.** tagline.

## VII.12 Source and provenance references

**Live repository sources inspected for this edition:** `README.md`, `package.json`, `docs/ARCHITECTURE.md`, `docs/FEATURE_STATUS.md`, `docs/ROADMAP.md`, `docs/SECURITY.md`, `docs/PERFORMANCE.md`, `docs/BROWSER_ACCEPTANCE.md`, `docs/HANDOFF.md`, `docs/USER_MANUAL.md`, and `windows/README.md` on `develop`; GitHub repository metadata, branch search, open PR search, issue #9, and `main...develop` comparison. Selected source/test modules were reviewed in the earlier coding checkpoints; **this handoff did not clone or rebuild the entire repository**.

**Conversation context used:** accessible Sightline project messages dated November 8–11, 2026, including founding visual AI request, browser/Yahoo example, open-source research, Windows requirement, memory/clean-code directive, tiny local AI request, autonomous testing/logging, user manual, original Vision Lens brand/tagline, and explicit handoff-rationale request. This is **not** a complete verbatim chat archive. Direct user wording and engineering derivations are distinguished in Part III.

**Historical source:** the local provided 35-item Sightline audit (`Pasted markdown.md`) was used as a reconciliation checklist. It is a prior analysis and may be stale. The previous 15,709-word handoff was preserved as Parts I and II, with an obsolete Windows approval wording corrected in this V3 document. The historical user requests and code evidence should always be checked against current source before making changes.

**Relevant links:**

- Repository: https://github.com/DevTunaSoft/Sightline
- Active development branch: https://github.com/DevTunaSoft/Sightline/tree/develop
- Default branch: https://github.com/DevTunaSoft/Sightline/tree/main
- Open Windows process inspection PR: https://github.com/DevTunaSoft/Sightline/pull/8
- Engineering audit issue: https://github.com/DevTunaSoft/Sightline/issues/9
- Authoritative chronological ledger: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/HANDOFF.md
- User manual: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/USER_MANUAL.md
- Feature status: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/FEATURE_STATUS.md
- Browser acceptance: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/BROWSER_ACCEPTANCE.md

---

# END OF V3 TAKEOVER DOSSIER

**Operating instruction:** Keep building working Sightline software, but never trade away its safety, resource ceilings, privacy or evidence discipline. Every new code change should be traceable to an actual user requirement or confirmed defect, and every claimed success should be traceable to a real executed test.