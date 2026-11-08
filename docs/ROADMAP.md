# Sightline Engineering Roadmap

> **Mission:** A local-first visual browser agent that can see, understand, act, verify, recover, and complete useful browser workflows without becoming bloated, opaque, or resource-hungry.

## Engineering principles

1. **Deterministic code before AI.** DOM/accessibility APIs perform ordinary browser work; vision/LLM inference is used only when it adds value.
2. **Semantic targeting before coordinates.** Prefer roles, labels, text, state, and stable references.
3. **AI proposes; trusted code executes.** No arbitrary model-generated JavaScript, shell, or browser eval.
4. **Observe → Act → Verify.** Every meaningful action produces a fresh observation and an explicit success/failure result.
5. **Local-first and privacy-first.** Credentials/tokens/password fields never enter model context.
6. **Bound everything.** Context, logs, screenshots, retries, actions, task time, model calls, and memory all have ceilings.
7. **Measure performance.** A feature that works but creates unacceptable CPU/RAM growth fails acceptance.
8. **Evidence over claims.** Implemented, tested, real-browser verified, and production-ready are separate statuses.
9. **Small modules, explicit contracts.** UI, observer, planner, executor, verifier, safety, skills, AI, and diagnostics stay separable.
10. **No endless hardening loops.** See Anti-Loop Protocol below.

## Product modes

### Observe
See/read/explain only. No browser mutation.

### Assist
Sightline may navigate and manipulate ordinary controls. High-impact actions require confirmation.

### Autonomous
Sightline completes bounded multi-step tasks independently. Safety policy can still stop destructive/high-impact operations.

---

# Phase 0 — Repository + verified baseline

**Status:** IN PROGRESS

Deliverables:
- official Sightline branding
- canonical v0.1 source imported
- source manifest preserved
- README, roadmap, QA report, changelog, architecture, user manual, handoff
- main/develop branch discipline
- CI for syntax + automated tests

Exit criteria:
- canonical source present in GitHub
- tests reproducibly runnable
- docs distinguish verified/unverified behavior
- no legacy product-name confusion

---

# Phase 1 — Lightweight semantic page observer

Build the compact representation Sightline uses before vision.

Features:
- visible interactive-element discovery
- accessibility role/name
- labels/placeholders/text
- checkbox/radio/select state
- enabled/disabled/read-only state
- visibility/actionability
- bounding boxes
- frame/tab identity
- stable ephemeral refs such as @e12
- sensitive-field redaction
- snapshot hashing/difference
- bounded snapshot size
- iframe-aware architecture
- stale-ref invalidation

Performance:
- no continuous screenshots
- observer runs on demand/event boundaries
- aggressively discard superseded snapshots
- cap elements/text sent to AI

Exit criteria:
- deterministic fixtures produce stable snapshots
- sensitive fixtures are redacted
- large-page fixture stays inside defined memory/time budget
- stale refs are rejected

---

# Phase 2 — Typed browser action engine

Supported primitives:
- read
- click
- type
- clear
- select
- check/uncheck
- scroll
- navigate/back/forward
- press-key
- wait
- verify
- tab list/switch/open/close where permission allows

Executor features:
- strict schema validation
- target re-resolution before action
- actionability checks
- timeout/cancellation
- navigation detection
- stale-element handling
- structured result receipts
- no arbitrary JS execution

Exit criteria:
- fixture pages support complete action matrix
- malformed actions cannot execute
- ambiguous/stale targets fail safely
- post-action receipts describe what actually occurred

---

# Phase 3 — Verification + autonomous task engine

Loop:
**Goal → Plan → Observe → Act → Verify → Continue / Re-plan / Recover / Complete**

Features:
- explicit task goal
- compact plan
- completion criteria
- action budget
- time budget
- inference budget
- cancellation
- repeated-state detection
- repeated-action detection
- progress scoring
- stall detector
- bounded retry policy
- re-plan after changed state
- checkpoint/task state
- interruption recovery
- action/audit timeline

Exit criteria:
- multi-step fixture tasks complete
- impossible task terminates cleanly
- deliberately looping task is stopped
- interruption resumes from checkpoint without replaying completed destructive actions

