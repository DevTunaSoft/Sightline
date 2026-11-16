# Sightline V3 takeover — live repository verification addendum

**Verification date:** 2026-11-11 UTC.  
**Status:** repository/documentation audit only; **no local source build or tests executed by this audit**.  
**Scope:** `DevTunaSoft/Sightline` GitHub live `develop` and `main` branch APIs, comparison API checked in both directions, GitHub Actions run/job metadata and decoded job logs, PR #8 and its patch, issue #9, source/test directory listings, package scripts, and project status documents.

> **Read this before relying on the older V3 takeover dossier.** Some prior status summaries describe targeted test passes and past Windows CI successes. Those are historical evidence, not current-head CI acceptance. The current-head CI run inspected below is **FAIL**.

## 1. Actual repository and authoritative files

- Repository: https://github.com/DevTunaSoft/Sightline
- Current working branch: https://github.com/DevTunaSoft/Sightline/tree/develop
- Main branch: https://github.com/DevTunaSoft/Sightline/tree/main
- Browser source: https://github.com/DevTunaSoft/Sightline/tree/develop/extension
- Windows source and tests: https://github.com/DevTunaSoft/Sightline/tree/develop/windows
- JavaScript tests: https://github.com/DevTunaSoft/Sightline/tree/develop/tests
- Node scripts: https://github.com/DevTunaSoft/Sightline/blob/develop/package.json
- CI workflow: https://github.com/DevTunaSoft/Sightline/blob/develop/.github/workflows/ci.yml
- Authoritative chronological ledger: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/HANDOFF.md
- Feature status: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/FEATURE_STATUS.md
- Roadmap: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/ROADMAP.md
- User manual: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/USER_MANUAL.md
- Browser acceptance: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/BROWSER_ACCEPTANCE.md
- Security: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/SECURITY.md
- Performance: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/PERFORMANCE.md
- V3 dossier: https://github.com/DevTunaSoft/Sightline/blob/develop/docs/handoff/SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md

**Verified scripts:** `npm run check` performs Node syntax checks on browser modules and tools, `npm run audit:release`, then `npm test` (`node --test tests/*.test.js`). `npm run benchmark:core`, `npm run acceptance:serve`, and `npm run acceptance:ollama` are separate commands; they are not automatically proven by `npm run check`. Windows CI restores/builds `windows/Sightline.Windows.sln` and intends to run Core/Windows tests plus resource probes. Real interactive Windows UIA and installed Chrome/Edge acceptance are separate gates.

## 2. Double-checked Git branch baseline (point-in-time snapshot)

At the beginning of this audit:
- `main`: `edc55d2b14834d5b59c080a1015fbf5a897ffb24`
- `develop`: `9060181fcb6a04efea03a74570708589af7cb7ca`
- Merge base: `61023810419da8ece716b78ca8a09b7162065396`
- `main...develop` comparison: **diverged, develop 543 ahead and 17 behind**. Confirmed independently through the dedicated compare tool and GitHub REST compare endpoint.
- Reverse `develop...main` comparison: **main 17 ahead and 543 behind**, confirming direction.
- The reverse comparison identified **12 changed paths**, all documentation or repository process files: `.github/pull_request_template.md`, `CONTRIBUTING.md`, `README.md`, `SECURITY.md`, `docs/DECISIONS.md`, `docs/DEVELOPMENT_LEDGER.md`, `docs/HANDOFF.md`, `docs/PROJECT_BRIEF_AND_TAKEOVER.md`, `docs/RELEASE_READINESS.md`, `docs/REQUIREMENTS_AND_ACCEPTANCE.md`, `docs/ROADMAP.md`, and `docs/SOURCE_MAP.md`.

**Recommended operating default, not a newly authorized merge:** use `develop` for continued work, audit the 17 main-only commits for documentation worth porting, and reconcile carefully without overwriting newer `develop` implementation or ledger. Do **not** force-push, discard main commits, blindly merge, or open duplicate PRs. The branch head changes after this addendum is committed; recompute ahead/behind counts before acting.

## 3. Current-head GitHub Actions — actual failure evidence

**Run:** https://github.com/DevTunaSoft/Sightline/actions/runs/43107375307  
**Commit:** `9060181fcb6a04efea03a74570708589af7cb7ca`  
**Conclusion:** **FAIL**, completed 2026-11-11. Verified through run listing, run details, check-run details, job steps, and decoded job logs.

### Node / Linux validation — FAIL

Job: https://github.com/DevTunaSoft/Sightline/actions/runs/43107375307/job/130814133411

`npm run check` reached the Node tests. **272 tests: 264 PASS, 8 FAIL**. Failed tests:

1. `tests/browser-task-runner.test.js` — browser task uses one vision fallback when semantic planner explicitly requests it (line 291 assertion).
2. `tests/browser-task-runner.test.js` — stale confirmed Yahoo action cannot leak verification context into replanned action (line 437).
3. `tests/browser-task-runner.test.js` — pausing while confirmation is open returns `TASK_CANCELLED`, not `USER_DECLINED_ACTION` (line 488; actual `UNKNOWN_EFFECT`).
4. `tests/yahoo-mail-analysis.test.js` — Yahoo snapshot analyzer deterministically identifies core mail controls and count (expected 327, actual null).
5. `tests/yahoo-mail-analysis.test.js` — Yahoo planner context includes bounded deterministic page hints (expected 42, actual null).
6. `tests/yahoo-mail-analysis.test.js` — Yahoo Trash verification accepts count decrease and success signal (expected true, actual null).
7. `tests/yahoo-mail-analysis.test.js` — Yahoo destructive scope accepts visible search-result state (expected true, actual false).
8. `tests/yahoo-readiness.test.js` — Yahoo readiness passes signed-in page with visible search control (expected 42, actual null).

