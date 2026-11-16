# Sightline Architecture

## Design principle

**Structured information before pixels. Deterministic software before AI.**

Sightline is a lightweight standalone Windows application with a Chrome/Edge companion extension. The Windows process owns orchestration, safety, checkpoints, diagnostics, model routing, and cross-surface tasks. The extension remains the preferred browser DOM executor.

## Dependency direction

```text
Sightline.App
   |-- Sightline.Core
   |-- Sightline.Windows --> FlaUI/UIA3 + Win32
   |
   +-- future adapters
       |-- Browser companion
       |-- Vision/OCR
       |-- Models
       |-- Storage
       +-- Skills
```

Rules:
- Core must not depend on FlaUI, browser implementations, or model runtimes.
- Windows automation must not call a model directly.
- Browser/Windows adapters cannot bypass central safety policy.
- Heavy/optional capabilities are lazy and disposable where practical.

## Execution path

```text
Goal
 -> classify minimum required capabilities
 -> observe
 -> plan
 -> validate safety/state
 -> execute deterministic action
 -> live readback/verify
 -> checkpoint
 -> next action / recover / stop
```

For consequential actions, an unknown effect is never blindly retried.

## Windows observation

Foundation v0 uses FlaUI UIA3 behind `Sightline.Windows`.

Observation is always bounded by:
- node count
- depth
- elapsed time
- cancellation

Default provisional budget: 750 nodes, depth 30, 600 ms. These values are subject to measured tuning.

Large unbounded UIA subtree requests are prohibited.

## Element identity

Element references are session-scoped semantic handles, not permanent truth. Future leases bind refs to process/window generation and UIA identity. References are revalidated before mutation and are never silently reused for a different element.

## Windows action hierarchy

1. filesystem/process/native API
2. UI Automation patterns
3. application-specific adapter
4. ROI OCR/vision
5. verified physical input fallback

Coordinate-first automation is not an architectural default.

## Browser companion

The existing MV3 extension is preserved. It provides bounded semantic DOM observation, deterministic actions, local planner integration, safety gates, Yahoo skill logic, checkpoints, and browser acceptance tooling.

A future IPC adapter will connect it to the Windows orchestrator. Sightline will not initially replace the user's Chrome/Edge profile with an embedded browser.

## AI

AI is optional.

- Level 0: deterministic code, UIA, Win32, filesystem, DOM, compiled workflows
- Level 1: small local quantized model for bounded interpretation/routing
- Level 2: Ollama/local endpoint for harder planning or vision

The standalone app must remain useful when models are unavailable.

## Diagnostics

Diagnostics are a product subsystem:
- bounded in-memory ledger
- structured events
- correlation IDs
- rotating/retained file output
- privacy redaction
- crash/recovery evidence
- resource measurements

Foundation v0 starts with a fixed-capacity ledger. Persistent logging is added only with explicit size/retention/backpressure rules.

## Resource architecture

- no Electron
- event-driven instead of polling
- no heavyweight model permanently embedded in the core
- bounded queues/caches/snapshots/logs
- dispose superseded observations promptly
- ROI capture rather than full-screen vision when possible
- heavy workers isolated/disposable when justified
- memory, handles, threads, CPU, and cleanup are acceptance metrics

## Trust

Trust order:
user command > trusted local policy > OS/app metadata > webpage content > OCR > model inference.

Screen/web/model content is untrusted data and cannot override user or safety policy.

Secrets such as passwords, tokens, cookies, MFA codes, and encryption keys must not enter model context or ordinary diagnostics.
