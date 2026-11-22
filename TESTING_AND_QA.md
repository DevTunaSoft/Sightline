# Testing and QA

## Automated
- `npm run check` (syntax + release audit + Node tests)
- `npm test` (Node tests only)
- `npm run audit:release`
- `npm run benchmark:core`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1`

## Acceptance
- Chrome: all 20 self-test checks PASS (Chrome 157.0.8103.79).
- Ollama: PASS (SmolVLM2-2.2B GGUF).
- Windows interactive: PASS (15 bounded elements; SetValue -> Invoke -> readback).
- Edge: not yet run.
- Yahoo live: blocked on real account.

## Evidence
- Windows artifacts: `.artifacts/windows-foundation/`
- CI: GitHub Actions on exact develop SHA.
- Status words: PASS, FAIL, BLOCKED, NOT RUN, UNVERIFIED.