---

# Phase 4 — Safety and prompt-injection defenses

Features:
- webpage text always treated as untrusted data
- instruction/data boundary enforcement
- password/token/auth/payment redaction
- domain/navigation policy
- sensitive-action classifier
- confirmation gate
- action target revalidation after confirmation
- secret-field restrictions
- download/upload restrictions
- audit entries for consequential actions
- human handoff for CAPTCHA/MFA/login challenges

Default confirmation categories:
- delete/bulk delete
- send/post/publish
- purchase/payment
- account/security changes
- permission grants
- irreversible or difficult-to-reverse actions

Exit criteria:
- adversarial webpage fixtures cannot override task policy
- destructive action cannot cross gate without required approval
- target is revalidated after approval

---

# Phase 5 — Local AI routing + resource governor

Features:
- Ollama local vision/text support
- capability discovery
- model health checks
- model timeout/cancellation
- deterministic operations bypass AI
- DOM-first / vision-fallback routing
- image downscaling/cropping
- compact context builder
- bounded conversation/task memory
- model-call telemetry
- inference failure fallback
- future adapter interface for additional local/OpenAI-compatible runtimes

Initial performance targets (to be benchmarked and adjusted using evidence):
- extension idle CPU: effectively near-zero
- no periodic inference while idle
- extension normal-working RAM target: <150 MB excluding model runtime
- no unbounded memory growth in long sessions
- only one foreground inference by default
- screenshots released after use unless explicitly retained for a task
- bounded logs and snapshots

Exit criteria:
- resource benchmark recorded
- long-session test shows no sustained growth attributable to retained task artifacts
- ordinary semantic actions work without vision calls

---

# Phase 6 — Yahoo Mail: first production workflow skill

Features:
- recognize Yahoo Mail state
- use existing signed-in browser session
- search inbox
- inspect/filter results
- select messages
- paginate/handle result sets
- preview bulk operation
- move messages to Trash after confirmation
- verify result
- recover from UI changes where generic semantics suffice
- never capture/store Yahoo password

Acceptance scenario:
“Find Amazon emails older than six months, show me the count and sample, then move them to Trash after I approve.”

Exit criteria:
- non-destructive search/read scenario passes first
- destructive fixture passes confirmation/verification
- real-account acceptance is documented separately and never inferred from fixture success

---

# Phase 7 — Skills framework

Features:
- reusable site/workflow skills
- versioned skill schema
- declarative selectors/semantic hints where possible
- preconditions
- actions
- verification rules
- recovery hints
- permission/domain scope
- skill diagnostics
- generic engine fallback

Candidate skills after Yahoo:
- Gmail
- Outlook Web
- common search engines
- GitHub
- web forms
- file-download workflows

Exit criteria:
- at least two materially different sites work without contaminating core with site-specific hacks

---

# Phase 8 — Multi-tab and cross-site tasks

Features:
- tab inventory
- task-owned tabs
- tab locks
- safe switching
- cross-site plan constraints
- per-domain permissions
- navigation history for recovery
- task context isolation

Exit criteria:
- cross-tab fixture completes without acting on wrong tab/domain

---

# Phase 9 — Memory, history, and reusable workflows

Features:
- local task history
- resumable checkpoints
- user-approved reusable workflows
- compact structured memory instead of giant transcripts
- retention controls
- clear/delete task data
- bounded storage
- searchable diagnostics

No hidden unlimited memory.

---

# Phase 10 — Diagnostics + observability

Features:
- structured local logs
- action receipts
- model-call timing
- observer timing
- memory/CPU sampling
- task timeline
- failure classification
- sanitized diagnostic export
- no passwords/tokens in logs
- self-test page

Goal: when Sightline fails, we can determine **where and why** instead of guessing.

---

# Phase 11 — Reliability/fuzz/fault-injection program

Continuously expand—not repeat—the suite:
- malformed model responses
- invalid actions
- huge DOMs
- rapidly mutating DOMs
- stale refs
- duplicate labels
- hidden/disabled controls
- iframes
- SPA navigation
- navigation races
- slow pages
- network interruption
- Ollama unavailable/crash/timeout
- extension reload
- task interruption
- corrupted checkpoint
- repeated-state loops
- prompt injection
- Unicode/RTL/long text
- memory soak
- long-running sessions