**Interpretation:** these are observed assertion failures, not yet root-caused. Investigate whether recent fail-closed privacy/scope behavior changed the fixtures or whether actual behavior regressed. Do not weaken credential privacy, confirmation semantics, or destructive-action verification merely to make tests pass. Run focused tests, correct root cause, rerun `npm run check`.

### Windows foundation — FAIL

Job: https://github.com/DevTunaSoft/Sightline/actions/runs/43107375307/job/130814133680

Restore **PASS**; `dotnet build windows/Sightline.Windows.sln -c Release --no-restore` **FAIL** on two xUnit analyzer errors:

- `windows/tests/Sightline.Core.Tests/MutationJournalTests.cs:98` — **xUnit2031**, `Assert.Single(results.Where(result => result))`.
- `windows/tests/Sightline.Core.Tests/OneShotDesktopActionApprovalTests.cs:120` — **xUnit2031**, `Assert.Single(results.Where(accepted => accepted))`.

The analyzer requires the predicate overload `Assert.Single(collection, predicate)` instead of filtering with `Where` first. Apply the minimal source correction and run the Windows build/tests; no evidence yet that all Windows tests will pass after this fix.

The `package-extension` job was **SKIPPED** because its `validate` dependency failed. Windows unit tests, Windows resource probes, and installed GUI acceptance were not executed in this run. The Windows job uploaded no test-result artifacts because the build failed before test execution.

**Prior targeted 86/86 isolated JavaScript checks:** historical, limited evidence only. It does not override current full-suite **FAIL 8/272**. Prior resource/CI claims are historical, not proof of current HEAD.

## 4. PR and issue reconciliation

- **PR #8:** https://github.com/DevTunaSoft/Sightline/pull/8 — OPEN, `feature/windows-process-inspection-v0` into `develop`; four changed files: `windows/src/Sightline.Core/ProcessInspection.cs`, `windows/src/Sightline.Windows/WindowsAutomationSession.cs`, `windows/src/Sightline.Windows/WindowsProcessInspector.cs`, and `windows/tests/Sightline.Windows.Tests/ProcessInspectionTests.cs`. REST detail reported `mergeable: true`, `mergeable_state: unstable` at audit time. This does **not** mean CI or acceptance passed. Do not duplicate or merge without reconciling and testing.
- **Issue #9:** https://github.com/DevTunaSoft/Sightline/issues/9 — OPEN, tracks 35 reported security/reliability findings, with partial implementation and unverified items. These are **triaged findings, not 35 independently reproduced defects**. Reconcile against current code before action.

## 5. The four questions the next coding agent raised

1. **Source and tests:** available directly in `develop`; no new upload needed. The agent should clone/read them before coding. Browser modules, Windows .NET project, JS tests and `package.json` are present.
2. **Authoritative docs:** all seven requested docs exist on `develop`. Read current versions, not only the point-in-time V3 package. Beware stale historical language (e.g., `docs/FEATURE_STATUS.md` says Windows foundation builds on `windows-latest`, while the inspected current-head Windows build is FAIL).
3. **GitHub state:** branch heads, comparison, PR #8, issue #9, and current CI were independently checked as detailed above.
4. **Decisions:** `develop` is the practical working base established by project history, but do not treat that as permission to erase `main`'s 17 unique commits. The existing connected assistant has demonstrated scoped write access to `develop`; another agent must authenticate in its own environment. Prefer minimal direct commits on the established working branch without extra PRs unless a review or branch policy requires them. Start with baseline reconciliation **and immediate CI repair** (the failures above), not speculative new features. GitHub Actions provides a Windows runner for noninteractive .NET build/tests, but **no interactive Windows desktop accessible to the next agent has been confirmed**; real WPF/UIA, Chrome/Edge, and live Ollama acceptance remain **BLOCKED/UNVERIFIED** until such a host is available.

## 6. First next-agent execution sequence

1. Clone `develop`, inspect `git status`, `git log`, both branch heads, PR #8 and issue #9; do not overwrite local changes.
2. Reproduce `npm run check` on Node >=20, capture exact failures, investigate test expectations versus current safe behavior, and fix root causes.
3. Correct the two xUnit2031 call sites; run Windows CI build and Core/Windows tests.
4. Rerun all CI jobs on the new exact commit. Only report PASS when run concludes PASS. Inspect the Windows resource evidence if tests actually execute.
5. Review the 17 main-only commits and selectively reconcile useful documentation. Keep one authoritative development ledger, roadmap, feature status, and user manual.
6. Proceed to the highest-priority unblocked software work. Keep RAM/CPU bounded, avoid duplicate features/branches/PRs, preserve fail-closed safety, and update verification evidence.

## 7. Verification limits and provenance

**PASS:** two independent branch comparisons; GitHub source/docs listings; package and workflow scripts; PR metadata and patch; issue #9; latest workflow run/jobs/checks; decoded Linux and Windows job logs; precise failed assertions and xUnit build diagnostics.

**FAIL:** current-head GitHub CI; 8 of 272 Node tests; Windows build on two xUnit2031 errors.

**NOT RUN in this audit:** local Node tests, local .NET build, real Chrome/Edge extension, WPF interactive tests, real Ollama, actual CPU/RAM profiling.

**UNVERIFIED:** full root causes of the 8 Node failures; Windows test pass after analyzer correction; whether another coding agent has GitHub push permission or an interactive Windows desktop.

**Important:** This is a point-in-time snapshot, not a live dashboard. New commits invalidate its exact head/CI statements. Always re-fetch before changing code or claiming success.
