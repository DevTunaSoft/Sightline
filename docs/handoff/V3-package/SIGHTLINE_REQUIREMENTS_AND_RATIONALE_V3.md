# Sightline — Requirements and Conversation Rationale (Companion)

This is an extract of the authoritative V3 master handoff. It covers 40 feature requirements with their original purpose, status, implementation ownership, and acceptance criteria. Consult the master for architecture, evidence and risks.

# PART III — REQUIREMENTS INTELLIGENCE: CONVERSATION TO IMPLEMENTATION

## III.1 The exact nature of the request

The user did not ask for a browser macro, a ChatGPT wrapper, or a general-purpose LLM chat application. The original request was to create a **visual AI application** that can see the computer, understand the context, and **take action**. This is why Sightline must contain actual observation, trusted action execution, verification, recovery, and end-user control. A perfect model that cannot click, type, select, navigate, or operate native Windows controls does not meet the request. A perfect macro that cannot recognize changed state also does not meet the request.

The user subsequently pushed in three distinct directions: (1) *research what has already been built* to avoid wasting effort, (2) *implement and test real software* instead of remaining in brainstorming, and (3) *make strict resource discipline the permanent architecture*. Later requests added a tiny streamed local AI, robust autonomous tests and diagnostics, an evolving user manual, and a branding system that reflects the see/understand/act loop. These are **product requirements**, not incidental comments.

### Short user-wording anchors and what they authorize

| Approximate conversation | Supported user wording | Requirement meaning | What it does **not** authorize |
|---|---|---|---|
| Nov 8, visual AI concept | “Build Visual AI App” | Develop actual screen-aware software with action capability | Unlimited screenshot capture or uncontrolled remote execution |
| Nov 8, browser example | Yahoo email search, clicking, selecting and deletion | Test real authenticated browser workflows | Bypassing destructive confirmations or assuming an uncertain deletion succeeded |
| Nov 8–10, open-source search | “dive deeper” / search GitHub and other projects | Research reusable implementations and prior art | Importing entire heavy frameworks without license/security/resource review |
| Nov 10, Windows direction | Windows capability; memory minimum; clean code | Windows must be a first-class target, not an afterthought | Replacing the existing browser companion with a large embedded browser |
| Nov 10, resource direction | “everything has to be light on memory” | Apply limits to logging, testing, inference and observation | Cutting safety context silently just to reduce bytes |
| Nov 10, AI request | Small, memory-efficient, streamed local AI | Design an optional small-model path with bounded context/lifetime | Claiming the GGUF runtime is already implemented |
| Nov 10, manual/logging | Instructional manual and retained verification information | Treat docs and evidence as acceptance artifacts | Saving passwords, full screenshots, or unbounded user content |
| Nov 10, branding | “See. Understand. Act.” | Preserve tagline and original Vision Lens visual identity | Substituting a new brand without explicit user choice |
| Nov 11, engineering direction | “clean modular code, strict resource limits” | Architectural invariant for every code change | Adding dependencies/workers because they simplify a demo |
| Nov 11, handoff direction | “extremely detailed” and include why changes were requested | Explain causal history, decisions, tradeoffs, and continuation | Inventing verbatim chat transcripts or personal profiles |

**Source caution:** Some exact dates and snippets are reconstructed from accessible conversation context, not a complete exported chat archive. Where a date is approximate or wording is paraphrased, it is not presented as a verbatim transcript. This document analyzes **software requirements and decisions**, not the user's personal behavior.

## III.2 Requirement levels and change control

**Level A — Explicit, standing constraints:** Windows and browser interaction; extremely low RAM/CPU; clean modular code; real operation, not a mockup; local-first; robust autonomous testing; robust sanitized logging; evolving manual; user-selected name/tagline/logo; no repeated permission prompts for ordinary authorized coding; accurate status. Any architecture change that weakens these requires an explicit documented tradeoff and, if consequential, user approval.

**Level B — User-requested capabilities with incomplete delivery:** Tiny streamed local AI; real Windows GUI and safe actions; visual/OCR fallback; richer multi-application workflows; verified Yahoo operations; cross-surface orchestration; production diagnostics/recovery UI; automatic tests from within the product. Treat as roadmap commitments with explicit acceptance gates, not as implemented features.

**Level C — Engineering solutions proposed to satisfy A/B:** .NET 8/WPF, UIA3/FlaUI, MV3 extension, bounded TreeWalker, write-ahead journaling, SHA-256 approval fingerprint, local Ollama, optional future GGUF/llama.cpp, typed action schema, one-action-in-flight design. These choices are supported by current code and reasoning, but can be changed after a measured, safe, compatible design review.

