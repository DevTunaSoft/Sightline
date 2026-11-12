# Sightline: Requirements, Traceability, and Acceptance Matrix

Updated 2026-11-10. **This file is a specification and evidence map, not a claim that every row is implemented.** Always check the live branch/commit and CI before changing a status.

## Source-of-truth order

1. Actual source code and tests at a named commit.
2. Recorded CI artifacts and real-machine test exports for that commit.
3. Live issues/PRs and their exact branch heads.
4. This requirements matrix, [takeover guide](PROJECT_BRIEF_AND_TAKEOVER.md), architecture, roadmap, feature-status and user manual.
5. Historical chat/descriptions (never treated as execution evidence).

Do not mark a requirement PASS merely because it is described in documents or compiled.

## Requirement identifiers and release evidence

| ID | Requirement / intended user-visible result | Implementation owner or target | Proof required | Baseline status on 2026-11-10 |
|---|---|---|---|---|
| SLP-001 | Observe current web page semantically without action | Browser MV3 extension, DOM observer | Chrome+Edge fixture and installed self-test | PR branch documentation reports automated coverage; real acceptance UNVERIFIED |
| SLP-002 | Explain screenshots, shared screen, or local video locally | Extension, Ollama | Real vision inference, permission lifecycle, memory telemetry | Prototype reported; real acceptance UNVERIFIED |
| SLP-003 | Execute only validated typed browser actions and verify result | Extension executor/task runner | Malformed-action, stale-ref, SPA, iframe and action verification tests | Browser development implementation reported; real acceptance UNVERIFIED |
| SLP-004 | Bounded planner with pause, cancel, stall detection and recovery | Task core/browser planner | Loop, navigation, interruption, duplicate-effect fault injection | Automated tests reported on development branch; acceptance UNVERIFIED |
| SLP-005 | Desktop observation via structured UIA/Win32 | Windows adapter in PR #6 | Interactive WPF + representative Windows app trials | PR #6 implemented/CI reported; interactive UNVERIFIED |
| SLP-006 | Desktop action through semantic patterns and exact readback | Windows Core + FlaUI adapter | Real Invoke/SetValue/focus/changed-window confirmation | PR #6 code/test reports; interactive UNVERIFIED |
| SLP-007 | No user-input hijack: focus and physical input safeguards | Windows Core/Win32 | Focus theft, race, user-interruption and elevated-window tests | Partial foundation in PR #6; end-to-end UNVERIFIED |
| SLP-008 | Browser extension communicates securely with Windows orchestrator | Future local IPC adapter | Authenticated bounded IPC, malformed messages, disconnect/restart | NOT IMPLEMENTED per PR #6 |
| SLP-009 | Local AI routing; tiny memory-efficient model optional | Models adapter, Ollama/GGUF | Offline test, capability detection, RAM/latency before/after | Ollama extension work; embedded GGUF NOT IMPLEMENTED |
| SLP-010 | Safety blocks prompt injection, secrets and unsafe actions | Shared policy + adapters | Adversarial fixtures and confirmation scope invalidation | Partial browser/Windows safeguards reported; full cross-surface UNVERIFIED |
| SLP-011 | Every action has structured bounded redacted evidence | Core diagnostics, browser diagnostics | Secret-canary tests; burst/rotation/retention and recovery tests | PR #6 reports Windows 10k-event stress; real deployment UNVERIFIED |
| SLP-012 | Idle footprint remains low; no unbounded growth | All components | Repeatable idle/active soak, RAM/private/CPU/handles/threads trend | CI one-sample baseline reported; long soak UNVERIFIED |
| SLP-013 | Recover safely after process/task/model failure | Task checkpoint/recovery | Kill/restart/corrupt journal and consequential-action replay checks | Browser partial; Windows full recovery NOT VERIFIED |
| SLP-014 | Beginner-friendly accessible GUI, installation, troubleshooting | Sightline.App + manual | Clean Win11 install, task success by novice, accessibility inspection | Windows GUI/installer NOT IMPLEMENTED per PR #6 |
| SLP-015 | User can complete a controlled Yahoo workflow | Yahoo adapter | Read-only readiness; test search; approved reversible Trash; handoff on MFA | Automated tests reported; live controlled acceptance UNVERIFIED |
| SLP-016 | Ship private by default without paid API or Docker | Packaging + settings | Offline install, network inspection, permissions, update/uninstall | Production distribution UNVERIFIED |

