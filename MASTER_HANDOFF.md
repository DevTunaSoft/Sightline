# Sightline Master Handoff

## Project
Sightline is a local-first Windows visual AI assistant with a Chrome/Edge Manifest V3 companion extension. Active engineering branch: `develop`. Default branch: `main`.

## Current verified state (2026-11-22)
- Local/remote `develop`: `c112701` (verify with `git ls-remote`).
- `npm run check`: 322 pass / 0 fail, exit 0.
- Windows automated: .NET 8.0.428, Core 65/65, Windows safety 30/30, resource probe PASS.
- Windows interactive acceptance: PASS (observed 15 bounded elements; SetValue -> Invoke -> result readback).
- Chrome installed acceptance: PASS (20/20 checks, Chrome 157.0.8103.79).
- Ollama acceptance: PASS with `hf.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF:Q4_K_M` (38 chars, 17894 ms).
- CI on `develop`: latest run success (verify exact SHA before claiming).

## Architecture
- `extension/`: MV3 side panel, page agent, observer, action protocol/adapter, planner, task loop, safety gate, Yahoo skill, debugger input, diagnostics.
- `windows/`: .NET 8 Core/Windows/App, FlaUI UIA, approval and mutation journal primitives.
- `tests/`: 37 Node test files; Windows xUnit suites.
- `tools/`: acceptance servers, audit, Windows test script, launchers, Ollama smoke.

## Key safety invariants
- Typed actions only; no arbitrary model JS.
- Single-use confirmations bound to action/target/snapshot.
- Fail closed on incomplete/truncated/unknown state.
- Unknown effect is never retried.
- Sensitive fields never read/clicked/typed autonomously.
- Local-first; no cloud model/search without decision.

## Remaining work
- Yahoo live acceptance (needs real test account).
- Edge acceptance (optional).
- Planning-model benchmark on real pages.
- PR #8 selective reconciliation.
- Production Windows approval UI and journal path.

## Recovery
- Clone, checkout `develop`, run `npm run check`.
- Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1`.
- Do not force-push or merge PR #8 wholesale.