**Level D — Exploratory ideas:** additional site skills, richer model routing, workflow learning, ROI OCR, multimodal vision, richer accessibility or visual affordances. Record these separately; do not treat an idea mentioned during research as a committed implementation or add dependencies prematurely.

## III.3 Causal requirement ledger: why each feature exists

The following records are intentionally verbose. A new engineer should be able to read any one entry and understand **the originating need, why a design choice was made, the current implementation evidence, what remains, and how to prove completion**. “Current” means as of this handoff; refresh the live repo and tests before coding.

### SL-REQ-001 — Goal-driven visual computer use [U; P0]

**User intent / requirement:** The assistant must interpret a practical user goal and act on the relevant interface, not only describe it.

**Why this belongs in Sightline:** Conventional chat requires manual execution and coordinate macros break after UI changes. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser agent alpha; Windows foundation; unified mature product incomplete. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** End-to-end task on real webpage and Windows fixture, showing observe→act→independent verify→receipt.

**Implementation ownership / likely files:** Windows host, browser agent, core contracts. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-002 — Native Windows application [U; P0]

**User intent / requirement:** The user explicitly required Windows capability and a real Windows product.

**Why this belongs in Sightline:** Browser-only automation leaves native programs and OS-level workflows unsupported. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** WPF/.NET foundation exists; production UI, installer and interactive acceptance missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Windows 11 interactive fixture; bounded UIA; trusted approval UI; controlled action and reconciliation.

**Implementation ownership / likely files:** Sightline.App, Sightline.Windows. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-003 — Chrome and Edge companion [U/R; P0]

**User intent / requirement:** Operate websites in the user’s normal browser session.

**Why this belongs in Sightline:** Authentication and existing browser profile should remain intact; DOM gives cheaper and more precise state than pixels. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** MV3 side-panel extension on develop; installed browser acceptance pending. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Load unpacked in Chrome and Edge; fixture checks same-origin frames, redaction, action, confirmation.

**Implementation ownership / likely files:** extension/, browser acceptance. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-004 — Yahoo Mail real-world task [U; P0]

**User intent / requirement:** Search, select, and manage Yahoo messages including deletion when explicitly requested.

**Why this belongs in Sightline:** This stresses search scope, pagination, high-impact actions and uncertain server effects. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Yahoo skill and conservative guards exist; real account acceptance and reliable effect oracle missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Disposable mailbox: exact selected message IDs, explicit confirmation, verify Trash state, no blind replay.

**Implementation ownership / likely files:** extension/skills/yahoo-mail.js. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-005 — Extremely low memory [U; P0]

**User intent / requirement:** Every subsystem must be resource-light; resource growth is a defect.

**Why this belongs in Sightline:** An assistant that slows the computer defeats its purpose. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Many bounded structures; hosted Windows allocation evidence; real-browser and active UIA soak missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Idle and active RAM/CPU/handles/threads, long-session trend, regression against baseline.

**Implementation ownership / likely files:** all modules. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-006 — Clean modular code [U; P0]

**User intent / requirement:** Prefer small, maintainable modules with clear ownership and minimal dependencies.

**Why this belongs in Sightline:** Tight coupling produces duplicate logic, test difficulty and hidden resource retention. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Core/Windows/host separation and modular JS present. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Architecture dependency tests, static checks, focused diffs, no unnecessary package additions.

**Implementation ownership / likely files:** all modules. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-007 — Deterministic before AI [U/E; P0]

**User intent / requirement:** Use DOM, UIA, Win32 and native APIs for straightforward tasks.

**Why this belongs in Sightline:** LLM calls are slower, less predictable and more memory intensive than typed deterministic operations. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Architecture and browser/Windows adapters implement this direction. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Ordinary click/read workflow completes with zero model calls; fallback only when justified.

**Implementation ownership / likely files:** orchestrator, adapters. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-008 — Structured before screenshots [U/E; P0]

**User intent / requirement:** Use semantic observations first, then bounded ROI vision only when required.

**Why this belongs in Sightline:** Screenshots expose private content, create large allocations and reduce target precision. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser semantic snapshots; Windows UIA; bounded vision fallback in browser alpha. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Demonstrate no screenshot for semantic tasks and bounded/redacted fallback on test fixture.

**Implementation ownership / likely files:** observers, vision-core. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-009 — Small streamed local AI [U; P1]

