## Engineering takeover documentation

The complete [Sightline V3 master engineering handoff](docs/handoff/SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md) captures the product vision, user-request rationale, design decisions, architecture, implementation history, acceptance requirements, and next-engineer instructions. The chronological [development ledger](docs/HANDOFF.md) remains the source of truth for verified recent work. The V3 dossier is a point-in-time reference; reconcile its claims with the current code and tests before implementing changes.

# Sightline

> **See. Understand. Act.**

Sightline is a local-first visual browser agent for Chrome and Edge. It combines bounded semantic page understanding, local AI through Ollama, controlled browser actions, visual fallback, recovery, and explicit safety gates.

## Current release

**0.2.0-alpha — active development**

The current `develop` branch includes the browser-agent alpha foundation. The repository check suite is passing. Real installed-browser, live Ollama, and real Yahoo-account acceptance remain separate gates and are not being claimed prematurely.

## What Sightline can do now

- Observe normal HTTP(S) webpages from a Manifest V3 side panel
- Build a bounded semantic snapshot of visible controls and page text
- Read same-origin iframe controls while treating cross-origin frames as opaque
- Propose and execute typed actions: read, click, type, clear, select, check/uncheck, scroll, navigate, keypress, wait, verify
- Re-observe the live DOM immediately before actions
- Detect stale references/page changes and re-plan safely
- Pin a task to its starting tab and approved origins
- Pause/resume from a sanitized session checkpoint
- Cancel and erase the checkpoint
- Use Ollama locally for JSON planning
- Request bounded vision fallback only when semantic data is insufficient
- Stop planner/vision loops with hard budgets
- Require confirmation for destructive and cross-origin actions
- Require explicit intent for irreversible deletion
- Apply Yahoo Mail-specific search/destructive-action guardrails
- Export sanitized agent diagnostics/performance evidence
- Run deterministic installed-browser, local-AI, and Yahoo-readiness acceptance checks

## Privacy and safety

Sightline treats webpage content, screenshots, DOM text, and model output as **untrusted data**.

The AI cannot execute arbitrary JavaScript or shell commands. It proposes a typed action, and trusted deterministic code validates and executes it.

Important controls include:
- no broad `<all_urls>` permission
- Ollama loopback-only integration
- password/OTP/payment/token-like field redaction
- no textbox values used as semantic labels
- no typed text or full navigation URLs in resume checkpoints
- no typed payloads or screenshots in exported agent diagnostics
- live semantic revalidation before every action
- confirmation binding to task + snapshot + target + action
- task-tab and origin locks
- explicit user handoff for login/MFA/CAPTCHA/security challenges

See [Security Model](docs/SECURITY.md).

## Resource strategy

Sightline follows:

> **Deterministic software before AI. DOM before vision.**

Hard budgets include:
- 300 semantic controls
- 48 KB semantic snapshot
- 8 KB visible page text
- 40 action-history checkpoint tail
- 200 diagnostic-event tail
- 40 default actions per browser task
- 120-second default task window
- 90-second planner request timeout
- one malformed-planner repair retry
- maximum two vision fallbacks per task
- maximum one vision fallback for the same semantic state

See [Performance](docs/PERFORMANCE.md).

## Quick start

### 1. Load the extension

In Chrome:

```text
chrome://extensions
```

In Edge:

```text
edge://extensions
```

Enable **Developer mode**, choose **Load unpacked**, and select the repository's `extension` folder.

### 2. Run the deterministic browser self-test

From the repository root on Windows:

```text
tools\start-browser-acceptance.cmd
```

Open Sightline on the local fixture and click **Run browser self-test**.

This does **not** require Ollama.

### 3. Configure local AI

Install/start Ollama, install a local vision model, and allow the exact Sightline extension origin. Example model:

```text
ollama pull gemma3:4b
```

After loading Sightline, copy its exact extension ID and configure Ollama with:

```text
OLLAMA_ORIGINS=chrome-extension://YOUR_ACTUAL_EXTENSION_ID
```

Restart Ollama after changing the variable.

Then click:
- **Load installed models**
- choose a local vision model
- **Test local AI**

### 4. Check Yahoo safely

Open your already-signed-in Yahoo Mail page and click **Yahoo readiness**.

That check is read-only. It does not search, select, move, or delete mail.

## Browser-agent modes

**Observe** — analyze/explain without page mutation.

**Assist** — perform ordinary browser actions; consequential actions stop for confirmation.

**Autonomous** — execute bounded multi-step tasks; safety gates still apply.

## Acceptance commands

```text
npm run check
npm run benchmark:core
npm run acceptance:serve
npm run acceptance:ollama
```

For the installed-browser procedure see [Browser Acceptance](docs/BROWSER_ACCEPTANCE.md).

## Documentation

- [Feature Status](docs/FEATURE_STATUS.md)
- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security Model](docs/SECURITY.md)
- [Performance](docs/PERFORMANCE.md)
- [Browser Acceptance](docs/BROWSER_ACCEPTANCE.md)
- [Beginner User Manual](docs/USER_MANUAL.md)
- [Engineering Handoff](docs/HANDOFF.md)
- [Changelog](docs/CHANGELOG.md)

## Development branches

- `main` — verified integration baseline
- `develop` — active integrated engineering

CI validates source/tests and publishes the `extension/` directory as a GitHub Actions artifact.

## Production status

Sightline is **not production-ready yet**.

Remaining release gates include real Chrome and Edge acceptance, live local-model acceptance, real Yahoo non-destructive/destructive acceptance using controlled test data, long-session resource soak, permission/security review, and release packaging verification.
