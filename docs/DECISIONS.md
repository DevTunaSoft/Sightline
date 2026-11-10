# Sightline Architecture Decision Register

Use this register for consequential design decisions. Decisions are not implementation proof. Add new entries rather than silently reversing the rationale. Each record should identify context, alternatives, choice, tradeoffs, revisit triggers and affected requirement IDs.

## ADR-001 — Windows-first product with browser companion

**Status:** Accepted product direction; standalone Windows functionality remains under development.

**Decision:** Sightline is a lightweight Windows app, retaining a Chrome/Edge extension for webpage semantics instead of replacing browser profiles with a heavy embedded browser.

**Rationale:** Browser DOM/accessibility access provides precise web interactions while Windows UIA covers desktop software. Separation avoids duplicating browser functionality.

**Tradeoff:** Requires a secure local IPC boundary and two deployment surfaces.

**Revisit if:** Browser integration proves impossible within acceptable permissions or resource budgets.

**Related:** SLP-001, SLP-005, SLP-008, SLP-014.

## ADR-002 — Structured data before visual model calls

**Status:** Accepted principle.

**Decision:** Prefer DOM, accessibility tree, UIA, native interfaces and deterministic rules; use region-of-interest OCR or vision only as a fallback.

**Rationale:** Lower memory, CPU, model tokens and hallucination risk. Better verifiability.

**Tradeoff:** Poorly labeled or graphical applications require fallback handling.

**Revisit if:** Quantitative tests show a particular surface cannot be understood through structured inputs.

**Related:** SLP-001, SLP-002, SLP-005, SLP-009, SLP-012.

## ADR-003 — Local-first and no permanently loaded heavyweight AI

**Status:** Accepted principle; tiny GGUF runtime remains planned.

**Decision:** Deterministic capabilities must work without model inference; optional small local model can assist with routing, and Ollama/local inference can handle harder reasoning/vision when needed.

**Rationale:** Privacy, offline functionality and lower baseline resource footprint.

**Tradeoff:** Model setup and capability discovery need explicit user-facing diagnostics. No assumption that any local model is accurate enough before testing.

**Related:** SLP-002, SLP-009, SLP-012, SLP-016.

## ADR-004 — Safety enforced by trusted code

**Status:** Accepted principle; end-to-end cross-surface gate remains to be verified.

**Decision:** Models propose typed plans; trusted code checks authorization, state and safety before acting and verifies postconditions. High-impact actions require confirmation by default.

**Rationale:** Model responses and webpage content are untrusted and cannot directly execute commands or override user intent.

**Tradeoff:** Some workflows must stop for human involvement.

**Related:** SLP-003, SLP-004, SLP-006, SLP-010, SLP-013.

## ADR-005 — Bounded resources and evidence as release requirements

**Status:** Accepted principle; measurements are incomplete.

**Decision:** Every long-lived cache, model, snapshot, log, queue, timer, retry and background process requires explicit lifetime and caps. Maintain structured verification evidence.

**Rationale:** Small footprint and explainable failure are product requirements, not secondary optimizations.

**Tradeoff:** Bounds may truncate information; truncation must be visible in diagnostics.

**Related:** SLP-011, SLP-012, SLP-013.

## Proposed future decisions — do not presume accepted

- Browser↔Windows IPC transport, authentication, message and permission protocol.
- Small model benchmark candidates, quality thresholds and unload/streaming policy.
- Persistent task journal integrity, replay semantics and crash recovery.
- Screen capture redaction, storage and diagnostic export user controls.
- Installer packaging, update migration and signing requirements.

**Template for new ADR:** ID / Date / Status / Context / Decision / Options rejected / Rationale / Consequences / Revisit trigger / Requirement IDs / Relevant branch, PR and tests.