**User intent / requirement:** Provide optional tiny local AI that is memory-efficient and streams output.

**Why this belongs in Sightline:** A permanently resident large model would violate the resource contract. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser Ollama integration exists; embedded GGUF runtime not implemented. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Cold load/stream/cancel/unload, capped context/KV memory, idle zero inference, measured latency.

**Implementation ownership / likely files:** model adapter. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-010 — Local-first privacy [U/E; P0]

**User intent / requirement:** Prefer local inference and prevent sensitive task data from leaking.

**Why this belongs in Sightline:** The assistant sees potentially private screens, messages and forms. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Loopback-only Ollama and sanitizer policies documented; real acceptance pending. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Network capture proves no unapproved external inference; canary secrets absent from logs/prompts/checkpoints.

**Implementation ownership / likely files:** security, planner, diagnostics. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-011 — Autonomous task execution [U; P1]

**User intent / requirement:** After receiving a goal, advance through safe steps without repeated handholding.

**Why this belongs in Sightline:** The user wants software that performs work rather than asking permission at every routine step. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser task loop and checkpoints exist; full cross-surface autonomy not accepted. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Multi-step safe task completes without routine prompts; high-impact actions still require trusted consent.

**Implementation ownership / likely files:** task runner, Windows host. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-012 — Autonomous testing [U; P0]

**User intent / requirement:** Testing should be comprehensive and automated rather than dependent on manual QA.

**Why this belongs in Sightline:** Defects need to be caught and repaired systematically. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Node tests, fixture self-tests and Windows scripts exist; latest full-suite and real-device gates unverified. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** One-command local/CI suites, deterministic fixtures, failure evidence and nonzero exit on regressions.

**Implementation ownership / likely files:** tests/, tools/, CI. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-013 — Robust bounded diagnostics [U; P0]

**User intent / requirement:** Capture enough structured evidence to understand failures and verify implementation.

**Why this belongs in Sightline:** Silent failures and unverifiable claims prevent reliable improvement. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser bounded diagnostics and Windows ring/JSONL sink in source. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Secret canaries redacted; rotation/retention/backpressure; crash/fault injection; exportable report.

**Implementation ownership / likely files:** diagnostics-core, Windows Diagnostics. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-014 — Evolving end-user manual [U; P0]

**User intent / requirement:** Maintain a user-facing instructional manual while coding.

**Why this belongs in Sightline:** A capable app without clear instructions is not a usable product. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** docs/USER_MANUAL.md exists and is updated. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Every feature change has a verified user workflow, limitations, screenshots only when accurate, recovery steps.

**Implementation ownership / likely files:** docs/USER_MANUAL.md. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-015 — Verifiable engineering ledger [U; P0]

**User intent / requirement:** Record decisions, code changes, tests, failures and evidence for future reference.

**Why this belongs in Sightline:** Future engineers must distinguish actual work from optimistic status summaries. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** docs/HANDOFF.md, roadmap, feature status and issue #9 exist. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Every checkpoint includes exact SHA, environment, PASS/FAIL, artifacts, blockers and next command.

**Implementation ownership / likely files:** docs/HANDOFF.md. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-016 — Reuse open-source prior art [U; P1]

**User intent / requirement:** Research existing GitHub and other open-source implementations before building duplicates.

**Why this belongs in Sightline:** Borrowing small mature solutions can accelerate development and avoid known bugs. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Research history exists; no claim all candidates were integrated. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** License/dependency/security/resource audit before each import, with attribution and no duplicate subsystem.

**Implementation ownership / likely files:** architecture/research. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-017 — Human-like interaction without impersonation [U/E; P1]

**User intent / requirement:** Make the agent navigate interfaces naturally using real controls.

**Why this belongs in Sightline:** User intent is practical interface competence, not spoofing humans or evading website safeguards. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** DOM/UIA adapters present; richer cross-surface skills planned. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Respect site permissions and challenges; visible, auditable action trail; no stealth or CAPTCHA bypass.

**Implementation ownership / likely files:** browser/Windows adapters. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-018 — Exact target identity [E/R; P0]

**User intent / requirement:** Bind every action to a unique, fresh control and page/window identity.

**Why this belongs in Sightline:** Stale refs and duplicate labels can cause a wrong click or destructive action. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser snapshot refs and Windows leases exist; UIA runtime identity hardening incomplete. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Move/recreate target between observe/act and prove action refuses wrong target.

