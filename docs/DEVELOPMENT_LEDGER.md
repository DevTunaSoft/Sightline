# Sightline Development Ledger

**Purpose:** Permanent, evidence-first record enabling developer/AI takeover without relying on chat history. This is **not** a record of work that was only proposed. Always check current GitHub state before updating.

## 2026-11-10 — Documentation baseline (verified)

**Branch:** `main`. **Final documentation commit at this checkpoint:** verify current main SHA at time of use; history includes `79f164a`, `5b1fd05`, `40d9c2d`, `6be9ab3`, `663a5ab`, `40bf54d`, `5ceb3a8`, `f42cb0d`, and `defe90f9`.

**Changes confirmed on GitHub:** added `docs/PROJECT_BRIEF_AND_TAKEOVER.md`, `docs/REQUIREMENTS_AND_ACCEPTANCE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/DECISIONS.md`; updated `README.md` and `docs/HANDOFF.md`.

**Evidence:** GitHub contents API returned file contents and SHA after writes. This confirms presence, **not** correctness of application behavior.

**Tests:** Application automated suite NOT RUN for these documentation-only commits. Real Windows/Chrome/Edge/Ollama acceptance UNVERIFIED in this checkpoint.

**Outstanding integration:** PR [#6](https://github.com/DevTunaSoft/Sightline/pull/6) is an existing Windows foundation branch targeting `develop`; do not clone its implementation. The source-specific docs in that PR require reconciliation with `main`. Issues [#3](https://github.com/DevTunaSoft/Sightline/issues/3), [#4](https://github.com/DevTunaSoft/Sightline/issues/4), [#5](https://github.com/DevTunaSoft/Sightline/issues/5) track real-system browser, Ollama, and Yahoo acceptance.

**Next unblocked tasks:** (1) inspect and reconcile PR #6 docs and current CI evidence, (2) run interactive Windows test on an actual desktop and preserve redacted evidence, (3) build documentation/acceptance CI automation without false PASS claims.

## Mandatory entry template for each meaningful checkpoint

```markdown
### YYYY-MM-DD HH:MM UTC — <short title>
- Repository / branch / exact commit SHA / PR / issue:
- Requirement IDs:
- Baseline inspected (branches, PRs, workflows, source paths):
- Changes (paths and behavior):
- Commands run and environment:
- Tests: PASS / FAIL / BLOCKED / NOT RUN / UNVERIFIED, counts, evidence URL:
- Security/privacy checks:
- Resource measurements (duration, samples, RAM, CPU, handles, threads):
- Root cause and regression evidence:
- Known gaps and blockers (category, owner, reproduction):
- Next three unblocked tasks with exact recovery commands:
```

Rules: Append rather than erase prior history. Distinguish historical CI claims from independently rerun tests. Never paste credentials, raw sensitive logs or user data. Close/open issues based on demonstrated acceptance; avoid duplicates. Two identical unsuccessful attempts require change of strategy or explicit blocker.

### 2026-11-16 UTC — Branch reconciliation and offline verification
- Repository / branch / exact commit SHA / PR / issue: DevTunaSoft/Sightline; working branch `claude/serene-mayer-ckp8ee` based on `main` `edc55d2`. Inspected `origin/develop` `0f33739`, `origin/feature/windows-foundation-v0` `1966c0f`, `origin/feature/windows-process-inspection-v0-rebased` `c0f12d4`. PR #6 state NOT CHECKED (GitHub MCP connection failed with proxy 403).
- Requirement IDs: none mapped; release gate "Source reconciliation".
- Baseline inspected: remote heads (`develop`, three `feature/windows-*`, `main`); merge bases; per-file presence of Windows sources on each branch; `package.json` scripts on each branch.
- Changes (paths and behavior): this ledger entry only. No source changes.
- Commands run and environment: `git fetch origin develop feature/windows-foundation-v0 feature/windows-process-inspection-v0-rebased`; detached worktrees of each branch; `npm run check` (includes `audit:release` and `npm test`) on develop; `npm test` on the two feature branches. Node available; `dotnet` NOT installed in this container.
- Tests:
  - develop `0f33739`: `npm run check` PASS (syntax checks, release audit, `npm test`: 307 tests, 307 pass, 0 fail).
  - feature/windows-foundation-v0 `1966c0f`: `npm test` PASS, 142/142.
  - feature/windows-process-inspection-v0-rebased `c0f12d4`: `npm test` PASS, 272/272.
  - .NET build and tests for all Windows code: NOT RUN (no dotnet SDK in container).
  - Real interactive Windows UIA acceptance: UNVERIFIED (needs interactive Windows desktop).
- Security/privacy checks: none run beyond the release audit included in develop's `npm run check`.
- Resource measurements: none taken in this checkpoint.
- Root cause and regression evidence: `feature/windows-foundation-v0` is NOT based on current `develop`. Merge base is `8b1e1ec`. Relative to develop, the foundation branch deletes 21 Windows files and about 1,607 lines, including `WindowDiscovery.cs`, `OneShotDesktopActionApproval.cs`, `FileDesktopMutationJournal.cs`, `WindowDiscoveryTests.cs`, and `ActionSafetyTests.cs`. Merging it as-is into develop would regress that work. `feature/windows-process-inspection-v0-rebased` is based on current develop (merge base `5f19279`) and adds 164 lines across 4 Windows files, with no deletions of develop Windows code: `windows/src/Sightline.Core/ProcessInspection.cs`, `windows/src/Sightline.Windows/WindowsProcessInspector.cs`, `windows/src/Sightline.Windows/WindowsAutomationSession.cs` (modified), `windows/tests/Sightline.Windows.Tests/ProcessInspectionTests.cs`.
- Known gaps and blockers: (1) PR #6 targets the stale foundation branch. (2) The .NET suites cannot be run here. (3) Live GitHub state is unverified.
- Next three unblocked tasks:
  1. Re-check PR #6 and its CI on GitHub. Decide whether it should be rebased onto `develop` or closed in favour of the process-inspection branch. Do not merge the stale branch as-is.
  2. Run `dotnet build` and `dotnet test` for `windows/` on a machine with the .NET 8 SDK, starting from `c0f12d4` (process-inspection) and from `develop` `0f33739`. Record counts.
  3. Run `.\tools\test-windows.ps1 -Interactive` on an interactive Windows desktop and preserve redacted evidence.
- Exact recovery commands: `git fetch origin develop feature/windows-foundation-v0 feature/windows-process-inspection-v0-rebased` then `git worktree add --detach <dir> origin/develop` and `cd <dir> && npm run check`.

### 2026-11-16 UTC — Takeover items 1–4: debugger path safety
- Repository / branch / commit: DevTunaSoft/Sightline, `claude/serene-mayer-ckp8ee`. Commits: `f7dad7b` (imports the one-use approval spend from `feature/debugger-confirmation-consume` `903913d`, merged from unrelated history with develop taken for conflicting docs), `1296283` (post-click outcome check), `Remove insertText` commit, and the final-locate commit on this branch.
- Requirement IDs: S-13, S-14, S-15, S-17 (not tested), X-01 (takeover item 2), CLAUDE.md section 6.
- Baseline: develop `0f33739`; takeover book Part X items 1–4.
- Changes:
  1. Debugger clicks spend the one-use confirmation in the page agent before input. Replay is refused (fix from `903913d`, verified by its tests).
  2. After dispatching a click, the runner re-observes the tab and requires `hasTargetStructuralEffect`. No effect returns `NO_VERIFIED_EFFECT` with no retry. A failed re-observe returns `UNKNOWN_EFFECT`.
  3. A third locate runs immediately before input, after the approval is spent. Any move refuses with `STALE_TARGET` and sends no input. The coordinate rule is written in `docs/DECISIONS.md`.
  4. `insertText` removed from `extension/cdp-input.js`, with its tests (no production caller).
- Commands and environment: `npm run check` on each change; Node in this container; no .NET, no browser.
- Tests: `npm run check` PASS, 313 of 313 at the final state (307 on develop before this work; +6 new/changed debugger and effect tests). Interactive Chrome/Edge run: NOT RUN (no browser here).
- Security/privacy checks: no new network calls; no secrets logged.
- Resource measurements: none.
- Root cause and regression evidence: the debugger path reported `ok:true` with `changed:null` after input and did not verify the page (X-01). Regression tests: no-effect case, failed re-observe case, moved-target case, and the existing replay test.
- Known gaps: the page-script click path's effect check is not changed. S-17 (Chrome's debugger banner) is still UNVERIFIED. Items 5–13 are not started.
- Next three unblocked tasks: (1) run `docs/BROWSER_ACCEPTANCE.md` in installed Chrome and record PASS/FAIL per check (needs a Windows desktop); (2) test whether Chrome shows the debugging banner (S-17); (3) reconcile PR #8 and record the choice in `docs/DECISIONS.md` (needs the operator's choice; the rebased branch is the candidate).
- Exact recovery: `git fetch --depth=200 origin '+refs/heads/develop:refs/remotes/origin/develop'` then `npm run check`.

