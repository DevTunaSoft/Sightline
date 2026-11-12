# Sightline — Project Brief and Developer Takeover

Last reconciled: 2026-11-10. **Read branch/PR status again before editing.** This document distinguishes desired product behavior from actual tested code.

## One-sentence mission

**Sightline — See. Understand. Act.** A lightweight, privacy-first, local-first Windows visual AI assistant that understands what is on screen, plans safe user-directed actions, executes them through deterministic interfaces, verifies results, and explains failures. The Chrome/Edge extension remains the preferred companion for webpage interaction.

## Intended end-user experience

A nontechnical user can ask Sightline to inspect what they are seeing, explain it, or carry out a bounded task in a browser or Windows application. Sightline should prefer reading structured page or Windows accessibility metadata over processing screenshots. It should act only within permitted scope, visibly report progress, pause or cancel, ask for approval before consequential actions, and produce comprehensible diagnostic evidence when work fails. Design for accessibility and straightforward setup.

The interaction modes are **Observe** (read-only), **Assist** (supervised actions), and **Autonomous** (bounded multi-step actions without bypassing safety gates).

## Nonnegotiable design requirements

- Windows-first lightweight standalone application; retain browser extension as companion. No Electron, Docker, always-on heavy model, or mandatory paid API.
- Structured DOM/UIA/native API before vision or coordinates. Use OCR/vision only when semantic alternatives fail. Prefer event-driven behavior over periodic polling.
- Deterministic trusted executor; **never run arbitrary model-supplied JavaScript or shell commands**.
- Local-first inference and optional small quantized model/runtime, with Ollama for more demanding tasks; model selection and tiny GGUF runtime are roadmap items, **not yet proven Windows features**.
- Hard bounds on RAM, CPU, task time, action count, retries, snapshots, context, log queues, file size, retention, and model concurrency. Record actual resource measurements.
- Treat webpage, screen, OCR, and model output as untrusted. Redact secrets; do not log credentials, tokens, cookies, MFA codes, or sensitive typed values.
- Require explicit approval by default for destructive, financial, public, account/security, or otherwise high-impact actions. Verify current state again after approval; do not replay uncertain destructive actions.
- Every consequential action should produce an observation, action receipt, postcondition verification, and clear recovery/failure classification.
- User-facing documentation and evidence-backed development ledger change with the code. Use **PASS / FAIL / BLOCKED / NOT RUN / UNVERIFIED**, never inferred success.

## Repository topology — verified on 2026-11-10