**Implementation ownership / likely files:** ref-registry, ElementLeases. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-019 — High-impact confirmation [U/E; P0]

**User intent / requirement:** Require trusted explicit approval for delete/send/pay/account changes.

**Why this belongs in Sightline:** Autonomy should not become unbounded authority. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser approval primitive and Windows one-use Core primitive exist; Windows production UI missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** One action, one use, expiry, changed context invalidation, no webpage/model-armed approval.

**Implementation ownership / likely files:** safety-gate, approvals. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-020 — No blind replay of uncertain effects [E/R; P0]

**User intent / requirement:** If mutation might have occurred, stop until independent reconciliation.

**Why this belongs in Sightline:** Retrying an ambiguous send/delete can duplicate irreversible outcomes. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser write-ahead checkpoint; Windows journal and UnknownEffect policies in source. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Crash at every mutation boundary; restart never auto-replays; verified resolution required.

**Implementation ownership / likely files:** task-checkpoint, Windows journal. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-021 — Independent effect verification [E/R; P0]

**User intent / requirement:** Prove application-side state, not merely event dispatch.

**Why this belongs in Sightline:** UIA Invoke success, DOM disappearance, counts or toasts can be misleading. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Structural checks exist; Yahoo server-side oracle remains incomplete. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Test false positives (pagination, ad change, delayed server, wrong selection) and verify stable IDs.

**Implementation ownership / likely files:** verification adapters. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-022 — Sensitive-field protection [E/R; P0]

**User intent / requirement:** Detect password/OTP/card fields and refuse autonomous read/write/verification leakage.

**Why this belongs in Sightline:** The agent handles untrusted webpages and may encounter private credentials. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Shared bounded detector; native/linked labels rechecked at action time; 86 isolated tests passed. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Real Chrome/Edge custom controls, shadow DOM, dynamic label, multi-language canary tests.

**Implementation ownership / likely files:** page-observer-core, dom-action-adapter. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-023 — Prompt-injection resistance [E/R; P0]

**User intent / requirement:** Treat page text, email bodies, OCR and model output as untrusted.

**Why this belongs in Sightline:** Web content can instruct an AI to override the user or exfiltrate data. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Typed action validation and untrusted delimiters documented; adversarial real-browser tests missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Injected page cannot escalate permissions, trigger shell/JS, send secrets, or bypass confirmation.

**Implementation ownership / likely files:** planner, safety-gate. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-024 — Bounded browser observation [U/E/R; P0]

**User intent / requirement:** Limit DOM nodes, frames, text, labels and snapshot size.

**Why this belongs in Sightline:** Huge pages can create excessive RAM/CPU and false complete observations. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Lazy TreeWalker and hard caps in source; installed-browser benchmark pending. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Stress 100k nodes/long text/iframes; deterministic truncation, stable heap, no unbounded NodeList.

**Implementation ownership / likely files:** page-observer*. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-025 — Bounded browser actions [U/E/R; P0]

**User intent / requirement:** Cap reads, verify scans, dropdown options and action durations.

**Why this belongs in Sightline:** Even a small snapshot can hide expensive action-time reads. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Read/verify scan caps and option cap in source. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Oversized select/read returns explicit incomplete/unknown result without side effect.

**Implementation ownership / likely files:** dom-action-adapter. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-026 — Bounded task and model context [U/E/R; P0]

**User intent / requirement:** Limit action count, task time, planner prompt and repair retries.

**Why this belongs in Sightline:** Unbounded planning burns CPU, RAM, context and time. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Task and prompt limits documented; real Ollama context truncation unverified. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Long page and malformed model output never exceed configured context/repair budget.

**Implementation ownership / likely files:** task-loop, planner. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-027 — Cancellation and cleanup [U/E; P0]

**User intent / requirement:** Cancel quickly and dispose timers/listeners/refs/leases without leaks.

**Why this belongs in Sightline:** A low-memory assistant must release resources after each task. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Wait-listener cleanup and bounded refs have isolated tests. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Cancel mid-wait, mid-observe, mid-model, mid-mutation; measure handles/listeners/heap after recovery.

**Implementation ownership / likely files:** all async adapters. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-028 — Windows focus and human control [E/R; P0]

**User intent / requirement:** Avoid stealing focus or acting while user changes the target.

**Why this belongs in Sightline:** Automation must not race the human operator. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** User-activity lease and focus readback present; real desktop tests pending. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Type while user switches windows; action aborts safely; no hook/polling loop required.

