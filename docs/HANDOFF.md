# Sightline Engineering Handoff — main-branch navigation

Updated 2026-11-10. **Primary current handoff:** [PROJECT_BRIEF_AND_TAKEOVER.md](PROJECT_BRIEF_AND_TAKEOVER.md). Read it first. This file is a concise navigation and recovery note, not a substitute for inspecting GitHub at the next session.

## What Sightline should become

**Sightline — See. Understand. Act.** A resource-efficient, local-first Windows visual AI assistant with a Chrome/Edge browser companion, built around structured observation, safe actions, explicit verification, bounded autonomous execution, privacy, detailed diagnostics and comprehensive testing. The Windows application should not be confused with the initial browser-only prototype.

## GitHub status at this checkpoint

- Repository: https://github.com/DevTunaSoft/Sightline
- Default integration branch: `main`; original browser prototype baseline here.
- Browser development baseline: `develop`.
- **Open PR #6**, `feature/windows-foundation-v0` → `develop`: .NET 8 Windows foundation, UIA3/FlaUI behind a Windows adapter, bounded observation and element leases, semantic Invoke/SetValue and verification, safety, bounded diagnostics, resource probes and automated test harness. Not merged into main at audit time. See https://github.com/DevTunaSoft/Sightline/pull/6.
- Outstanding real acceptance: real interactive Windows UIA; installed Chrome/Edge (#3); browser-origin Ollama (#4); controlled Yahoo Mail (#5); memory/CPU/handle/thread soak; Windows GUI/installer; Windows-browser IPC; small embedded GGUF runtime.
- Existing roadmap epic: https://github.com/DevTunaSoft/Sightline/issues/1. Older issue checkboxes may be stale; compare actual branch code before opening duplicate work.

## Next contributor actions

1. Inspect live `main`, `develop`, PR #6, workflow evidence, all open issues and PRs. **Never recreate already implemented work.**
2. Run real Windows UIA acceptance from PR #6 on an interactive machine: `.\\tools\\test-windows.ps1 -Interactive`. Record commit, commands, machine configuration, diagnostics, outcomes and resources. If blocked, document it and proceed with independently testable code.
3. Verify Chrome/Edge and Ollama on a real machine, then Yahoo only with disposable controlled mail and confirmation gates.
4. Resolve/merge existing PR through normal policy when accepted. Implement remaining IPC/model/UX capabilities based on tests and roadmap; avoid architectural bloat.
5. Update `docs/PROJECT_BRIEF_AND_TAKEOVER.md`, `docs/HANDOFF.md`, `docs/FEATURE_STATUS.md`, `docs/USER_MANUAL.md`, and relevant README/roadmap with the same code change. Files on PR #6 might not yet exist on `main`.

## Evidence discipline

Use **PASS, FAIL, BLOCKED, NOT RUN, UNVERIFIED** only with matching evidence. Each checkpoint must identify branch and commit, changed files, commands/test counts, environment, failure root causes, regression tests, real-machine evidence, resource samples, blockers and next three unblocked tasks. CI success does not imply interactive Windows acceptance or production readiness.

See the full [takeover guide](PROJECT_BRIEF_AND_TAKEOVER.md) for requirements, architecture, risk areas, privacy/diagnostics contract, user manual requirements and reusable handoff format.
