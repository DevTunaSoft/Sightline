# Sightline OpenCode Autopilot

**Purpose:** Keep the Sightline coding workflow moving when a single OpenCode turn completes. This is a **foreground, local, single-worker** Node.js supervisor; it is not a Windows service, scheduled task, or background process. Nothing runs when the supervising terminal/process is closed.

## Start on Windows

Open PowerShell in the **actual local Sightline checkout**, update its branch safely (first inspect uncommitted work), and run:

```powershell
git status --short --branch
git switch develop
git pull --ff-only origin develop
node .\tools\opencode-autopilot.mjs --model opencode-go/hy4-flash-free
```

If the selected model name differs in your installation, use the exact identifier from `opencode models`, or omit `--model` to use OpenCode's configured default. Check `opencode run --help` first: the current official OpenCode CLI documents `opencode run --auto`, but older builds may differ. The wrapper defaults to this `--auto` mode to approve **routine, non-explicitly-denied** tool permissions; use `--no-auto` if you want normal prompts instead. Run with an ordinary least-privileged Windows user; this is not a sandbox and `--auto` is not unrestricted system authorization.

The wrapper starts one `opencode run` at a time in the Sightline checkout, prompts it to read committed `AGENTS.md`, `CLAUDE.md`, and handoff documents, and selects another unblocked task after a successful cycle. No model-output shell commands are interpreted by the wrapper. The agent itself is bound by repository safety policies. Existing PR #8 reconciliation and ordinary hardening do not require another owner decision.

## Defaults and stop behavior

- `--max-cycles 0`: keep working while useful, verified progress continues and the runner remains active. Change to `--max-cycles 3` for a bounded test.
- `--max-stalled 2`: after two cycles with no Git HEAD/status change, stop and report `NO_MEASURABLE_PROGRESS`; do not burn free-model quota in an infinite loop.
- `--max-failures 2`: stop after two nonzero tool exits. Investigate the first error before restarting.
- `--timeout-minutes 50`: time limit for one OpenCode run, not total work.
- `--pause-seconds 5`: low-CPU gap between cycles.

To stop safely, press **Ctrl+C** in its PowerShell window; it terminates the current supervised process tree and exits. From another terminal, run:

```powershell
node .\tools\opencode-autopilot.mjs --stop
```

The `--stop` file is checked between cycles; an active task may continue until it completes or times out. To inspect the lock/stop state, run `node .\tools\opencode-autopilot.mjs --status`. A stop marker deliberately written from another terminal may need to be deleted before restarting:

```powershell
Remove-Item .\.artifacts\opencode-autopilot.stop -ErrorAction SilentlyContinue
```

**Do not launch a second autopilot in the same checkout.** It uses an atomic PID lock at `.artifacts/opencode-autopilot.lock` and rejects concurrent launches. It recovers stale locks only when the previous PID is no longer running; ambiguous/corrupt locks fail closed. One worker avoids conflicting branches and unnecessary RAM use.

## Evidence, privacy, and limitations

- Supervisor metadata only: `.artifacts/opencode-autopilot.jsonl`. Records cycle number, sanitized exit code, progress boolean, short Git SHA and stop reason. Logs retain at most ~128 KiB plus one rotated prior file. **No raw model transcript, command output, screenshot, account data, or typed values are saved by the runner.**
- OpenCode's own native history, Git commits, CI, and `docs/HANDOFF.md` are the development evidence and continuation sources. Review those when the runner reports a blocker.
- The current Git progress test detects a changed local Git HEAD or changed `git status --porcelain`. A research-only cycle with no repo change is not treated as measurable progress; the agent must write a safe handoff/evidence checkpoint. It is not a substitute for CI or real Windows acceptance.
- Running from a terminal does **not** survive Windows sign-out, reboot, a machine shutdown or a killed parent process. Persistent restart-after-reboot would require separately configured Windows startup scheduling with the owner's explicit approval, process ownership checks and recovery rules.
- Running on an actual Windows PC, the exact installed OpenCode CLI flags, PowerShell shim behavior, and live permission policy **are not verified by Linux simulation**. Check them with a short `--max-cycles 1` supervised run before relying on unattended operation.
- Safeguards still apply: protect credentials and personal files, no UAC/MFA/CAPTCHA bypass, no live Yahoo account mutation without separate authorization, no automatic retry of unknown-effect destructive actions, and no bypassing GitHub reviews/protected branches.

## Evidence checkpoint for this implementation

The wrapper uses only Node.js built-ins; no dependencies or daemon. Nine unit tests cover option validation, forced next-task prompt, Git state changes, sequential cycles, stop behavior, repeated failure/stall handling, duplicate lock refusal and stale-lock cleanup. An isolated Linux integration smoke ran **two back-to-back mocked OpenCode processes**, observed **two Git commits**, and recorded two redacted metadata events. The real Windows/OpenCode invocation remains **UNVERIFIED** until executed on the user's device. The corresponding CI run must also be checked on the exact PR SHA; docs and tests do not prove autonomous Windows operation.

See `AGENTS.md` and `docs/OPENCODE_AUTONOMOUS_TAKEOVER.md` for the full development and permissions contract.