- **`main`**: default integration branch; the README and original handoff still describe the browser v0.1 prototype. Do not assume later work is merged here.
- **`develop`**: browser-agent baseline and base for Windows PR #6.
- **`feature/windows-foundation-v0`**: Windows foundation under review in [PR #6](https://github.com/DevTunaSoft/Sightline/pull/6), **OPEN, NOT MERGED** at audit time. The PR reports a .NET 8 Core/Windows/App split, bounded FlaUI UIA3 observer, scoped leases, semantic Invoke/SetValue and readback, focus verification, user-activity lease, UIA circuit breaker, fixed-capacity/redacted diagnostics, Windows test fixture and acceptance harness, resource measurements, and CI coverage. Treat these as **PR-branch implementation**, not main-branch capability.
- GitHub issues [#1](https://github.com/DevTunaSoft/Sightline/issues/1)–[#5](https://github.com/DevTunaSoft/Sightline/issues/5) track roadmap, observer and live browser/Ollama/Yahoo acceptance. Reconcile descriptions against current code: older issue bodies may lag implementation.

## Engineering architecture

**Planned target:** `Sightline.App` orchestrates `Sightline.Core` policy, tasks and diagnostics; platform adapters implement Windows UIA/Win32, browser DOM/extension IPC, optional vision/OCR, inference and storage. Core stays independent of UIA, browser runtime, models and GUI framework.

Action lifecycle: **Goal → observe → plan → safety validate → execute typed action → read back and verify → checkpoint → continue/recover/stop**.

Browser-specific work belongs in the extension, where semantic DOM targeting and an existing browser session are available. Windows-native interaction should use native APIs/UIA patterns before physical-input fallback. Screen pixels are not trusted instructions.

## Current implementation versus target

| Area | Source/evidence at audit | Acceptance boundary |
|---|---|---|
| v0.1 browser vision copilot | README documents MV3 side panel, screenshot, screen/video, Ollama, exports, bounded memory | Installed-browser lifecycle and live inference need separately captured evidence |
| Browser agent | `develop` and PR docs report bounded semantic observation, typed actions, safeguards, task loop, Yahoo adapter | Real Chrome/Edge, Yahoo, and Ollama acceptance are still tracked in issues #3–#5 |
| Windows foundation | PR #6 contains .NET 8 Windows source and CI/test harness | Not in `main`; real interactive Windows UIA acceptance **UNVERIFIED** |
| Browser ↔ Windows IPC | Architecture/roadmap only | NOT IMPLEMENTED according to PR #6 |
| Small embedded GGUF model | Roadmap only | NOT IMPLEMENTED according to PR #6 |
| Shippable Windows GUI/installer | Roadmap only | NOT IMPLEMENTED according to PR #6 |
| Full desktop action safety and long-run resource limits | Partial foundation in PR #6 | Real target-machine verification still required |

The PR cites CI run #238 resource evidence: process 24,117,248 B working set, 7,778,304 B private, 183 handles, 8 threads; idle sample +2 handles and +0 threads. These are one-run baseline observations **not RAM limits, a Windows GUI measurement, or a soak-test pass**. The PR states automated browser and Windows checks pass; independently check the specific latest commit and workflow before accepting that statement.

## Priority sequence (do not duplicate completed PR work)

1. Inspect current `main`, `develop`, PR #6 head, all open PRs/issues, workflow conclusions, and changed files. Resolve conflicts and merge PR #6 through normal review/protection policy when its gates pass; do not fabricate a second Windows foundation.
2. Execute **real interactive Windows** acceptance on the PR code using `.\tools\test-windows.ps1 -Interactive`; capture commit, Windows version, test target, diagnostic export, pass/fail, RAM/CPU/handles/threads, and limitations.
3. Execute installed Chrome/Edge and local-Ollama origin-path acceptance from issues #3–#4; test Yahoo only with disposable controlled messages under issue #5.
4. Address confirmed defects with focused regression tests. Measure repeated active-session and idle-session resource stability, focus/user interference, DPI, permission/elevation boundaries, timeouts, interruptions and recovery.
5. Implement secure local browser companion IPC, with least privilege and bounded messages; then expand Windows orchestration, optional OCR/vision fallback, local small-model routing and final GUI/installer as evidence permits.
6. Keep the end-user manual, feature matrix, architecture, changelog, release gates and handoff aligned with the actual branch that contains each feature.

## How a new contributor or AI should start

1. Clone `https://github.com/DevTunaSoft/Sightline.git`; `git fetch --all --prune`; inspect `git status`, `git branch -a`, latest branch commits and the diff for PR #6.
2. Read this file, `README.md`, `docs/ROADMAP.md`, and **the branch-specific** `docs/HANDOFF.md`, `docs/FEATURE_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/USER_MANUAL.md`, plus `windows/README.md` if present. Do not assume a file on a feature branch exists on `main`.
3. Check open issues, PRs, CI runs and current test instructions. Establish an explicit baseline table: component, branch/SHA, implemented, tests run/results, real-machine verification, blockers.
4. Select the highest-priority unblocked **unimplemented** item and define measurable acceptance criteria. Make minimal secure changes, run relevant tests, fix root causes, and add regressions.
5. Update source-linked docs and development ledger in the **same branch/PR**. Include exact commands, commit SHA, environment, measured results, unresolved issues, and next actionable task.
6. After two similar failures, stop that approach, isolate root cause, switch strategy, and continue independent tasks. Never create duplicate fixes/branches/PRs or repeat an unchanged CI run as proof of progress.

## Tests, evidence and logging contract

Record **timestamp UTC, commit SHA, branch, OS/browser/runtime versions, test command, environment, scope, pass/fail/blocked, failure category, artifact location, resource samples and next action**. For execution diagnostics use bounded structured events: session/task/correlation ID, stage, actor/target class (sanitized), duration, outcome, verification evidence, recovery and failure reason. No credentials, typed secrets or full screenshots by default. Exports must be redacted and have explicit retention caps. Real-world acceptance cannot be replaced by a compile or mocked test.

Important risk categories: stale/ambiguous UIA or DOM references, cross-tab/cross-origin confusion, prompt injection, changed-state approval, page navigation race, elevated windows, inaccessible controls, human input interference, model outage, privacy leakage, unbounded memory/log growth, damaged checkpoints, and uncertain action effects.

## End-user manual contract

Maintain `docs/USER_MANUAL.md` whenever behavior changes: prerequisites; supported OS/browsers; local model installation and exact permission settings; start/stop; Observe/Assist/Autonomous examples; confirmation and cancellation; troubleshooting by symptom; diagnostic export; privacy/retention controls; known limitations; recovery; uninstall. Clearly label **engineering preview** instructions versus shipping UX. Do not advertise a Windows installer or ready-to-use GUI until built and tested.

## Release gates

Do not declare production readiness until actual Windows GUI/installer build and clean install, browser integration, live model inference, verified safe actions, task interruption/recovery, protected high-impact operations, crash/soak/performance tests, security/privacy checks, documentation checks and uninstall/update have timestamped PASS evidence on relevant commits.

## Handoff snapshot template (append at each checkpoint)

```text
UTC:
Branch / commit / PR:
Goal and acceptance criteria:
Changed files and why:
Tests (command, environment, counts, PASS/FAIL/BLOCKED/NOT RUN):
Real-device evidence:
Resource measurements:
Defects / root cause / regression:
Security/privacy assessment:
Outstanding blockers and responsible dependency:
Next three unblocked actions:
Exact commands to resume:
```

**Key rule:** Someone taking over must be able to determine what exists, what was tested, what failed, and exactly where to resume **without relying on chat history**.