## Acceptance gates

**Development gate:** source present on exact branch; deterministic tests and lint/build checked; file-level regressions added for defects.

**Integration gate:** targeted tests and broader suite pass on candidate integration commit, no conflicting branch/PR work, docs and migration expectations updated.

**Hardware gate:** real Windows interactive desktop, installed Chrome/Edge, local Ollama, model runtime, actual action verification, elevated/UIPI and multi-monitor/DPI checks.

**Reliability gate:** timeouts, cancellation, model outage, window/tab replacement, user interference, crash/restart, rollback or safe no-replay, fuzz, long-lived resource trend.

**Release gate:** packaged Windows UX, clean install/update/uninstall, security/privacy sign-off, manual accuracy, explicit proof for all gates. No release readiness claim without evidence artifacts.

## Current known branch and documentation drift

- `main` still contains original browser-focused roadmap text, while PR #6 on `feature/windows-foundation-v0` targets `develop` and introduces standalone Windows architecture. Reconcile at merge; do not silently replace later branch documentation with older main files.
- Feature status and user manual files are reported on PR #6 but were absent from `main` when audited. Use PR branch documents when assessing Windows work.
- PR #6 feature-status text contains claims that appear to lag its PR summary (circuit-breaker status) and literal `\\n` artifacts in some Markdown rows. Verify against source and correct on its existing branch before merge.
- Prior resource results are single CI samples; do not set product memory ceilings from them.
- Issue #1 and older issue #2 descriptions may lag actual implementation; update only after checking actual head.

## Evidence record — required at every meaningful checkpoint

| Field | Required content |
|---|---|
| Revision | UTC timestamp; repo, branch, exact commit SHA, PR/issue |
| Change | requirement ID(s), user-visible behavior and changed source paths |
| Verification | commands, test names/counts, environment/version, PASS/FAIL/BLOCKED/NOT RUN |
| Safety | adversarial cases, sensitive data exposure and authorization boundaries |
| Resources | idle and active working set/private bytes/CPU/handles/threads, duration and sample size |
| Defects | symptom, root cause, fix, added regression, retest |
| Constraints | external blockers, unverified behavior, next three unblocked tasks |
| Artifacts | test report and sanitized log paths, CI run URL, screenshots only when safe |

Use this compact checklist in each PR body and handoff update. Evidence must be attached or linked, not merely asserted.

## Anti-duplication and anti-loop procedure

Inspect `git status`, commit graph, all open PRs/issues, relevant source and CI before editing. Locate requirement ID, current owner and branch; annotate any overlap instead of starting a duplicate branch. After two materially similar failed attempts, isolate a minimal reproduction and choose another approach. After two cycles with no measurable progress, record BLOCKED and work on independent items.

## Product UX acceptance examples (planned unless proved)

- **Observe:** “What is this dialog asking me to do?” Sightline explains visible information without clicking.
- **Assist:** “Find these messages and show me what would move to Trash.” Sightline previews and stops for confirmation.
- **Autonomous:** “Fill this non-sensitive web form and check it succeeded.” Sightline uses bounded semantic actions, verifies changes, and reports uncertain outcomes.
- **Windows:** “Find this setting in the current Windows application.” Sightline checks UIA metadata first; never claims to have changed a setting without readback.
- **Failure:** If the target changes, AI is unavailable, or the user interrupts, Sightline stops or safely re-plans; it never blindly repeats a consequential action.

Maintain this matrix with exact implementation refs and evidence links as each component becomes verified.