### 2026-11-16 UTC — Correction: history and divergence figures
- The earlier merge of `feature/debugger-confirmation-consume` used `--allow-unrelated-histories` on the premise that develop and this branch share no history. That was wrong. The check ran on a shallow clone. After `git fetch --unshallow`, `git merge-base origin/main origin/develop` is `6102381`, and the merge in `f7dad7b` joins existing history. The tree result is unchanged, and no history was rewritten.
- Divergence, corrected (local count after unshallow, 2026-11-16): main has 17 commits that develop lacks; develop has 564 that main lacks. The earlier figure of 20 was main's total commit count. CLAUDE.md G-04, HANDOFF.md and the A-3 check are corrected in the same commit.
- Still open: the product-identity note (Part XI item 5) is an operator decision and is not changed here. PR #8 and the rebased branch are not changed.

### 2026-11-16 UTC — CI result for the working branch
- Commit: `4a66f1d` on `claude/serene-mayer-ckp8ee`. CI run `43867299267` (run 583), event push, conclusion **success**. Checked through the GitHub Actions tool.
- Jobs: `validate` success; `package-extension` success; `windows-foundation` success (restore, build, Core tests, safety-layer tests, resource baselines, repeated-session trend, evidence upload).
- Meaning: hosted CI only. The Windows job builds and runs the Windows Core and safety tests on a hosted runner. It does not drive a real desktop (C-07), so interactive UIA acceptance stays BLOCKED.
- Dossier update: X-01 (debugger outcome check) is marked fixed in code (`1296283`). Its live Chrome check remains BLOCKED under X-02. §7.2 and §12 step 6 are updated to match.

