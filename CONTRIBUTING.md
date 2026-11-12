# Contributing to Sightline

Sightline — **See. Understand. Act.** A lightweight local-first Windows visual AI assistant, with Chrome/Edge companion.

Before doing anything read [takeover](docs/PROJECT_BRIEF_AND_TAKEOVER.md), [requirements and acceptance](docs/REQUIREMENTS_AND_ACCEPTANCE.md), and the branch-specific architecture, roadmap, feature status, handoff, and manual. **The implementation branch is not necessarily `main`.** As of 2026-11-10, Windows work is in [open PR #6](https://github.com/DevTunaSoft/Sightline/pull/6) targeting `develop`; do not duplicate it.

## First 10 minutes

1. `git clone https://github.com/DevTunaSoft/Sightline.git` and `cd Sightline`.
2. `git fetch --all --prune`; inspect `git status`, `git branch -a`, `git log --oneline --decorate -15`.
3. Review open GitHub issues/PRs and recent CI jobs, especially current PR #6; identify the branch containing relevant source.
4. Review module ownership and dependencies. Check whether the proposed fix/feature exists already on another open branch.
5. Record starting commit SHA and choose one unmet requirement ID from [requirements](docs/REQUIREMENTS_AND_ACCEPTANCE.md).

## Development rules

- Minimal, comprehensible diffs. No unnecessary packages, duplicate implementations, Electron, Docker, mandatory paid services or permanently resident heavy models.
- Keep core policy independent of browser, UIA and model runtimes. Prefer structured DOM/UIA/native APIs before OCR, image inference or coordinates.
- No arbitrary AI-generated shell/JavaScript execution. Treat webpage, OCR, window titles and model outputs as untrusted data.
- Never log/store passwords, cookies, auth tokens, MFA codes or sensitive typed values; use bounded sanitized diagnostic events.
- Always have cancellation, timeouts, retries and memory/queue limits. A consequential action with uncertain result must not be blindly retried.
- Make changes on the correct existing branch/PR; preserve repository protection, avoid duplicate PRs and never force-push others' work without explicit approval.
- Reconcile existing unit/integration/fuzz/soak coverage before adding tests. Add regression coverage for confirmed failures.
- After two similar failed attempts, isolate root cause and change approach. Record BLOCKED rather than repeat unchanged CI indefinitely.

## Verification commands (check scripts exist on your branch)

| Scope | Command / action | What it proves |
|---|---|---|
| Browser automated checks | `npm run check` where `package.json` exists | Source, unit and automated checks only |
| Windows tests/resources | `.\tools\test-windows.ps1` on Windows with .NET 8 SDK, where script exists | Non-interactive foundation checks |
| Windows UIA interactive | `.\tools\test-windows.ps1 -Interactive` on real desktop | Windows WPF fixture path when PASS evidence exported |
| Installed browser | Follow [issue #3](https://github.com/DevTunaSoft/Sightline/issues/3) | Chrome and Edge extension lifecycle |
| Ollama browser origin | Follow [issue #4](https://github.com/DevTunaSoft/Sightline/issues/4) | Live inference from actual extension |
| Yahoo controlled workflow | Follow [issue #5](https://github.com/DevTunaSoft/Sightline/issues/5) | Real site workflow with disposable messages |

**Do not claim PASS** for tests not actually run at your exact revision. A CI compile is not a real-device acceptance test.

## PR checklist

- [ ] Requirement ID, motivation, precise scope and clear acceptance criteria recorded
- [ ] Current branches/issues/PRs inspected for duplication
- [ ] Diff respects memory/CPU/performance and privacy budgets; no new unbounded state
- [ ] Failure behavior, cancellation, confirmation and redaction reviewed
- [ ] Exact automated test commands/results and relevant faults documented
- [ ] Real-machine test results distinguished from mocks/CI; unresolved gates labeled UNVERIFIED
- [ ] Resource measurements reported for changes affecting lifetime, observers, logging or models
- [ ] README/architecture/roadmap/feature status/user manual/handoff updated where applicable
- [ ] Diagnostics contain no sensitive user data or secret values
- [ ] Next unblocked task and precise continuation instructions recorded

Evidence format: UTC time, branch, SHA, OS/runtime, commands, PASS/FAIL/BLOCKED/NOT RUN/UNVERIFIED, failures and root cause, regression, resource samples, artifacts and next three tasks.

## External contributions and reused open-source code

Check license compatibility and notices **before** borrowing code. Preserve required copyright and attribution. Record upstream URL, exact revision, license, files used, changes made, and security/dependency review. Prefer small well-understood reused components over bringing in an entire dependency tree. Do not copy incompatible or unlicensed code.

## Communication

Do not require past chat transcripts to resume. Record decisions in code, PRs and docs. The active branch and actual tests are more authoritative than narrative status messages.