**Implementation ownership / likely files:** Sightline.Windows. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-029 — Windows UIA circuit breaker [E/R; P0]

**User intent / requirement:** Bound provider hangs and repeated failures per process.

**Why this belongs in Sightline:** Third-party UIA providers can stall or misbehave. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Bounded circuit breaker exists. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Fault injection: timeout, half-open probe, cooldown, no unbounded process table.

**Implementation ownership / likely files:** UIA observer/executor. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-030 — Windows durable mutation journal [E/R; P0]

**User intent / requirement:** Persist one pending mutation before dispatch.

**Why this belongs in Sightline:** A crash must not erase uncertainty and allow duplicate execution. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Write-through single-action file in source; production path/reconciliation missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Kill process at pre-dispatch and post-dispatch points; pending journal survives restart.

**Implementation ownership / likely files:** Windows journal, host. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-031 — Trusted Windows approval UI [E/R; P0]

**User intent / requirement:** Provide real user review for exact action/target before mutation.

**Why this belongs in Sightline:** Core approval primitive is not a usable end-user consent experience. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** One-use primitive exists; production WPF approval surface not implemented. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Accessible review screen; one-use binding; no model/page arming; real UIA acceptance.

**Implementation ownership / likely files:** Sightline.App. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-032 — Cross-surface browser↔Windows IPC [E/R; P1]

**User intent / requirement:** Unify tasks across native Windows and browser extension.

**Why this belongs in Sightline:** Product vision includes both application types without replacing the browser. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Not yet implemented. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Versioned least-privilege channel, origin binding, replay protection, disconnect recovery.

**Implementation ownership / likely files:** host IPC, extension bridge. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-033 — ROI OCR and vision fallback [U/E; P2]

**User intent / requirement:** Handle visually rendered controls only when semantic interfaces fail.

**Why this belongs in Sightline:** Some apps expose poor accessibility; visual AI must eventually cope. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser vision fallback exists; Windows ROI OCR pipeline not implemented/accepted. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Redacted ROI capture, bounded calls, no screenshots retained, uncertainty and user approval.

**Implementation ownership / likely files:** future vision adapter. **Priority:** P2. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-034 — Progress and understandable errors [U/E; P1]

**User intent / requirement:** Show task status, what happened, and why a task stopped.

**Why this belongs in Sightline:** Users should not need to interpret raw stack traces or unknown-effect codes. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser panel and diagnostics exist; full Windows task UX incomplete. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Visible timeline, retry-safe vs reconciliation-required messaging, exportable sanitized evidence.

**Implementation ownership / likely files:** presentation. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-035 — Pause/resume/cancel [U/E; P0]

**User intent / requirement:** Allow safe interruption without losing or duplicating work.

**Why this belongs in Sightline:** Long tasks and unexpected crashes require controllable recovery. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Browser session checkpoints exist; Windows production recovery UI missing. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Resume safe read-only tasks; uncertain mutation blocks until verified; cancel clears safe state.

**Implementation ownership / likely files:** task-checkpoint, host. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-036 — Vision Lens branding [U; P2]

**User intent / requirement:** Use Sightline name, original Vision Lens logo and See. Understand. Act. tagline.

**Why this belongs in Sightline:** Brand expresses perceive→reason→execute and creates recognizable app identity. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Brand selection documented; final asset fidelity/install integration must be audited. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Assets for titlebar/installer/icon/About/docs; high-res, no cropping, contrast, user-approved logo.

**Implementation ownership / likely files:** design/packaging. **Priority:** P2. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-037 — Windows package and installer [U/E; P2]

**User intent / requirement:** Deliver a usable Windows application, not just source code.

**Why this belongs in Sightline:** End users need installation, update, diagnostics and removal without a dev environment. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Not production accepted; packaging lifecycle pending. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Signed or explicitly unsigned documented installer, clean install/update/uninstall, rollback.

**Implementation ownership / likely files:** release engineering. **Priority:** P2. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-038 — Autonomous QA inside product [U; P1]

**User intent / requirement:** The application should run its own diagnostics and verification where safe.

**Why this belongs in Sightline:** The user requested tests to be automated rather than external manual rituals. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Some browser self-tests and Windows fixture tooling exist; unified in-app QA incomplete. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** User-triggered and safe automatic self-tests with strict resource budgets and exportable evidence.

**Implementation ownership / likely files:** QA UI, self-test. **Priority:** P1. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-039 — No development loops [U; P0]

**User intent / requirement:** Audit and reconcile before coding; stop repeated failures and move to other work.

