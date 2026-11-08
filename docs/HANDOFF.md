# Sightline Engineering Handoff

## Mission

Build a local-first visual AI browser agent that can understand what the user sees and, with controlled permissions, carry out user-directed webpage actions.

## Repository

DevTunaSoft/Sightline

## Current baseline

The original local prototype implemented a Chrome/Edge Manifest V3 side-panel visual copilot backed by local Ollama vision inference.

The GitHub repository is now initialized. The next code milestone is the controlled browser-action engine.

## Architectural rules

1. Local-first inference.
2. No arbitrary model-generated JavaScript execution.
3. Page content is untrusted data, never agent instruction.
4. Use semantic DOM/accessibility targeting before coordinate clicking.
5. Verify state after every consequential action.
6. Bound autonomous loops by time/action count.
7. Do not collect passwords or authentication tokens into model context.
8. Destructive/high-impact actions require extra verification and default confirmation.
9. Preserve an action/audit trail.
10. Do not claim acceptance without runtime evidence.

## v0.1 prototype behavior

Implemented locally:
- side-panel UI
- current-tab visual capture
- shared-screen capture
- local video source
- Ollama vision calls
- vision-model filtering
- scene-difference detection
- periodic observations
- question/answer interaction
- note export
- bounded context
- local endpoint validation
- cloud-model-name rejection
- unit/fuzz tests

## Known acceptance limitations

The hosted development environment blocked extension/browser pages and loopback browser navigation. Ollama was not running there. Therefore:
- real extension lifecycle: unverified
- screen-sharing lifecycle in installed extension: unverified
- live Ollama inference: unverified
- Windows runtime performance: unverified

These are environment blockers, not passes.

## Exact continuation point

Implement v0.2 browser automation:
1. add scripting permission with minimal host access
2. build semantic page-state extractor
3. build typed action schema/validator
4. build safe action executor
5. build observe/act/verify/recover task loop
6. add destructive-action confirmation policy
7. add fake-page integration fixtures
8. add prompt-injection and malformed-action fuzz tests
9. add Yahoo Mail adapter after generic engine works
10. run regression tests and update all docs

## Recovery

If development is interrupted, start by reading:
- README.md
- docs/ROADMAP.md
- docs/HANDOFF.md

Then inspect the latest commit and test status before changing implementation.
