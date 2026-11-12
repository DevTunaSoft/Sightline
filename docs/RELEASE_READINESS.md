# Sightline Release Readiness Gate

**Current disposition: NOT READY / UNVERIFIED for production.** This checklist is a gate, not a promise. Each checked result needs an artifact linked to an exact release commit, environment and UTC time. A compiled project or simulated test is never a substitute for live acceptance.

| Gate | Expected evidence | Current disposition (2026-11-10) |
|---|---|---|
| Source reconciliation | `main` / `develop` / PR #6 assessed, protected merge completed | NOT COMPLETE; PR #6 open at audit |
| Reproducible automated build | Version-pinned environment; Windows/browser suites on release SHA | UNVERIFIED for release candidate |
| Installed Chrome | Browser-version report, real extension self-test | UNVERIFIED; issue #3 |
| Installed Edge | Browser-version report, real extension self-test | UNVERIFIED; issue #3 |
| Live local model | Browser-origin Ollama discovery and inference, timing, exact model | UNVERIFIED; issue #4 |
| Controlled site workflow | Yahoo search, preview, approved reversible Trash, human challenge handoff | UNVERIFIED; issue #5 |
| Interactive Windows UIA | Real WPF fixture and representative apps, focus, verification, safety | UNVERIFIED; PR #6 runner planned for device |
| Consequential-action safety | Confirmation scope drift, injection, replay and uncertain-result regression | UNVERIFIED cross-surface |
| Memory and CPU stability | Idle/active long soak with repeat samples; leak investigation | UNVERIFIED; one-off CI samples are not a soak |
| Logs and privacy | Redacted export, rotation/retention, canary leak checks | PARTIAL reported in PR #6 |
| Recovery and fail-safe | Cancel, restart, crash, corrupted checkpoint and model outages | UNVERIFIED end-to-end |
| Browser ↔ desktop IPC | Authenticated, least-privilege, bounded messages, disconnection behavior | NOT IMPLEMENTED according to PR #6 |
| Local lightweight AI in Windows | Measured runtime model loading/routing/unloading | NOT IMPLEMENTED according to PR #6 |
| Windows distribution | Accessible GUI, signed release policy, clean install/update/uninstall | NOT IMPLEMENTED according to PR #6 |
| Docs and user manual | Current feature matrix, architecture, troubleshooting, onboarding, handoff match release SHA | IN PROGRESS |

## Release decision

Every gate marked PASS must include exact run URL/artifact, commit SHA, time, OS/browser/model versions, test command, pass criteria and limits. Mark FAIL for a tested defect, BLOCKED for environment/permission/hardware constraints, NOT RUN for skipped tests, and UNVERIFIED for implementation claims without target validation.

A release owner may approve an early **engineering preview** with clearly limited scope, but cannot label incomplete functionality production-ready. Preserve a signed-off gate snapshot as a versioned release artifact. Never infer a release from a passing CI badge alone.

## Final sign-off template

Version/tag; commit SHA; reviewer; UTC; linked evidence archive; open severe issues; known limitations; supported platforms; installer hashes; rollback/uninstall instructions; PASS/FAIL/BLOCKED table; explicit release decision.
