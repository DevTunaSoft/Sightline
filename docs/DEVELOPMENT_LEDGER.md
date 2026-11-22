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

## 2026-11-22 — Continuous OpenCode developer-runner checkpoint

- **Scope:** Developer automation only; does not alter Sightline runtime or bypass action safety.
- **Source:** `tools/opencode-autopilot.mjs`, `tests/opencode-autopilot.test.js`; usage `docs/OPENCODE_AUTOPILOT.md`; authority `AGENTS.md` and `docs/OPENCODE_AUTONOMOUS_TAKEOVER.md`.
- **Observed baseline:** `develop` commit `c112701`, GitHub CI run 44972309663 PASS, PR #8 still open/nonmergeable; verify again on resumption.
- **Checks executed:** Node 22 isolated runner tests 9 PASS/0 FAIL; two-cycle mocked child-process test PASS with two Git commits and bounded metadata logging. Exact Windows OpenCode v1/v2 and installed-shell test **NOT RUN / UNVERIFIED**.
- **Risk controls:** single lock, stop request, two-cycle anti-loop, short logs without raw AI output, no new dependencies; startup mode runs in foreground and does not survive signout or shutdown.
- **Recovery:** Use `node tools/opencode-autopilot.mjs --model opencode-go/hy4-flash-free` from an updated checkout (verify model ID). See chronological `docs/HANDOFF.md` and PR CI before claiming general QA PASS.

## 2026-11-22 — PR #8 process inspection ported to develop, Windows gates PASS

- **Repository / branch / exact commit:** Sightline `develop`, base `83df33f`; PR #8 original head `520a425` and rebased branch `c0f12d4` inspected, not merged.
- **Requirement IDs:** takeover section 10 items 1 and 5; X-08.
- **Baseline inspected:** local tree clean apart from preserved untracked `.aider.*`; remote heads, open PRs/issues and CI verified; `npm run check` 322/322; PR #8 not merged because its session diff removes approval/journal wiring.
- **Changes (paths and behavior):** `windows/src/Sightline.Core/ProcessInspection.cs`, `windows/src/Sightline.Windows/WindowsProcessInspector.cs`, `windows/tests/Sightline.Windows.Tests/ProcessInspectionTests.cs` added from the reconciled PR diff; `windows/src/Sightline.Windows\WindowsAutomationSession.cs` exposes `ProcessInspector` without altering approval/journal parameters. Read-only, stateless, bounded metadata lookup.
- **Commands run and environment:** `npm run check`; `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1` on Windows with .NET SDK 8.0.428. Both exit 0.
- **Tests:** npm 322 PASS / 0 FAIL; Windows build PASS (0 warnings, 0 errors); Core 65/65 PASS; Windows safety 34/34 PASS (previous 30/30); resource probe PASS; interactive acceptance NOT RUN. Evidence: `.artifacts/windows-foundation/summary.json`, `core.trx`, `windows-safety.trx`.
- **Security/privacy checks:** no new permission, dependency, polling, retained handle or secret-bearing output; handle/thread regression test bounded to +/-1 over 500 inspections; approval and journal contract unchanged.
- **Resource measurements:** handle and thread deltas measured before/after 500 inspections, both within [-1,1]; no new resident cache or background loop.
- **Root cause and regression:** old PR branch point would drop approval/journal wiring; selective port avoids that. Regression guard is the handle/thread test and full Windows safety suite.
- **Known gaps and blockers:** live process launch/attach and interactive inspector acceptance NOT RUN; PR #8 merge/close needs operator decision; externally gated Yahoo/live-model/Edge items untouched.
- **Next three unblocked tasks:** (1) verify CI for the exact pushed SHA; (2) add bounded launch/attach with approval-bound actions and tests; (3) continue reproducible issue #9 findings. Recovery: start from current `develop` HEAD and the chronological `docs/HANDOFF.md` entry.