### 2026-11-16 UTC — Item 10 audit, debugger toggle, README direction
- Branch: `claude/serene-mayer-ckp8ee`. Base commit before this checkpoint: `2a46c27`.
- Changes:
  1. Target removal is no longer effect evidence for consequential actions (`hasTargetStructuralEffect`). Two page-agent fakes that used removal as their success signal now use a real state change. A removal-only refusal test was added.
  2. A confirmed navigation to a destructive endpoint is no longer verified by URL change alone (`urlOnlyProofRefused`). Found by a failing test first (`tests/page-agent.test.js`, "destructive endpoint"). The fix exports `consequentialNavigation` from `safety-gate.js`.
  3. Panel toggle "Debugger clicks (experimental)", off by default, read per run and not persisted (`extension/panel.html`, `extension/agent-panel.js`). Static tests in `tests/agent-panel-debugger-toggle.test.js`.
  4. README product line now follows ADR-001 (Windows-first, browser companion). ADRs 006–008 added to `docs/DECISIONS.md`. Dossier S-25 and X-13 added.
- Tests: `npm run check` PASS, 319 of 319 (was 313 before this checkpoint; the change counts are 4 new static toggle tests, 1 new removal test, 1 new destructive-endpoint test, and 2 page-agent fakes updated).
- Audit of destructive paths (takeover item 10): click via page agent → generic check (now strict); click via debugger → same check; navigate to destructive endpoint → refused URL-only proof; pressKey Delete/Backspace/Enter → high, no ref, so `hasTargetStructuralEffect` returns false and it cannot verify; Yahoo Trash/delete → skill returns `verified: null`, always `NO_VERIFIED_EFFECT`. Residual gap: unnamed controls (X-13).
- Not verified: any of this in installed Chrome (X-02, BLOCKED). The toggle has not been clicked in a browser.
- Next unblocked: CI on the new commit (run to be recorded); then X-13 (decide how to classify unnamed controls, with a test).

### 2026-11-16 UTC — CI result for `71fdfbb` (item 10 audit commit)
- Commit: `71fdfbb9feff5de7755c74bb0722ae7aee20d3e3` on `claude/serene-mayer-ckp8ee`. Verified with `git ls-remote` after the push.
- CI run `43868738845` (run 585), event push, conclusion **success**. Checked through the GitHub Actions tool; run started 12:40:36Z and finished 12:42:01Z.
- Jobs:
  - `validate` (ubuntu-latest, Node 22): success. Includes `npm run check`.
  - `windows-foundation` (windows-latest, .NET 8): success. Restore, build, Core tests, safety-layer tests, resource baselines, repeated-session trend, and evidence upload all succeeded.
  - `package-extension` (ubuntu-latest): success.
