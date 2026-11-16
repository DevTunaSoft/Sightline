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

## ADR-006 — A destructive effect needs independent proof; removal and URL change are not proof

**Status:** Accepted (engineering default). This tightens verification and weakens no safety rule, so it did not need operator approval.

**Context:** The generic structural check accepted a clicked target disappearing as proof of effect. It also accepted a confirmed navigation to a destructive endpoint (for example a GET `/delete?id=` link) as verified because the URL changed to the requested address. The Yahoo skill already states that a disappearing row is never a success oracle (takeover item 10).

**Decision:** For a consequential action, only an observable control-state change on the target counts (`checked`, `expanded`, `selectedIndex`, `valueLength`). Target removal does not count. A navigation to a destructive endpoint (`consequentialNavigation`) is not verified by the URL change alone. No evidence gives `NO_VERIFIED_EFFECT`, which stops the task for manual reconciliation. Nothing is retried.

**Options rejected:** keeping removal as proof (a dialog closing or a re-render would certify a deletion); treating every navigation as unverified (over-refuses ordinary cross-origin navigation).

**Consequences:** Destructive clicks on sites without a skill now stop with `NO_VERIFIED_EFFECT` unless the page shows a control-state change. This is more conservative. Yahoo Trash behaviour is unchanged.

**Requirement IDs:** S-01, S-10, S-15; takeover item 10. **Tests:** `tests/page-observer-core.test.js`, `tests/page-agent.test.js` (removal-only and destructive-endpoint refusal cases).

## ADR-007 — Debugger clicks stay off by default; a visible experimental toggle is added

**Status:** Accepted. The default is unchanged (S-13).

**Context:** The debugger path was reachable only from code. Dossier §12 step 4 asks for a panel setting that is off by default.

**Decision:** The panel has an unchecked "Debugger clicks (experimental)" toggle. It is read on each run and not persisted, so an old "on" state cannot carry over. The label says Chrome may show a debugging notice and that this has not been verified (S-17).

**Requirement IDs:** S-13, S-17. **Tests:** `tests/agent-panel-debugger-toggle.test.js` (static source checks only; browser behaviour is BLOCKED under X-02).

## ADR-008 — PR #8 should be replaced by the rebased branch (recommendation; no GitHub action taken)

**Status:** Proposed. Recommended, not executed. Closing or changing PR #8 is a GitHub action and needs your go-ahead.

**Context:** PR #8 branches from an older `develop` and would remove approval and journal wiring from `WindowsAutomationSession` (G-08, G-09). `feature/windows-process-inspection-v0-rebased` (`c0f12d4`) is based on current `develop` and adds the process-inspection code without deleting develop's Windows code. Its JS suite passes (272/272 at `c0f12d4`). The .NET build has not been run here (W-07), and the rebased branch has no CI run.

**Recommendation:** Replace PR #8 with the rebased branch after a CI run on that branch confirms it builds. Until then, do not merge PR #8.

## ADR-009 — A click on an unnamed control is blocked

**Status:** Accepted (engineering default). This strengthens the gate and weakens no rule.

**Context:** The observer describes every visible interactive element, named or not. `classifyActionRisk` classified a click on an empty-named button as normal, so an icon-only delete button could be clicked with no confirmation and no effect check. An earlier note in the dossier wrongly said observation requires names.

**Decision:** A click whose target has no accessible name (empty or whitespace only) is blocked with `ACTION_BLOCKED`. No confirmation prompt is offered, per S-03. Other action types are unchanged.

**Options rejected:** asking for confirmation on unnamed clicks (the effect check would still have no name to verify, so it would always stop with `NO_VERIFIED_EFFECT`); allowing them as normal (the current gap).

**Consequences:** The planner can no longer click unlabelled controls. Such a control is reachable only if it gains a name in the page. This is the fail-closed direction in the design principles.

**Requirement IDs:** S-03, S-26, X-13. **Tests:** `tests/safety-gate.test.js` (unnamed in both modes; whitespace-only name).

## Proposed future decisions — do not presume accepted

- Browser↔Windows IPC transport, authentication, message and permission protocol.
- Small model benchmark candidates, quality thresholds and unload/streaming policy.
- Persistent task journal integrity, replay semantics and crash recovery.
- Screen capture redaction, storage and diagnostic export user controls.
- Installer packaging, update migration and signing requirements.

**Template for new ADR:** ID / Date / Status / Context / Decision / Options rejected / Rationale / Consequences / Revisit trigger / Requirement IDs / Relevant branch, PR and tests.

## Debugger click coordinate rule (takeover item 3)

- Debugger clicks use CSS pixels relative to the top-left of the page's visible viewport, the same space as `getBoundingClientRect()` in the page. Coordinates are rounded to whole pixels.
- The target is located twice before the approval is spent, then located once more immediately before input. All three must agree within 2 px (`CLICK_POINT_LIMITS.tolerancePx`) and be fully on screen. Any disagreement refuses the click with `STALE_TARGET`, and the approval is treated as spent.
- Browser zoom and device pixel ratio are not corrected for. The rule is correct only while the page's own viewport metrics and the click point come from the same page, which the locate result guarantees. Zoom changes between locate and click are caught by the final locate. Frames are refused (`FRAME_TARGET`). Iframe-aware coordinates are not implemented.
- Verification of the effect is separate (the post-click re-observe, `NO_VERIFIED_EFFECT`/`UNKNOWN_EFFECT`).
