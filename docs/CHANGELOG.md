# Changelog

## 0.2.0-alpha — 2026-11-08

Browser-agent alpha foundation:
- semantic DOM/accessibility observer with hard resource bounds
- same-origin iframe observation and opaque cross-origin frame boundary
- typed browser action protocol and deterministic executor
- live semantic revalidation before every action
- bounded autonomous task loop with stale-state recovery and stall detection
- task tab lock and approved-origin lock
- confirmation gates for destructive and cross-origin actions
- explicit intent requirement for irreversible deletion
- Yahoo Mail skill, challenge handoff, preview, and post-action evidence
- local Ollama planner with timeout and one repair retry
- DOM-first visual fallback with strict inference budget
- session-only privacy-bounded task resume
- Pause and Cancel semantics
- sanitized agent diagnostics and performance report
- deterministic installed-browser acceptance harness
- CI extension artifact packaging

### Acceptance status

Automated repository checks are passing on the current development branch. Real installed Chrome/Edge, live Ollama, and real Yahoo-account acceptance remain separate release gates.