- Meaning: hosted CI only. It does not drive a real desktop (C-07), and it does not test the extension in Chrome or Edge (X-02). The debugger toggle and the destructive-navigation change are covered by fake-browser tests only.
- Earlier runs on this branch, for reference: `4a66f1d` run 583 success; `2a46c27` run 584 success.

### 2026-11-16 UTC — Process-inspection CI, HasExited fix, unnamed-click block
- Branch: `claude/serene-mayer-ckp8ee`. Commits in this checkpoint: `00c45ed` (merge of `feature/windows-process-inspection-v0-rebased` `c0f12d4`, a three-way merge against base `5f19279`; the working branch had not touched those files), `f8b00b2` (HasExited fix), and the unnamed-click commit that follows this entry.
- Purpose: dossier §12 step 10 and ADR-008 require a CI run on the rebased process-inspection code before PR #8 is replaced. This branch now carries that code, so the Windows job builds and tests it. This is a CI run on a branch that also has the working-branch fixes, not on `feature/windows-process-inspection-v0-rebased` itself. No PR was opened and no other branch was pushed.
- Finding (unverified until CI): `WindowsProcessInspector` hard-coded `HasExited: false`. Fixed to `process.HasExited` (`f8b00b2`). The existing test only checks the live test process, so it could not catch this. Not compiled locally (no .NET SDK, W-07).
- Finding (verified by probe): the gate allowed a click on an unnamed button in assist and autonomous mode, with no confirmation and no effect check. My earlier claim that observation requires names was wrong; `describeElement` does not filter unnamed elements. Test first (`tests/safety-gate.test.js`), then fix: unnamed clicks are blocked (`ACTION_BLOCKED`, S-26, ADR-009). Npm check: 320 of 320.
- Dossier: X-13 corrected and marked fixed in code; X-14 added for the HasExited finding.
- Not verified: live-page behaviour of the unnamed-click block (X-02). The .NET build of `f8b00b2` is pending CI.

### 2026-11-16 UTC — CI results for f8b00b2 and b54c509; PR #8 blocker corrected
- **Run `43875040443` (head `f8b00b2`): cancelled.** `validate` and `package-extension` succeeded. `windows-foundation` was cancelled during "Build Windows foundation" because the newer push `b54c509` superseded it (concurrency cancel-in-progress, C-04). Core and safety steps were skipped. So `f8b00b2` has no Windows result of its own.
- **Run `43875178272` (head `b54c509`): failure.**
  - `validate` success (includes `npm run check`).
  - `package-extension` success.
  - `windows-foundation` failure at "Test Windows safety layer" (step 7). The build succeeded with 0 warnings and 0 errors, so the `HasExited` change in `f8b00b2` compiles. This is the first build verification of that change. Core tests: 65 passed, 0 failed. Windows tests: 33 passed, 1 failed (of 34).
  - Failing test: `ProcessInspectionTests.Repeated_current_process_inspection_does_not_accumulate_handles_or_threads`, `ProcessInspectionTests.cs:69`, `Assert.InRange((long)afterHandles - beforeHandles, -1, 1)`, actual 4.
  - The resource-baseline steps were skipped.
