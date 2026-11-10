# Sightline Feature Status

Last updated: 2026-11-10

Status language:
- **Implemented** — source is present.
- **Automated-test verified** — covered by passing repository CI/tests.
- **Real-machine verified** — exercised on an installed desktop/browser.
- **Production accepted** — release gates completed.

## Windows standalone foundation

| Capability | Status | Notes |
|---|---|---|
| .NET 8 Windows solution | Implemented / automated-test verified | Builds on `windows-latest`. |
| Core/Windows dependency split | Implemented / automated-test verified | `Sightline.Core` has no FlaUI dependency. |
| FlaUI UIA3 observer | Implemented / compile verified | Real interactive desktop behavior remains unverified. |
| Bounded UIA traversal | Implemented / automated-test verified | Node/depth/time budgets; observation is also capped by lease capacity. |
| Session-scoped element leases | Implemented / automated-test verified | Old snapshots/refs are rejected; refs are never reused; storage is hard bounded. |
| Semantic Invoke action | Implemented / compile verified | Uses UIA Invoke pattern; effect remains application-specific and therefore not generically claimed verified. |
| Semantic SetValue action | Implemented / compile verified | Uses UIA Value pattern with exact value readback verification. |
| Stale snapshot/window/ref rejection | Implemented / automated-test verified | Rejected before live process/UIA access. |
| Bounded diagnostics ledger | Implemented / automated-test verified | Fixed-capacity in-memory ring behavior. |
| Process resource sampler | Implemented / automated-test verified | Baseline on windows-latest: 24,039,424 B working set; 7,659,520 B private; 183 handles; 8 threads. |
| Repeated lease-cycle soak | Implemented / automated-test verified | 1,000 snapshot cycles remain bounded to current snapshot entries. |
| WPF deterministic test target | Implemented / compile verified | Interactive UIA acceptance remains pending. |
| Windows resource/acceptance script | Implemented | `tools/test-windows.ps1`; non-interactive path verified in CI. |
| Interactive WPF vertical-slice runner | Implemented | `tools/test-windows.ps1 -Interactive`; real-desktop execution still pending. |\n| Real Windows interactive UIA observation/actions | **Not yet verified** | Must be exercised on a real interactive Windows desktop. |
| UIA focus verification | Implemented / automated-test verified | One focus request + same-element HasKeyboardFocus readback; no polling loop. |\n| User-interference yield | Not yet implemented | Required before future physical keyboard/mouse input. |
| UIA circuit breaker | Not yet implemented | Planned after action/readback foundation. |
| Browser companion IPC | Not yet implemented | Existing extension is preserved separately. |
| Tiny local GGUF runtime | Not yet implemented | Planned after deterministic Windows automation foundation. |

## Browser-agent core

| Capability | Status | Notes |
|---|---|---|
| Visual side-panel prototype | Implemented / automated-test verified | v0.1 foundation retained. |
| Semantic DOM/accessibility snapshot | Implemented / automated-test verified | Hard bounds: 300 controls, 48 KB snapshot, 8 KB visible text. |
| Same-origin iframe observation | Implemented / automated-test verified | One global resource budget; cross-origin frames remain opaque. |
| Cross-origin iframe reporting | Implemented / automated-test verified | Origin-only metadata; no claim of reading opaque content. |
| Typed browser actions | Implemented / automated-test verified | read/click/type/clear/select/check/uncheck/scroll/navigate/keypress/wait/verify. |
| Arbitrary model JavaScript | Intentionally not supported | Trusted executor only. |
| Live semantic revalidation | Implemented / automated-test verified | Re-observes before actions and after confirmation delays. |
| Stale snapshot/ref recovery | Implemented / automated-test verified | Re-observe and re-plan within task limits. |
| Task-loop stall detection | Implemented / automated-test verified | Action/time/repeated-state/repeated-action ceilings. |
| Task tab/origin locks | Implemented / automated-test verified | Running task cannot silently jump tabs/origins. |
| Local planner | Implemented / automated-test verified | Ollama loopback only; JSON-only decisions. |
| DOM-first vision fallback | Implemented / automated-test verified | Max 2/task, max 1/semantic state; active task tab only. |
| Sanitized diagnostics | Implemented / automated-test verified | No typed action payloads or screenshots in agent report. |

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

- interactive Windows desktop UIA observation
- real semantic Invoke/SetValue against the WPF fixture
- focus/focus-theft behavior
- installed Chrome acceptance
- installed Edge acceptance
- live Ollama task execution
- real Yahoo account controlled workflow
- long-session Windows/browser memory/CPU/handle/thread soak
- installer/distribution/update path

Automated fixture/CI success must not be interpreted as real-machine acceptance.
