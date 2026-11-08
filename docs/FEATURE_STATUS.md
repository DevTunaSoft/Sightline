# Sightline Feature Status

Last updated: 2026-11-08

Status language:
- **Implemented** — source is present on `develop`.
- **Automated-test verified** — covered by the repository test/check suite.
- **Real-browser verified** — accepted in an installed Chrome/Edge extension.
- **Production accepted** — release gates completed.

## Browser-agent core

| Capability | Status | Notes |
|---|---|---|
| Visual side-panel prototype | Implemented / automated-test verified | v0.1 foundation retained. |
| Semantic DOM/accessibility snapshot | Implemented / automated-test verified | Hard bounds: 300 controls, 48 KB snapshot, 8 KB visible text. |
| Same-origin iframe observation | Implemented / automated-test verified | One global resource budget; cross-origin frames remain opaque. |
| Cross-origin iframe reporting | Implemented / automated-test verified | Origin-only metadata; no claim of reading opaque content. |
| Typed actions | Implemented / automated-test verified | read/click/type/clear/select/check/uncheck/scroll/navigate/keypress/wait/verify. |
| Arbitrary model JavaScript | Intentionally not supported | Trusted executor only. |
| Live semantic revalidation | Implemented / automated-test verified | Re-observes immediately before every action and after confirmation delays. |
| Stale snapshot/ref recovery | Implemented / automated-test verified | Re-observe and re-plan, bounded by task limits. |
| Task-loop stall detection | Implemented / automated-test verified | Action/time/repeated-state/repeated-action ceilings. |
| Task tab lock | Implemented / automated-test verified | Active-tab switching cannot redirect a running task. |
| Origin lock | Implemented / automated-test verified | Unapproved origin changes stop the task. |
| Cross-origin navigation approval | Implemented / automated-test verified | Explicit confirmation required. |
| Pause / resume | Implemented | Session-only sanitized checkpoint. |
| Cancel | Implemented | Clears resumable checkpoint. |
| Closed-tab resume recovery | Implemented / automated-test verified | Broken resume state is cleared instead of looping. |
| Local planner | Implemented / automated-test verified | Ollama loopback only; JSON-only decisions. |
| Planner timeout/repair | Implemented / automated-test verified | 90s production timeout; one JSON/schema repair retry. |
| DOM-first vision fallback | Implemented / automated-test verified | Max 2 per task, max 1 per semantic state; active task tab only. |
| Vision budget survives resume | Implemented / automated-test verified | Only integer count persisted; no screenshots. |
| Sanitized diagnostics | Implemented / automated-test verified | No typed action payloads or screenshots in agent report. |
| Performance timing report | Implemented | Observe/plan/vision/execute timing summaries. |

## Yahoo Mail skill

| Capability | Status |
|---|---|
| Yahoo Mail domain detection | Implemented / automated-test verified |
| Search/select-all/Trash semantic hints | Implemented / automated-test verified |
| Result-count extraction and bounded samples | Implemented / automated-test verified |
| Login/MFA/CAPTCHA/security challenge handoff | Implemented / automated-test verified |
| Move-to-Trash confirmation | Implemented / automated-test verified |
| Empty Trash/Delete Forever explicit-intent gate | Implemented / automated-test verified |
| Destructive confirmation preview | Implemented / automated-test verified |
| Post-Trash Yahoo-specific evidence | Implemented / automated-test verified |
| Real Yahoo account acceptance | **Not yet verified** |

## Acceptance still required

- Installed Chrome acceptance
- Installed Edge acceptance
- Live Ollama task execution
- Real Yahoo account non-destructive workflow
- Real Yahoo Trash workflow using disposable/test messages
- Long-session memory/CPU soak in a real browser
- Installer/distribution/update path

Do not infer any of the above from automated fixture success.


## 0.2.0-alpha acceptance tooling

| Gate/tool | Status |
|---|---|
| Installed-browser deterministic self-test | Implemented / automated-test verified |
| Localhost fixture server | Implemented / integration-test verified |
| Windows acceptance launcher | Implemented |
| Extension-origin Ollama self-test | Implemented / automated-test verified |
| CLI Ollama image-inference acceptance | Implemented / syntax/release-check verified; live model still required |
| Yahoo read-only readiness | Implemented / automated-test verified |
| CI extension artifact packaging | Implemented; workflow execution evidence still tracked separately |
| Release permission/security/size audit | Implemented / current branch check verified |
| Real Chrome acceptance | Pending |
| Real Edge acceptance | Pending |
| Live extension-origin Ollama acceptance | Pending |
| Real Yahoo acceptance | Pending |