- **Same step fails on PR #8.** Run `42892688011` (2026-11-10, head `520a425`) failed `windows-foundation` at the same step, with the same test, the same line and the same actual value (4). Core 19 passed; Windows tests 16 passed, 1 failed (of 17).
- **Interpretation, UNVERIFIED:** the assertion counts process-wide handles over 500 inspections. The three test classes in `Sightline.Windows.Tests` run in parallel by default, and the repo sets no override, so concurrent tests may change the count. This is a probable cause, not a confirmed leak. The test to settle it: run `ProcessInspectionTests` in a non-parallel collection in CI and read the delta.
- **Correction to earlier notes:** G-09 described a reverse diff, not the merge result. A simulated three-way merge of PR #8 head `520a425` into `origin/develop` is clean: 164 insertions, nothing deleted, wiring preserved (`git merge-tree`, tree `98dd7f3`). PR #8's real blocker is its failing Windows job.
- **Working-branch status:** red at the same test. The unnamed-click gate (S-26) passed `validate` in CI.
- **Dossier:** G-09 corrected; G-12 (PR #8 failing job) added; X-15 (the failing test) added; ADR-008 updated in `docs/DECISIONS.md`. No GitHub action on PR #8.
- **Next:** (1) run the test non-parallel in CI to separate noise from a leak; (2) only then decide on PR #8, which is the operator's call.

### 2026-11-16 UTC — CI for d8fb8a5 and 5b2d7bb: handle test passes when isolated
- **Run `43876258655` (head `d8fb8a5`, docs-only commit): failure.** Same code as `b54c509`. `validate` and `package-extension` succeeded. `windows-foundation` failed at "Test Windows safety layer" with the same test, the same line (`ProcessInspectionTests.cs:69`) and the same actual value (4).
- **Run `43879086125` (head `5b2d7bb`, test in a non-parallel collection): success.**
  - `validate` success. `package-extension` success.
  - `windows-foundation` success at every step.
  - Build: 0 warnings, 0 errors, with warnings treated as errors. The serial-collection change compiles.
  - Core tests: 65 of 65 passed.
  - Windows tests: 34 of 34 passed, including `Repeated_current_process_inspection_does_not_accumulate_handles_or_threads`.
  - The three resource-baseline steps ran. They were skipped in every earlier run after the safety step failed. They uploaded `windows-resource.json`, `windows-session-resource.json` and `windows-session-soak.json` in artifact `14230937661`.
- **First green Windows job since `71fdfbb`** (run `43868738845`). Process inspection code is now on this branch and passes CI.
- **Interpretation, UNVERIFIED:** the failure reproduced in all three parallel-collection runs (`42892688011`, `43875178272`, `43876258655`) and did not reproduce in the one isolated run. That fits measurement noise from parallel test classes. It does not exclude a leak: the measured delta is not logged, and one isolated pass is not a stability result. The bound is unchanged at -1 to 1.
- **Dossier:** X-15 updated. ADR-008 next step updated in `docs/DECISIONS.md`.
- **Next:** (1) repeat isolated runs and check that the test stays green; (2) log the measured handle delta so a leak can be ruled out; (3) decide on PR #8 (operator decision). This docs-only commit triggers another CI run, which counts as a second isolated sample.

### 2026-11-16 UTC — CI for 78d1aef: second isolated pass; run 591 cancelled by a push
- **Run `43897969843` (head `c0964d8`): cancelled.** My push of `78d1aef` cancelled it while it was in the Windows restore step. I had called that step stuck, but it was about 30 seconds into a normal restore, so the cancel was my mistake. This run is not a result.
- **Run `43898207891` (head `78d1aef`, page-agent unnamed-click test): success.**
  - `validate` (source checks and tests) success.
  - `package-extension` success.
  - `windows-foundation` success at every step: build, Core tests, the safety layer step (the process-inspection test in its serial collection), and the three resource-baseline steps.
- **X-15 status:** two isolated passes (`43879086125`, `43898207891`) and three parallel-collection failures, all with the same test and actual value 4. Still UNVERIFIED as noise. No measured delta is logged, and two passes do not establish stability.
- **Next:** log the measured handle delta so a leak can be ruled out, then more isolated runs. This docs-only commit triggers one more run, which counts as a third isolated sample.

### 2026-11-16 UTC — CI for 4d04e45: third isolated pass
- **Run `43898827553` (head `4d04e45`, docs-only commit): success.** `validate`, `package-extension` and `windows-foundation` all succeeded. The safety-layer step passed, and so did the three resource-baseline steps.
- **X-15 status:** three isolated passes (`43879086125`, `43898207891`, `43898827553`) and three parallel-collection failures, all with the same test and actual value 4.
- **Inference (UNVERIFIED):** a real leak of about 4 handles per 500 inspections would also appear in the isolated runs. None did. The parallel-collection noise explanation fits. A leak of one handle per 500 would still be inside the bound, so the test cannot rule it out. Logging the measured delta would close that gap.
- This docs-only commit triggers one more run, which is another isolated sample.

### 2026-11-16 UTC — CI for 0e4e0db and 17bf690
- **Run `43899645491` (head `0e4e0db`, docs-only): success.** Fourth isolated pass for the process-inspection test.
- **Run `43913750921` (head `17bf690`, classifier change S-27 and ADR-010): success.** Every job passed, including the Windows safety-layer step. Fifth isolated pass.
- **X-15 status:** five isolated passes and three parallel-collection failures, all with the same test and actual value 4. The cause is still UNVERIFIED because the measured delta is not logged.
- **Stopping point:** the remaining dossier §12 items need Chrome, a Windows desktop, Ollama or your decision. PR #8 is still yours to decide.