Every discovered defect requires:
1. root-cause classification
2. permanent correction
3. focused regression test
4. affected-suite rerun
5. full-suite run at release gates

---

# Phase 12 — Windows companion

After browser automation is dependable:
- Windows desktop companion
- screen understanding outside browser
- application/window targeting
- controlled keyboard/mouse actions
- local IPC with browser extension
- strict permission boundary
- packaged installer
- crash recovery

Browser pages continue using semantic browser automation rather than coordinate clicking whenever possible.

---

# Phase 13 — Production UX

Features:
- polished Sightline side panel
- task composer
- Observe / Assist / Autonomous selector
- visible plan
- live progress
- action history
- pause/cancel
- confirmations
- model/runtime settings
- permission manager
- diagnostics
- onboarding
- beginner-friendly manual
- accessibility
- branding/icons/About

---

# Phase 14 — Release candidate / 1.0

Required gates:
- automated suite green
- browser fixture acceptance green
- real Chrome acceptance
- real Edge acceptance
- live local-model acceptance
- Yahoo real-world acceptance
- destructive-action gate acceptance
- interruption/recovery acceptance
- performance/soak acceptance
- permissions/security review
- documentation audit
- clean install/update/uninstall verification

No 1.0 claim before these gates have evidence.

---

# Anti-Loop Protocol

This is mandatory for Sightline development.

## One issue = one measurable outcome

Every engineering issue must contain:
- problem/deliverable
- acceptance criteria
- test/evidence required
- dependencies
- out-of-scope items

## Maximum retry rule

Do not repeat the same failed implementation/test cycle indefinitely.

After **2 failed correction attempts with the same root-cause class**:
1. stop repeating the approach
2. record the blocker
3. reduce to the smallest reproduction
4. change strategy/design or isolate the blocked portion
5. continue independent roadmap work when safe

## No test-loop theater

A test rerun with no source/config/environment change is not progress unless it is specifically checking nondeterminism.

Each development cycle must produce at least one of:
- source change
- new test covering a new path
- documented root cause
- measured benchmark
- verified acceptance evidence
- explicit external/environment blocker
- architecture decision that removes a blocker

## Phase exit discipline

Once phase acceptance criteria pass, move forward. Hardening continues through regression testing but does not keep the project trapped in the completed phase.

## Blocker classes

Every blocker must be labeled:
- CODE
- TEST
- ENVIRONMENT
- EXTERNAL SERVICE
- PERMISSION
- HARDWARE
- DESIGN DECISION

Environment/external blockers must not be falsely reported as product defects or passes.

## Progress ledger

Maintain:
- current phase
- last verified commit
- tests executed
- pass/fail counts
- new defects
- fixed defects
- blockers
- performance measurements
- next three concrete tasks

## Branch discipline

- `main`: verified integration baseline
- `develop`: active integrated development
- focused feature/fix branches when changes are risky or substantial
- no long-lived abandoned experimental branches
- merge only with evidence appropriate to the phase

---

# Documentation contract

Keep these current:
- README
- ROADMAP
- ARCHITECTURE
- FEATURE_STATUS
- USER_MANUAL
- QA_REPORT
- CHANGELOG
- HANDOFF
- PERFORMANCE
- SECURITY

Documentation must use explicit states:
- Planned
- In progress
- Implemented
- Automated-test verified
- Real-browser verified
- Production accepted

---

# Immediate execution order

1. Import and preserve canonical v0.1 source.
2. Complete Sightline branding cleanup.
3. Add CI and baseline documentation.
4. Implement semantic page observer.
5. Implement typed action schema/executor.
6. Add post-action verification.
7. Implement bounded autonomous loop and stall detector.
8. Add safety/confirmation gate.
9. Benchmark resource usage.
10. Build Yahoo Mail skill.
11. Expand adversarial/fuzz/fault-injection tests.
12. Perform real Chrome/Edge/Ollama acceptance.
