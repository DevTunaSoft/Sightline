# Agent Handoff

## How to resume
1. Read `AGENTS.md`, then `docs/OPENCODE_AUTONOMOUS_TAKEOVER.md`, then `CLAUDE.md`.
2. Run `git status --short --branch`; fetch `develop`/`main` with explicit refspecs.
3. Run `npm run check` and confirm 322+ pass.
4. On Windows, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1`.
5. Check open PRs/issues and latest CI for the exact SHA.

## Autonomous execution rules
- Work on `develop`; do not force-push or merge PR #8 wholesale.
- Run tests before commits; verify CI on exact SHA.
- Do not weaken safety rules to make tests pass.
- Use `.artifacts/` for local evidence; do not commit secrets.
- Keep ledgers updated: `docs/HANDOFF.md`, `docs/DEVELOPMENT_LEDGER.md`.

## Current next tasks
1. Yahoo live acceptance (blocked on real test account).
2. Windows production approval UI and journal path.
3. PR #8 selective reconciliation.
4. Planning-model benchmark with saved pages.
5. Optional Edge acceptance.