# Sightline Engineering Roadmap

## v0.1 — Visual intelligence prototype

Status: **Prototype implemented; real-browser acceptance pending**

- Manifest V3 side panel
- Current-tab capture
- Shared-screen capture
- Local video analysis
- Local Ollama vision API
- Vision-capable model discovery
- Periodic scene observations
- Conversational visual Q&A
- Markdown/JSON note export
- Scene-change fingerprinting
- Input/model validation
- Unit and fuzz testing

## v0.2 — Browser action engine

Status: **Next**

### Action protocol
Implement a strict typed schema for:
- read
- click
- type
- clear
- select
- scroll
- navigate
- wait
- verify

Never execute model-generated JavaScript or arbitrary shell/code.

### Semantic page state
Build a compact page representation using visible DOM/accessibility information:
- role
- accessible name
- visible text
- control state
- input type
- bounding box
- stable element identifier

Exclude/redact passwords, hidden sensitive fields, tokens, and unnecessary personal data.

### Executor
- Resolve semantic targets
- Execute one bounded action
- Re-observe after every action
- Verify expected state change
- Detect stale elements/navigation
- Retry safely when appropriate
- Re-plan when state differs from expectation

### Autonomous task loop
Goal → Plan → Observe → Act → Verify → Continue/Recover/Stop

Controls:
- action-count ceiling
- task timeout
- repeated-state detection
- loop/stall detection
- cancellation
- structured action log
- explicit completion criteria

## v0.3 — Yahoo Mail workflow

First real-world adapter:
- search inbox using Yahoo UI
- inspect matching messages
- select matching results
- move messages to Trash
- verify action result
- preview query/count/sample before bulk destructive action
- never store Yahoo credentials

## v0.4 — Reliability and security hardening

- prompt-injection adversarial fixtures
- malformed model-action fuzzing
- stale DOM tests
- duplicate-label ambiguity tests
- hidden/disabled element tests
- navigation race tests
- interrupted task recovery
- action replay prevention
- audit trail
- permission minimization
- regression suite

## v0.5 — Desktop companion exploration

Evaluate a Windows companion for applications outside the browser. Browser DOM automation remains preferred for webpages because it is more reliable than coordinate-only visual clicking.

## Release gates

No production-ready claim until:
- automated tests pass
- real Chrome/Edge extension acceptance passes
- live local Ollama vision inference passes
- Yahoo workflow passes on a real account using non-destructive fixtures first
- destructive-action confirmation behavior is verified
- recovery/stall behavior is verified
- documentation reflects actual behavior