**Why this belongs in Sightline:** Duplicated fixes and repeated retries waste time and risk repository divergence. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Standing development directive; handoff and issue tracking. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** No duplicate PRs; two-failure pivot; status checkpoints with commits/test proof.

**Implementation ownership / likely files:** engineering process. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

### SL-REQ-040 — Release evidence and honesty [U; P0]

**User intent / requirement:** Never claim working or bug-free without executed evidence.

**Why this belongs in Sightline:** Source-only confidence can conceal real Windows/browser incompatibility. This causal explanation should be preserved in future design reviews; removing the feature or weakening the constraint requires checking the original purpose, not merely whether a unit test still passes.

**Current state and evidence:** Feature-status vocabulary exists; latest real-device gates outstanding. This is a code/documentation snapshot, not a claim of complete real-device acceptance. Before touching it, inspect the actual call path, open PRs, and the latest tests.

**Measurable acceptance:** Exact SHA and environment recorded for each test; unresolved blockers visible.

**Implementation ownership / likely files:** release gate. **Priority:** P0. **Required change record:** original request, design alternative, memory/security impact, exact commit, executed test evidence, user-manual impact, unresolved risks.

## III.4 Traceability index (compact form)

| ID | Requirement | Priority | Evidence status |
|---|---|---|---|
| SL-REQ-001 | Goal-driven visual computer use | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-002 | Native Windows application | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-003 | Chrome and Edge companion | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-004 | Yahoo Mail real-world task | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-005 | Extremely low memory | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-006 | Clean modular code | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-007 | Deterministic before AI | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-008 | Structured before screenshots | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-009 | Small streamed local AI | P1 | PLANNED / NOT ACCEPTED |
| SL-REQ-010 | Local-first privacy | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-011 | Autonomous task execution | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-012 | Autonomous testing | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-013 | Robust bounded diagnostics | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-014 | Evolving end-user manual | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-015 | Verifiable engineering ledger | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-016 | Reuse open-source prior art | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-017 | Human-like interaction without impersonation | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-018 | Exact target identity | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-019 | High-impact confirmation | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-020 | No blind replay of uncertain effects | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-021 | Independent effect verification | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-022 | Sensitive-field protection | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-023 | Prompt-injection resistance | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-024 | Bounded browser observation | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-025 | Bounded browser actions | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-026 | Bounded task and model context | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-027 | Cancellation and cleanup | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-028 | Windows focus and human control | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-029 | Windows UIA circuit breaker | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-030 | Windows durable mutation journal | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-031 | Trusted Windows approval UI | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-032 | Cross-surface browser↔Windows IPC | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-033 | ROI OCR and vision fallback | P2 | PLANNED / NOT ACCEPTED |
| SL-REQ-034 | Progress and understandable errors | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-035 | Pause/resume/cancel | P0 | PLANNED / NOT ACCEPTED |
| SL-REQ-036 | Vision Lens branding | P2 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-037 | Windows package and installer | P2 | PLANNED / NOT ACCEPTED |
| SL-REQ-038 | Autonomous QA inside product | P1 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-039 | No development loops | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |
| SL-REQ-040 | Release evidence and honesty | P0 | SOURCE EXISTS / ACCEPTANCE INCOMPLETE |

## III.5 Requirements conflict resolution

When a new feature conflicts with a standing constraint, **do not quietly choose the easier implementation**. Use this resolution order: (1) user safety and privacy, (2) explicit user constraints and intended outcome, (3) correctness and independent effect verification, (4) resource budgets, (5) maintainability and compatibility, (6) performance/latency, (7) optional features and visual polish. This is an engineering prioritization proposal, not an assertion that the user explicitly ordered every category.

Examples: A broad screenshot history might improve debugging but violates privacy and memory constraints; prefer bounded redacted event evidence. A permanent local LLM might speed subsequent answers but violates idle RAM goals; prefer lazy load and measured unload. Auto-retrying an uncertain deletion might make a demo look smoother but violates no-duplicate-effect safety; stop and reconcile. A large borrowed browser framework might provide more features but break the Windows lightweight architecture; reuse only the needed algorithm or adapter after licensing review.

## III.6 What a new feature request must record

Every feature addition should have a short immutable requirement ID, exact or paraphrased user wording, date/source certainty, why it matters, current status, non-goals, user-visible workflow, trusted-data boundaries, resource limits, safety classification, test plan, evidence SHA, docs update, and rollback plan. Do not rely on a conversation transcript alone to carry this forward.


---
