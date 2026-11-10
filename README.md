# Sightline

**See. Understand. Act.**

> **Developer and AI takeover:** Start with [Project Brief and Developer Takeover](docs/PROJECT_BRIEF_AND_TAKEOVER.md). It records the full Windows + browser vision, safety/resource rules, current branch topology, evidence requirements, and exact continuation steps.
>
> **Branch awareness (2026-11-10):** `main` contains the earlier browser documentation baseline; the expanded browser implementation is on `develop`, and the standalone Windows foundation is in [open PR #6](https://github.com/DevTunaSoft/Sightline/pull/6) (`feature/windows-foundation-v0`, targeting `develop`). Do **not** treat open-PR functionality as merged or production-ready.

**Local-first Windows visual AI assistant with a Chrome/Edge browser companion.**

Sightline is being built as a privacy-first browser agent that combines visual understanding with controlled browser automation.

## Project goals

- Understand the current browser tab from screenshots and page context
- Analyze shared screens and local video
- Answer questions about what is visible
- Use local multimodal AI through Ollama
- Add semantic browser actions such as click, type, scroll, select, navigate, wait, and verify
- Support multi-step tasks such as searching a webmail inbox
- Keep credentials and visual data local by default
- Require confirmation for destructive/high-impact actions by default
- Resist prompt injection from webpage content
- Recover from stale elements, navigation, timeouts, and interrupted tasks

## Current status

### Implemented in the local v0.1 prototype

- Manifest V3 Chrome/Edge side-panel architecture
- Current-tab screenshot analysis
- Screen-share and local-video visual sources
- Local Ollama vision integration
- Vision-model capability discovery
- Periodic scene observations
- Conversational questions about the visible content
- Markdown and JSON note export
- Frame resizing and scene-change detection
- Bounded observation/context memory
- Local-only endpoint restrictions
- Input validation and cloud-model blocking
- Prompt-injection-oriented visual system prompt
- Automated unit/fuzz tests

### Next engineering milestone

The next milestone adds the **browser action layer**:

1. Typed action protocol — no arbitrary AI-generated JavaScript
2. Semantic DOM/accessibility state extraction
3. Click/type/scroll/select/navigate/read/wait/verify actions
4. Action verification after every step
5. Planner → act → observe → verify → recover loop
6. Loop/stall detection and bounded execution
7. Sensitive-field redaction
8. Confirmation gates for destructive actions
9. Yahoo Mail as the first real-world workflow adapter
10. Expanded fuzz, fault-injection, and regression testing

## Safety model

Sightline will treat webpage content as untrusted data. Text displayed by a webpage cannot override the user's task or the agent's safety rules. Passwords, authentication tokens, and other sensitive fields should not be collected into AI context.

Actions that can cause meaningful loss or external effects—such as deleting messages, sending mail, purchasing, or changing account settings—will receive additional verification and, by default, a user confirmation checkpoint.

## Local AI

The prototype targets Ollama on loopback only:

`http://127.0.0.1:11434`

A small local vision model such as `gemma3:4b` is the initial target. Model/runtime performance still requires real Windows acceptance testing.

## Verification status

The prototype's JavaScript validation and automated unit/fuzz suite previously passed locally during development. Real browser-extension lifecycle testing and live Ollama inference were **not** completed in the hosted development environment because browser-extension pages/loopback browser navigation were blocked and Ollama was unavailable there.

Those limitations are intentionally documented rather than reported as successful acceptance tests.

## Planned repository structure

```
extension/       Browser extension source
tests/           Automated tests and fixtures
docs/            Architecture, roadmap, QA, handoff, and user documentation
.github/         CI workflows
README.md
package.json
```

## Project stage

**Active development — not production-ready.**

The immediate goal is a dependable browser agent that can both understand a webpage and safely carry out user-directed actions on it.
