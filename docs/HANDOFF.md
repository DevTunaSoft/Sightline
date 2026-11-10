# Sightline Engineering Handoff

Last updated: 2026-11-09

## Product

**Sightline** — *See. Understand. Act.*

Repository: DevTunaSoft/Sightline  
Integration branch: `main`  
Browser development baseline: `develop`  
Current Windows work: `feature/windows-foundation-v0`

## Direction

Sightline is now a lightweight standalone Windows application with the existing Chrome/Edge extension retained as the browser companion.

The browser alpha is preserved; Windows work must not recreate its DOM observation, browser safety, Yahoo skill, checkpoint, or Ollama acceptance features.

## Verified baseline

- repository reconciliation: PASS
- Windows duplication check: PASS
- browser alpha source on develop: PRESENT
- CI defect `package-extension -> needs: test`: CONFIRMED and corrected on Windows feature branch
- Windows runtime behavior: UNVERIFIED
- real Chrome/Edge/Ollama/Yahoo acceptance: UNVERIFIED

## Windows Foundation v0

Implemented on feature branch:
- .NET 8 Windows solution
- `Sightline.Core` with no FlaUI dependency
- `Sightline.Windows` with FlaUI UIA3 adapter
- `Sightline.App` minimal observation CLI
- bounded traversal by node/depth/time
- cancellation
- semantic snapshot DTOs
- structured error-code foundation
- fixed-capacity diagnostic ledger
- xUnit core tests
- deterministic WPF test target
- Windows CI restore/build/test job

Not yet verified until CI completes:
- NuGet restore
- Windows compilation
- tests
- FlaUI API compatibility
- WPF fixture build

Not yet implemented:
- persistent rotating logging
- privacy scrubber
- element lease registry/generation identity
- UIA actions/readback
- focus verification
- UIA circuit breaker
- Win32 adapter
- Windows Graphics Capture/OCR
- browser IPC
- tiny local GGUF runtime
- standalone GUI

## Resource rules

Memory growth is a defect.

All new subsystems must be bounded and measured. Do not add unbounded logs, snapshots, queues, screenshots, model contexts, or caches. Avoid polling. Heavy optional features must load only when needed.

## AI direction

Do not put an LLM in the execution path for tasks deterministic code can solve.

Future routing:
1. deterministic code
2. tiny local GGUF model
3. larger Ollama/local endpoint

Model selection must be benchmarked by capability per MB. Streaming output and bounded context are required. Failure/unavailability of AI must not disable deterministic Windows/browser functions.

## Immediate recovery instructions

1. Inspect the latest commit and CI on `feature/windows-foundation-v0`.
2. If Windows CI fails, fix the first root cause and add/adjust regression coverage.
3. Do not repeat an unchanged failed attempt twice.
4. Once build/tests pass, implement element leases + semantic UIA action/readback.
5. Add automated real-desktop acceptance harness before broad Windows capabilities.
6. Keep docs/status accurate: PASS, FAIL, BLOCKED, NOT RUN, UNVERIFIED.

## Release claims

No production-ready claim is permitted until automated CI and real-machine acceptance have evidence.
