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
- Root cause and regression evidence: `feature/windows-foundation-v0` is NOT based on current `develop`. Merge base is `8b1e1ec`. Relative to develop, the foundation branch deletes 21 Windows files and about 1,607 lines, including `WindowDiscovery.cs`, `OneShotDesktopActionApproval.cs`, `FileDesktopMutationJournal.cs`, `WindowDiscoveryTests.cs`, and `ActionSafetyTests.cs`. Merging it as-is into develop would regress that work. `feature/windows-process-inspection-v0-rebased` is based on current develop (merge base `5f19279`) and adds 4 files (`WindowsProcessInspector.cs`, `ProcessInspection.cs` path set, `ProcessInspectionTests.cs`) with no deletions of develop Windows code.
- Known gaps and blockers: (1) PR #6 targets the stale foundation branch. (2) The .NET suites cannot be run here. (3) Live GitHub state is unverified.
- Next three unblocked tasks:
  1. Re-check PR #6 and its CI on GitHub. Decide whether it should be rebased onto `develop` or closed in favour of the process-inspection branch. Do not merge the stale branch as-is.
  2. Run `dotnet build` and `dotnet test` for `windows/` on a machine with the .NET 8 SDK, starting from `c0f12d4` (process-inspection) and from `develop` `0f33739`. Record counts.
  3. Run `.\tools\test-windows.ps1 -Interactive` on an interactive Windows desktop and preserve redacted evidence.
- Exact recovery commands: `git fetch origin develop feature/windows-foundation-v0 feature/windows-process-inspection-v0-rebased` then `git worktree add --detach <dir> origin/develop` and `cd <dir> && npm run check`.
