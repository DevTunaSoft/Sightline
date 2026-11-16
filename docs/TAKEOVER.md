# Sightline: The Takeover Book

*Everything a new engineer or coding agent needs to understand, verify, and continue the Sightline project, with no prior knowledge.*

Prepared 2026-11-16 from the state of `develop` at commit `5725533`.

> **Status update, 2026-11-16 (later the same day).** Since this book was written, on `claude/serene-mayer-ckp8ee`:
> - Takeover Chapter 43 items 1–4, 7 and 13 are done. Item 10 is partly done (S-25, S-26, S-27).
> - PR #8's merge result is clean (G-09 corrected). Its last CI failure is recorded (G-12). Its decision is still open (ADR-008).
> - X-13 (clicks on unnamed controls) is fixed in code. The process-inspection handle test runs in an isolated collection and has passed in five CI runs (X-15). The logged isolated deltas are 0 handles and 0 threads.
> - Items 5, 6, 9 and 11, and the Chrome, desktop and Ollama checks, remain BLOCKED in this environment.
>
> The sections below describe the state at `5725533` and are not updated. The current record is `CLAUDE.md` section 9 and `docs/DEVELOPMENT_LEDGER.md`.

---

## How to read this book

Read Parts I and II in order. They tell you what the project is and why it is shaped the way it is. After that you can read any other part on its own, but Part IX (Known problems) and Part X (What to do next) assume you have read the safety chapters.

**Evidence labels.** Every important claim carries one of these labels, following the vocabulary in `CLAUDE.md` section 5:

- **VERIFIED.** Checked against the repo, git, GitHub, or CI on the date of this book. The source is named.
- **PASS / FAIL.** A command or test that was run, with its result.
- **UNVERIFIED.** Stated by documentation, a secondary source, or an assumption. No primary check exists. Do not present it as fact.
- **BLOCKED.** Cannot be checked in the sandbox used to prepare this book. The reason is given.
- **NOT RUN.** Could have been run and was not.
- **STALE.** Was true at an earlier commit and may no longer be true.

**Authority.** This book explains the project. The repo's `CLAUDE.md` is the engineering dossier and sets the working rules. If this book and `CLAUDE.md` disagree, `CLAUDE.md` wins and this book needs fixing. Chapter 41 lists the documentation errors found in the project's files, and Chapter 39 and Part IX list the open safety problems.

**Where the sources are.** Part XII lists the full set of project documents and says what each one is for.

---

# PART I. ORIENTATION

## Chapter 1. What Sightline is

Sightline is a local-first assistant that looks at a web page or a Windows window, understands the controls on it, and carries out actions for the person using it. Its tagline in the project docs is *See. Understand. Act.* (VERIFIED: `README.md`, V3 handoff header.)

Three words in that description matter:

- **Local-first.** Ordinary operation should not depend on a cloud service. The page content, the desktop information, and the AI model all stay on the user's machine. The project's own security document is careful to say that local-first is not the same as secure: the local model endpoint, the extension's permissions, and the logs still need review (VERIFIED: V3 section 2.2).
- **Understands.** The project reads structure, not just pixels. On a web page that means the document's controls and text. On Windows it means the UI Automation tree. Screenshots are a fallback, used only when structure is not enough (VERIFIED: `docs/ARCHITECTURE.md`, "Design principle").
- **Acts.** It can click, type, select, and navigate. Because actions can cause real harm, every consequential action goes through a confirmation and a verification step (Part IV).

## Chapter 2. Two halves, one design

Sightline has two surfaces that share a design but not yet a runtime.

**The browser half** is a Chrome and Edge extension built on Manifest V3, the current extension format. Its code is in `extension/`. This is the part that works today, and it is the part that has the most tests. It is an alpha (VERIFIED: `README.md`, "Current release: 0.2.0-alpha").

**The Windows half** is a .NET 8 program that uses Windows UI Automation, through the FlaUI library, to read and act on native desktop applications. Its code is in `windows/`. It is experimental. It compiles and passes its tests in hosted CI, but has never been run against a real interactive desktop (VERIFIED: `windows/README.md` status line; CLAUDE.md P-07; C-07).

The two halves are meant to meet in the future. The architecture document describes Sightline as "a lightweight standalone Windows application with a Chrome/Edge companion extension" (VERIFIED: `docs/ARCHITECTURE.md`). The README, on the other hand, describes the product as "a local-first visual browser agent for Chrome and Edge" (VERIFIED: `README.md`). Both are true at different stages. The browser is what works now. The Windows application is the target that the browser will eventually connect into. A new engineer should expect this tension and not try to resolve it by picking one description.

## Chapter 3. The people and the history behind it

The handoff documents were written by earlier engineering sessions and by the owner. Who wrote which commit is not fully recorded in this book (UNVERIFIED). The V3 handoff records that the owner gave the requirements over a long series of conversations, and that the intent is for the software to work in practice, not to be a research demonstration: "The user wants working software that sees, understands, and acts on Windows and webpages; the product is not a research paper or a screenshot-only demo" (VERIFIED: V3 handoff, "Five rules").

The owner's own words, as they appear in the handoff's conversation history, include requests to make the browser side do real tasks such as opening a page, searching, reading results, collecting data, and exporting a spreadsheet, and to make it work the way Claude in Chrome works, but locally (VERIFIED: the handoff's Part II holds the full conversation-to-feature history. Chapter 37 of this book summarizes the takeover conversation).

Two requests are explicitly not built and are not going to be built as framed. The owner asked for a way to make the agent look like a person typing, so that websites would not detect it as automation. The project declined to build any mechanism that disguises automation, rotates identities, spoofs fingerprints, or bypasses CAPTCHAs or bot checks. Visible, disclosed control on sites that allow it is the honest alternative, and the debugger path is built in that spirit (VERIFIED: CLAUDE.md S-23, which records this as an operator rule).

---

# PART II. WHY THE PROJECT IS BUILT THIS WAY

## Chapter 4. The problem

Conventional automation breaks in predictable ways. Macros and coordinate scripts depend on exact screen positions, window sizes, themes, and timing. They misclick when a window moves or a page changes. They have no understanding of what is on the screen and no way to prove that an operation worked (VERIFIED: V3 section 2.1).

Browser-only tools cannot operate native Windows applications. Desktop-only screenshot tools throw away the structured information the page already exposes, and they call a vision model for every step, which is slow and expensive. Pure language-model agents have their own failure modes: they can overinterpret page text, invent actions, retry a destructive operation after an ambiguous failure, and consume a lot of memory and CPU (VERIFIED: V3 section 2.1).

Sightline's answer is to combine the strengths of each approach while avoiding their unnecessary overhead. It uses browser DOM and accessibility data for precise semantic controls, Windows UI Automation for native controls, deterministic adapters with typed inputs and verifiable outputs, a local AI model only for interpretation and planning, and bounded diagnostics with recovery (VERIFIED: V3 section 2.1).

## Chapter 5. Principle one: structure before pixels, code before AI

The project's most repeated sentence is: *Deterministic software before AI. DOM before vision.* (VERIFIED: `README.md`, "Resource strategy.")

The reasoning is practical. A DOM node or a UI Automation element gives an exact role, a name, a state, and a stable reference. A screenshot gives a picture that has to be interpreted. Reading structure is cheaper, more reliable, and easier to verify. So the pipeline reads structure first. Only when the structure is insufficient does it ask for a screenshot, and then only up to a small fixed number of times per task (VERIFIED: `README.md`; CLAUDE.md section 7.1, which records at most 2 vision fallbacks per task, `MAX_VISION_FALLBACKS_PER_TASK`).

The Windows action hierarchy follows the same logic. It prefers, in order: filesystem, process, and native API calls; then UI Automation patterns; then an application-specific adapter; then OCR or vision on a small region of the screen; and only last, verified physical input. The architecture document says plainly that "coordinate-first automation is not an architectural default" (VERIFIED: `docs/ARCHITECTURE.md`, "Windows action hierarchy").

## Chapter 6. Principle two: local-first

Local-first means the default path uses a model running on the user's machine. In the browser half, that model is reached at a loopback address, `127.0.0.1:11434`, through Ollama (VERIFIED: CLAUDE.md P-03, `extension/vision-core.js:1` and `tools/ollama-acceptance.mjs:1`).

The project enforces the local-only rule in code, not only in documentation. The release audit forbids URL literals in the extension source, with one exception: the Office XML namespace prefix, `http://schemas.openxmlformats.org/`, which is a fixed identifier and not a network address (VERIFIED: CLAUDE.md S-19, `tools/release-audit.mjs:79`). The acceptance script refuses to test cloud-tagged Ollama models (VERIFIED: CLAUDE.md S-20, `tools/ollama-acceptance.mjs:2` and lines 53 and 75).

The one planned outbound path is a search provider for the research feature. None is connected. The project's rule is that any outbound model or search call needs a logged decision in `docs/DECISIONS.md` first (VERIFIED: CLAUDE.md S-24; no outbound call exists in `extension/`).

The project is also honest that local-first does not automatically mean secure. Local endpoints, extension permissions, and logs can all leak data if they are careless (VERIFIED: V3 section 2.2).

## Chapter 7. Principle three: low memory is a requirement

A desktop helper should not reserve gigabytes of memory while idle. The V3 handoff says that the core should remain useful without any AI model loaded, that expensive modules should load only when needed, and that anything active must be bounded. It calls this "a non-negotiable architectural constraint, not a late optimization" (VERIFIED: V3 section 2.3).

In practice this means almost every collection in the code has a fixed ceiling. Chapter 16 lists them. The principle is also why the project has no Electron, no permanently embedded model, and no background polling loop (VERIFIED: `docs/ARCHITECTURE.md`, "Resource architecture"; CLAUDE.md P-09, which is a stated design principle not yet checked against code).

Important caveat: the project has bounded its scans and buffers, but it has **not measured** real memory use in an installed browser or on Windows. The handoff's own text says so. "No measured production RAM ceiling" is the honest status (VERIFIED: V3 section 15.8; HANDOFF.md, the entries dated 2026-11-11). Any claim of a memory improvement needs a before-and-after measurement that has not been done.

## Chapter 8. Principle four: a click is not proof

This is the principle that drives most of the safety design, and it is the one most often forgotten. A button click, a UI Automation "Invoke" call, a DOM mutation, or a success message on the page is not automatic proof that a server-side change happened. Concrete examples from the handoff: a message that disappears from a list might be a filter change, not a deletion. A desktop application may report success before it commits the change. A cancelled operation might already have executed (VERIFIED: V3 section 2.4).

Because of this, the project distinguishes six states for any consequential action:

1. **Attempted.** The action was proposed.
2. **Dispatched.** The input was sent.
3. **Observed structural change.** The page or window changed in some way.
4. **Verified application effect.** An independent check confirmed the intended result.
5. **Unknown effect.** The action might have happened and cannot be confirmed.
6. **Failed before dispatch.** Nothing was sent, so the action is safe to report as a failure.

Only state 4 counts as "done". State 5 must never be retried automatically (VERIFIED: V3 section 2.4; SECURITY.md, "Implemented controls").

**A gap to know about.** `docs/SECURITY.md` says confirmed consequential actions "must produce a semantic effect or return `NO_VERIFIED_EFFECT`". The debugger click path does not do this: once input is dispatched it reports `ok: true` with `changed: null`, and it does not look at the page afterward. This is open issue X-01 (VERIFIED: `extension/browser-task-runner.js`, `debuggerClickApproved`; CLAUDE.md X-01). The two documents disagree, and the code follows neither the security document's rule nor its own dispatch-only receipt. Fixing this is item 2 in Part X.

## Chapter 9. Principle five: fail closed

When the project cannot see the whole page, or cannot identify the target of an action, it must not act. The security document lists this as a control: confirmed consequential actions require a live re-observation before execution, and an incomplete view blocks them (VERIFIED: SECURITY.md; V3 section 3, rule 7).

The effect is that the project sometimes stops when a more permissive tool would guess. That is deliberate. The V3 handoff states the rule as its section 3, rule 7: "Fail closed on incomplete observations. Unknown identity or incomplete scope must not authorize consequential actions." (VERIFIED: V3 section 3.)

## Chapter 10. Principle six: unknown effect means reconcile, never retry

If an action might have happened and cannot be confirmed, the project must not send it again. The handoff calls this the unknown-effect protocol, and makes it a numbered rule: "Never blindly replay an uncertain mutation. An unknown effect requires independent reconciliation." (VERIFIED: V3 section 3, rule 9; section 10.5.)

The reason is that retrying a send, a delete, or a payment after an uncertain result is the failure this whole design exists to prevent. The project would rather stop and ask a person than guess.

The code follows this in several places. Cancelling during a mutating action returns `UNKNOWN_EFFECT`, because the page may already have changed (VERIFIED: CLAUDE.md S-08). An exception thrown during a mutating action also returns `UNKNOWN_EFFECT`, and never echoes the provider's error text (VERIFIED: CLAUDE.md S-09). The Windows layer's journal refuses a second mutation while one is recorded as pending (VERIFIED: CLAUDE.md W-02).

## Chapter 11. The non-negotiable engineering contract

The V3 handoff lists fifteen rules that every contributor must follow. They are the working contract of the project, so they are reproduced here in summary form (VERIFIED: V3 section 3):

1. Do not duplicate work. Inspect branches, PRs, issues, commits, workflows, documents, and code first.
2. Do not invent test results. Distinguish source review, isolated harness, Node test, .NET test, CI, installed browser, real model, and interactive Windows acceptance.
3. Keep memory bounded. No unbounded queues, lists, text aggregation, logs, caches, retries, or permanent workers.
4. Use deterministic methods first.
5. Treat model output and page or screen content as untrusted.
6. Protect secrets. Passwords, one-time codes, payment codes, tokens, cookies, and private content must not reach prompts, receipts, logs, or checkpoints.
7. Fail closed on incomplete observations.
8. Require trusted confirmation for consequential actions. The approval must bind to the exact task, action, target, state, and time. A generic "yes" is not enough.
9. Never blindly replay an uncertain mutation.
10. Do not add unnecessary dependencies. In particular, do not replace the lightweight Windows design with Electron or Docker.
11. Preserve compatibility with the Chrome and Edge companion and the existing user workflows.
12. Keep one authoritative handoff and one end-user manual.
13. Stop failed loops. After two identical failures, find the root cause and change approach.
14. Do not circumvent repository protections or bypass tests.
15. Do not claim ongoing work after a session ends. Progress must be backed by committed changes or attached artifacts.

---

# PART III. ARCHITECTURE

## Chapter 12. The browser runtime, module by module

The browser half is a set of JavaScript modules in `extension/`. The dossier lists them in groups (VERIFIED: CLAUDE.md section 7.1). There are 32 top-level `.js` files plus one skill module, `extension/skills/yahoo-mail.js`. Here is what each group does.

**Extension shell.** `background.js` handles the extension's lifecycle. `panel.html`, `panel.js`, and `agent-panel.js` make up the side panel the user sees. `manifest.json` declares the extension's permissions (see Chapter 13).

**Page runtime.** `page-agent.js` runs inside the web page. It answers four message types: `SIGHTLINE_PING`, `SIGHTLINE_OBSERVE`, `SIGHTLINE_EXECUTE`, and `SIGHTLINE_LOCATE`. It holds the single pending confirmation for the page. `page-agent-bootstrap.js` sets it up. This is the component that enforces the confirmation rules described in Part IV.

**Observation.** `page-observer.js`, `page-observer-core.js`, and `ref-registry.js` build the bounded semantic snapshot: a list of controls with stable refs, plus some page text, plus a sensitive-field check. The core is pure logic that can be tested without a browser. The observer does the DOM walking. The registry keeps refs stable within a snapshot.

**Action protocol.** `action-protocol.js` validates a proposed action against the allowed action types. `action-executor-core.js` runs a validated action through an adapter and maps aborts and failures to error codes. `dom-action-adapter.js` performs the DOM operations and refuses any sensitive target. This is where the rule that sensitive fields are never clicked, typed into, or read applies (VERIFIED: CLAUDE.md S-11).

**Bridge.** `browser-bridge.js` talks to the tabs: observing, executing, finding the task tab, and capturing screenshots.

**Planning.** `planner-client.js` and `planner-core.js` build a bounded request for the local model and call it. The planner adds system guardrail messages around the user's JSON, so that page content is clearly marked as untrusted data (VERIFIED: CLAUDE.md section 14, the planner payload note; SECURITY.md, "Prompt injection").

**Vision.** `client.js` and `vision-core.js` handle screenshot analysis. This is a fallback only. It is capped at two uses per task and one per semantic state (VERIFIED: `README.md`, resource strategy).

**Task loop.** `task-loop-core.js` and `browser-task-runner.js` drive a task: observe, plan, confirm, execute, verify, checkpoint. `TaskProgressGuard` limits repeated actions and repeated states, so a stuck planner cannot run forever (VERIFIED: CLAUDE.md section 7.1).

**Safety.** `safety-gate.js` classifies each action's risk. `skill-blockers.js` provides site-specific blockers. Chapter 13 covers the classifications.

**Skills.** `skill-registry.js` lets a site-specific rule set plug in. `skills/yahoo-mail.js` is the only one. It checks the search route, the search control, and the visible count before allowing a bulk action, and it checks the effect afterward (VERIFIED: CLAUDE.md S-04, S-05, S-06).

**Checkpoints.** `task-checkpoint.js` saves and restores progress so a task can resume after an interruption. The checkpoint is stored in `chrome.storage.session`, is bounded, and strips typed text, selected values, full navigation URLs, and screenshots (VERIFIED: SECURITY.md, "Data retention" and "Implemented controls").

**Diagnostics.** `diagnostics-core.js` and `performance-core.js` keep bounded ledgers and timing. The in-memory diagnostic log keeps only a small sanitized tail of recent events, and it is kept in memory until someone explicitly exports it (VERIFIED: SECURITY.md, "Data retention"; `README.md`, "Hard budgets").

**Acceptance.** `browser-self-test.js`, `local-ai-self-test.js`, and `yahoo-readiness.js` are self-tests that check the installed plumbing, the local model, and the Yahoo page's readiness.

**Opt-in extras.** `export-core.js` extracts IP addresses and writes a minimal `.xlsx` workbook with a hand-written ZIP writer. `collect-core.js` collects data across pages. `research-core.js` builds redacted search queries and ranks sources. `cdp-input.js` sends debugger input. `click-point-core.js` validates where a debugger click would land. These five are the least-trusted part of the code because they are newest, and Chapter 20 says what to check first.

## Chapter 13. Permissions, the manifest, and the release audit

The extension asks for five permissions and no more: `sidePanel`, `activeTab`, `debugger`, `scripting`, and `storage` (VERIFIED: CLAUDE.md S-18, `tools/release-audit.mjs:32`, and `extension/manifest.json`, re-read in the recheck).

The manifest also declares two things the earlier version of this book omitted (VERIFIED: `extension/manifest.json`, re-read in the recheck):

- **Host permissions for the local model only.** `http://127.0.0.1:11434/*` and `http://localhost:11434/*`. These let the extension reach Ollama on loopback. They are not broad host access.
- **Web-accessible resources matched to every site.** The rule lists `page-agent.js`, `page-observer.js`, `page-observer-core.js`, `ref-registry.js`, `dom-action-adapter.js`, `action-protocol.js`, `action-executor-core.js`, and `safety-gate.js`, and it matches `http://*/*` and `https://*/*`. Those are the page-side scripts, so every website can request them. That lets a site detect that the extension is installed and read those files. The security document does not mention this rule, and I have not tested its impact. See Chapter 39 and Part X.

The manifest's content security policy for extension pages is `script-src 'self'; object-src 'self'`. That blocks inline scripts and remote scripts in the extension's own pages (VERIFIED: `extension/manifest.json`). The security document still lists a CSP review as required (VERIFIED: SECURITY.md, "Still required").

Two of these deserve explanation. `debugger` lets the extension attach to a tab through Chrome's debugging interface. It is in the allowlist because the opt-in debugger click path needs it. It is not on by default. `activeTab` gives access only to the tab the user is looking at. The project deliberately does not request broad host access. The security document lists "no broad `<all_urls>` host permission" as an implemented control (VERIFIED: SECURITY.md).

The release audit is a script that runs in `npm run check`. It checks three things: the version numbers are aligned, the permission list matches the allowlist exactly, and the source contains no forbidden URL literals (VERIFIED: CLAUDE.md section 4.1, `node tools/release-audit.mjs`).

## Chapter 14. The Windows runtime

The Windows half is a .NET 8 solution in `windows/`. Its projects are these (VERIFIED: CLAUDE.md section 7.3, file checks):

- **`Sightline.Core`** holds the contracts (actions and observations) and the core logic. It defines the error code `UnknownEffect`. It must not depend on FlaUI or on any browser or model code (VERIFIED: `docs/ARCHITECTURE.md`, dependency rules).
- **`Sightline.Windows`** holds the FlaUI UI Automation integration. Its main class is `FlaUiActionExecutor`.
- **`Sightline.App`** is an executable with no UI framework configured. It is a console program for now (VERIFIED: CLAUDE.md P-05; `Sightline.App.csproj` has `OutputType Exe` and no `UseWPF`).
- **`Sightline.Core.Tests`**, **`Sightline.Windows.Tests`**, and **`Sightline.Windows.Acceptance`** are the test projects.
- **`Sightline.Windows.TestTarget`** is a WPF application that the acceptance tests drive. It is the only WPF project (VERIFIED: CLAUDE.md P-06).

The executor's safety order is the key to the Windows half. It checks approval first. Then it checks the journal has no pending entry. Then it writes a journal entry before the mutation. If the journal write fails, it returns `UnknownEffect` and does not act (VERIFIED: CLAUDE.md W-01, W-02, W-03; line references in `FlaUiActionExecutor.cs`).

Three other facts matter. Password fields are treated as passwords unless their status can be read, so an unreadable field fails closed (VERIFIED: CLAUDE.md W-04, S-12). A UI Automation "Invoke" call is not treated as proof of an effect (VERIFIED: CLAUDE.md W-05). And observation is bounded by node count, depth, elapsed time, and cancellation. The provisional budget is 750 nodes, depth 30, and 600 milliseconds (VERIFIED: `docs/ARCHITECTURE.md`, "Windows observation").

## Chapter 15. How one action flows through the browser half

This is the sequence the browser follows for a single action. It is the most important thing to understand before changing the code (VERIFIED: CLAUDE.md section 7.2).

1. The page agent observes the page and returns a snapshot with a `snapshotId`.
2. The planner proposes one action, which must refer to a ref in that snapshot.
3. The page agent validates the action, re-observes the live page, checks that the ref and snapshot still match, and runs the risk gate.
4. If the gate requires confirmation, the page agent returns `CONFIRMATION_REQUIRED` with the target, the risk, and a `confirmationKey`. The runner asks the person. The check that the key matches the action is held inside the page agent, and is not returned to the runner.
5. If the person confirms and the debugger path is on, the click goes through `debuggerClickApproved`. Two locate calls must agree on the same point and pass `click-point-core`. Then `cdp-input` clicks. Otherwise the page agent runs the confirmed action.
6. After execution, the runner runs the skill's independent effect check, if one applies.
7. The checkpoint and the timeline update. The loop stops on done, a limit, cancellation, or an unrecoverable error.

The weak point is step 5. The debugger path bypasses the page agent's execution, and the runner never passes the confirmation key back to the page agent, so the pending confirmation is not consumed (VERIFIED: `extension/browser-task-runner.js`, lines 180–243; CLAUDE.md section 7.2, "Verification note"). This is the gap described in Chapter 21.

## Chapter 16. The bounds: every number that limits the system

The project's limits are part of its design, and a new engineer needs them to reason about behavior. The numbers below come from `README.md`, `docs/SECURITY.md`, the V3 handoff, and CLAUDE.md. Where a number comes from the code, the file is named.

**Browser observation and planning, from `README.md`:**

| Limit | Value |
|---|---|
| Semantic controls per snapshot | 300 |
| Semantic snapshot size | 48 KB |
| Visible page text | 8 KB |
| Action history kept in a checkpoint | last 40 |
| Diagnostic events kept | last 200 |
| Default actions per browser task | 40 |
| Default task time window | 120 seconds |
| Planner request timeout | 90 seconds |
| Malformed-planner repair retries | 1 |
| Vision fallbacks per task | at most 2 |
| Vision fallbacks per semantic state | at most 1 |

**Observation internals, from the observer code and its tests (VERIFIED: HANDOFF.md ledger entries dated 2026-11-11; CLAUDE.md section 7):**

| Limit | Value |
|---|---|
| Frames discovered | 20 |
| Frame nesting depth | 3 |
| Frame nodes visited | 6,000 |
| Interactive nodes visited | 12,000 |
| Text nodes visited | 6,000 |
| Shared source-scan budget per observation | 65,536 UTF-16 units |
| Scan budget per text value | 32,768 UTF-16 units |
| Accessible-name output per label | 240 characters |
| Linked label IDs | more than 16 IDs, or an `aria-labelledby` attribute over 2,048 characters, makes the field count as sensitive (fails closed; does not partly examine it) |
| Indexed live labels examined | 16 |
| Source text inspected per label aggregation | 4,096 characters |
| Select options inspected | 2,048 |
| Text input length for debugger typing | 2,000 characters |

**Windows observation, from `docs/ARCHITECTURE.md`:** 750 nodes, depth 30, 600 milliseconds. The document calls these provisional and subject to measured tuning.

**Confirmation:** a confirmation is valid for five minutes (`MAX_CONFIRMATION_AGE_MS = 5 * 60 * 1000` in `extension/page-agent.js:19`) (VERIFIED: CLAUDE.md section 2.2).

**Debugger clicks:** the two locates must agree within 2 pixels (`CLICK_POINT_LIMITS.tolerancePx`) (VERIFIED: `extension/click-point-core.js`).

One caveat applies to every number here. These limits are safeguards against runaway resource use. They are not measured production memory targets. The project has not yet run a soak test that measures real heap, CPU, or handle growth (VERIFIED: V3 section 15.8).

---

# PART IV. THE SAFETY MODEL

## Chapter 17. Trust order and the threat model

The architecture document sets a trust order for information. From most trusted to least: the user's command; trusted local policy; operating-system and application metadata; webpage content; OCR; and model inference. Screen, web, and model content are untrusted data, and they cannot override the user or the safety policy (VERIFIED: `docs/ARCHITECTURE.md`, "Trust").

The security document lists the implemented controls. They are the most important facts in the project, so they are reproduced here (VERIFIED: `docs/SECURITY.md`, "Implemented controls"):

- No arbitrary model-generated JavaScript or shell execution.
- No broad host permission.
- The Ollama connection is restricted to loopback.
- Password, one-time-code, payment-security, and token-like fields are marked sensitive.
- Sensitive fields cannot be read, typed into, or cleared autonomously.
- Textbox values are not used as semantic labels.
- Diagnostic reports strip typed action payloads.
- Checkpoints strip typed text, selected values, full navigation URLs, and screenshots.
- High-impact actions require confirmation.
- Irreversible delete controls need explicit permanent-delete intent plus confirmation.
- Confirmation keys bind the task goal, the snapshot, the action, and the target.
- The page is re-observed immediately before execution, including after a confirmation delay.
- Confirmed consequential actions must produce a semantic effect or return `NO_VERIFIED_EFFECT`. (See Chapter 8 for the gap.)
- Tasks are pinned to the starting tab.
- Tasks are pinned to approved origins. A spontaneous change of origin stops execution.
- Cross-origin navigation and link activation require approval.
- CAPTCHA, MFA, login, and account-recovery states hand control to the person.
- Cross-origin iframe content is treated as opaque.
- Same-origin iframe controls use the target document's own event realm.

The document also lists what is still required before a production-trust claim: real-browser adversarial prompt-injection testing, a browser permission review for a release candidate, a dependency and license audit, a Content Security Policy review, real Yahoo destructive-action testing with disposable data, and an external security review (VERIFIED: SECURITY.md, "Still required"). None of these has been done.

## Chapter 18. The risk classes, and what the code actually blocks

The browser's safety gate classifies each action. The classifications below were probed against the code at `fb8c9ec` on 2026-11-12 and are recorded in CLAUDE.md S-02 (VERIFIED at `fb8c9ec`):

| Label on the control | Risk level | Behavior |
|---|---|---|
| Archive all | high | requires confirmation |
| Reject all | high | requires confirmation |
| Delete permanently | high | requires confirmation |
| Move to Trash | high | requires confirmation |
| Mark all as read | normal | proceeds |
| Empty Trash | blocked | refused without a prompt (`ACTION_BLOCKED`) |

Two behaviors matter for a new engineer. A blocked action is refused outright and is never offered to the person as an option (S-03). And the Yahoo Mail skill refuses a bulk Trash action unless it can see the search route, the search control, and a parseable count, because the count is what proves the scope is bounded (S-04). The skill also refuses to accept a free-text success message as proof that items were deleted (S-06).

## Chapter 19. The confirmation lifecycle

A confirmation is the mechanism that makes a risky action safe. The rules, from `CLAUDE.md` S-01 and the code it cites, are these:

1. The page agent decides that an action needs confirmation, and issues a `confirmationKey` bound to the action, the target, the snapshot, and the task.
2. The key is valid for five minutes.
3. The key can be used once. The page agent checks that the presented key matches the stored binding. A second use must fail.
4. The pending confirmation is cleared when any of these happen (VERIFIED: `extension/page-agent.js`, the lines that set `pendingConfirmation = null`, read in the recheck): the snapshot id changes; a scan fails; an unrelated action that needs no confirmation runs; or a new confirmation is issued. A wrong key does not clear the legitimate pending confirmation, so an attacker's guess cannot cancel the person's review.
5. When a confirmed action runs on the normal path, the key is consumed immediately before the side effect (VERIFIED: `extension/page-agent.js`, "Consume only an authentic token").
5. A cancelled confirmation returns `ABORTED`, which maps to `TASK_CANCELLED`, because nothing was sent (S-07).

Step 3 is the rule that the debugger path does not currently enforce, as explained in Chapter 21.

## Chapter 20. The five newest modules, and why they need the most care

Five modules are the least tested in real conditions and the most dangerous if misused. They are the debugger input module, the click-point validator, the collector, the export writer, and the research module.

**`cdp-input.js`** sends input through Chrome's debugging interface. It refuses any tab that was not approved as the task tab (`TAB_NOT_APPROVED`), validates coordinates (`BAD_COORDINATES`), and always detaches in a `finally` block (S-14). Its comment says Chrome shows a banner while it is attached, but that claim is unverified (S-17). It has no caller for its text-typing function, `insertText`, which has no focus check.

**`click-point-core.js`** decides whether a located element can be clicked. It refuses a failed locate, a stale snapshot, a sensitive target, a target inside a frame, a hidden element, a bad position, and an offscreen element. It never guesses a point (VERIFIED: `extension/click-point-core.js`, read this session).

**`collect-core.js`** gathers data across pages. Read in the recheck: it allows at most 500 pages (`COLLECT_LIMITS.maxPages`) and stops collecting when rows reach the export row limit. It keeps only the origin and path of each source, not the query string or fragment, because those can carry tokens. It caps that text at 300 characters (VERIFIED: `extension/collect-core.js`).

**`export-core.js`** extracts IP addresses and writes a `.xlsx` workbook. Read in the recheck: its ZIP container uses the STORE method, meaning no compression, with a CRC-32 per entry. The workbook is a minimal set of OOXML parts (VERIFIED: `extension/export-core.js`). The only URL literals it contains are the OOXML namespaces, which the release audit allows (S-19, VERIFIED).

**`research-core.js`** builds search queries after redacting secrets, email addresses, file paths, URLs, IP addresses, and card-like numbers (S-21). It has no search backend, so nothing leaves the machine (X-10).

The guidance for these five is simple: treat them as untrusted until each has an installed-browser test, and do not enable any of them by default.

---

# PART V. TESTING, CI, AND EVIDENCE

## Chapter 21. The gap that a refusal test would catch

The debugger path has a one-use confirmation gap. Here is the exact sequence, because a new engineer should understand it before writing the fix (VERIFIED: `extension/browser-task-runner.js` and `extension/page-agent.js`, read this session):

1. The page agent returns `CONFIRMATION_REQUIRED` with a `confirmationKey`, and stores the key with its binding.
2. The runner asks the person and receives a yes.
3. The runner calls `debuggerClickApproved`. It does not send the key to the page agent. It does two locates, compares the points, and clicks.
4. The page agent's stored confirmation is never consumed on this path, because the page agent never receives the `confirmed` call. It stays pending until one of the clearing events in Chapter 19 happens. Those include a changed snapshot and an unrelated safe action, so the approval is not reliably one-use here.

So on the debugger path, nothing enforces that a confirmation works once. A refusal test should do this: obtain a confirmation for one action, complete the debugger click, then present the same key to the page agent again and expect the second use to be refused. Whether the existing tests already cover this is UNVERIFIED. The most likely outcome is that they do not, because the tests named in CLAUDE.md, `tests/debugger-click-runner.test.js` and `tests/cdp-input.test.js`, test the click and the detach, not the key.

The fix should consume the key on the page agent before the click, not after, so that a crash between the two cannot leave a usable approval.

## Chapter 22. The test suite

The Node suite is run by `npm run check`. That command does three things: it syntax-checks each extension module named in its script, it runs the release audit, and it runs the full Node test suite (VERIFIED: CLAUDE.md section 4.1).

As of 2026-11-16 the suite passes: 307 tests, 0 failures, exit code 0 (PASS, run this session in the sandbox; the Node version used is recorded as v22.23.4 in CLAUDE.md T-04). There are 37 test files under `tests/` (VERIFIED: CLAUDE.md T-02). Every extension module is named in the `check` script, so none is left unchecked (VERIFIED: CLAUDE.md T-03).

The project uses `node:test` and `node:assert/strict` (VERIFIED: CLAUDE.md section 8). It has no npm dependencies (VERIFIED: CLAUDE.md T-05).

What the Node suite proves: the logic of each module behaves as its tests describe, on fake browser objects and fixtures. What it does not prove: that the extension works in a real browser, or that a real model plans well.

## Chapter 23. Continuous integration

The CI definition is `.github/workflows/ci.yml` (VERIFIED: CLAUDE.md section 4.2). It runs on pushes to `main` and `develop`, and on pull requests into them. It has three jobs:

- **`validate`**, on Ubuntu with Node 22, runs `npm run check`.
- **`windows-foundation`**, on Windows with .NET 8, restores, builds, runs the Core and safety tests, captures resource baselines, and uploads an evidence artifact named after the commit.
- **`package-extension`**, on Ubuntu, packages the extension.

Runs for the same branch cancel each other when a new push arrives.

The CI results as of 2026-11-16 are: `5725533` succeeded (run 43280368795), and `fb8c9ec`, `29a35ad`, and `e643f00` also succeeded (VERIFIED: `gh run list --branch develop`).

Two limits apply. Feature branches with no pull request get no CI, so a green result on a feature branch is not evidence (VERIFIED: CLAUDE.md G-10 and the pitfalls list). And hosted CI builds and tests the Windows code, but it does not drive a real desktop (VERIFIED: CLAUDE.md C-07).

## Chapter 24. The acceptance tiers

Testing is organized in tiers, and each tier needs its own evidence. The honest status of each tier, as of this book, is in the table below. It is the most important table in this chapter.

| Tier | What it proves | Status |
|---|---|---|
| Source review | The code reads as intended | Done for the modules named in this book |
| Isolated harness | The code runs against shims | Recorded in HANDOFF.md, 2026-11-11 entries. Historical. |
| Node suite (`npm run check`) | Module logic matches its tests | PASS, 307 tests, this session |
| .NET tests | Windows logic matches its tests | CI only (windows-foundation job). Local run BLOCKED: no .NET SDK in the sandbox. |
| Hosted CI on exact commit | The suite passes on a clean machine | PASS on `5725533`, run 43280368795 |
| Installed Chrome or Edge acceptance | The extension works on a real browser | NOT RUN. Needs a person on Windows with Chrome. |
| Real Yahoo Mail acceptance | Bulk actions work on the real site | NOT RUN. Fixtures match the parser, not the live page (X-05). |
| Live Ollama acceptance | The model plans well | NOT RUN. Needs Ollama running locally. |
| Interactive Windows acceptance | The desktop path works | NOT RUN. Needs a real interactive desktop (X-06). |
| Performance soak | Memory and CPU stay within budget over time | NOT RUN (V3 section 15.8). |

The rule for reporting is in CLAUDE.md section 5. A fixture is not evidence that a live site works. An isolated harness is not the Node suite. A hosted CI pass is not an interactive desktop pass. Each report names its tier.

## Chapter 25. The historical test claims, and how to read them

The project's ledger in `docs/HANDOFF.md` contains many entries from 2026-11-11 that report isolated test results: for example, "PASS: 86/86" or "79/79 PASS" in V8 harnesses with URL and DOM shims. Those results were real runs of the source against the shims. They are not the Node suite, not installed Chrome, and not .NET. Several of those entries also record that the sandbox could not reach GitHub or had no .NET SDK, which is why the isolated harness was used.

Read them as the record of what was checked and how, not as a current pass. The current, authoritative pass is the Node suite on the exact commit, which is 307 of 307 on `5725533`.

---

# PART VI. THE BROWSER TASK IN DETAIL

## Chapter 26. What a task is

A task is a goal plus a starting tab. The person gives a goal in the side panel. The runner pins the task to the starting tab and to the origins it is allowed to use. It then runs the loop in Chapter 15 until the goal is done, a limit is hit, the person cancels, or an error stops it (VERIFIED: SECURITY.md; CLAUDE.md section 7.2).

The default limits are 40 actions and 120 seconds (Chapter 16). A task that hits a limit stops and reports why. It does not continue silently.

## Chapter 27. What a snapshot contains

A snapshot is the structured picture of the page the planner sees. It contains a snapshot identifier, the URL, a bounded list of controls with their roles, names, and states, a bounded amount of visible page text, and a truncation flag. If the observer had to stop early, the flag is set, and consequential actions are blocked until the page can be observed completely (VERIFIED: HANDOFF.md, 2026-11-11 entries, and Chapter 16).

Sensitive fields are marked as sensitive, and the project does not read or act on them autonomously (VERIFIED: SECURITY.md, "Implemented controls"). The security document's controls state that sensitive fields cannot be read, typed into, or cleared. Confirm the snapshot's exact output in `extension/page-observer-core.js` before relying on any detail beyond that.

## Chapter 28. The skill model

A skill is a set of site-specific rules. It can add a scope check before a destructive action, and an effect check after one. The Yahoo Mail skill is the only skill. Its checks are these (VERIFIED: CLAUDE.md S-04 to S-06):

- The page must show a search route, a search control, and a parseable count, before a bulk Trash action is allowed.
- The count parser accepts only `Showing X–Y of Z` and `N results`. It deliberately refuses `N messages`, which was removed because it was ambiguous.
- A free-text success message never proves that items were deleted. The count change and an independent check are the evidence.

The Yahoo layout has not been captured from a live account, so these rules were written against fixtures that match the parser's format (X-05). A skill should not be trusted on a real account until that capture is done.

## Chapter 29. The collector, the exporter, and the research module

These three are opt-in extras, described in Chapter 20. Together they are meant to support the end-to-end task the owner asked for: open a URL, search, follow results across pages, collect IP addresses, and export a workbook. The pieces work in their tests. The end-to-end flow is not built (X-11).

---

# PART VII. THE WINDOWS HALF IN DETAIL

## Chapter 30. The approval primitive

The Windows approval is a one-shot object that binds to one action on one element. This is checked directly in `windows/src/Sightline.Core/OneShotDesktopActionApproval.cs` (VERIFIED in the recheck):

- **Single use.** A match clears the stored fingerprint, so a second check fails (the `IsApproved` method clears on success).
- **Expiry.** The default window is two minutes. The constructor rejects any window longer than five minutes or zero or less. A clock that moves backward, or that has passed the expiry, clears the approval.
- **Replacement.** Arming a new approval first clears the old one, and the code says so: an exception must not leave an old approval usable.
- **Fingerprint, not state.** The stored value is a SHA-256 hash, not the state itself. The fingerprint covers the snapshot id, process, window, capture time, the target's reference, name, automation id, control type and depth, the action kind, and the action's value. The comparison uses a fixed-time equality check.
- **Refusals before arming.** It refuses a truncated snapshot, a snapshot with more than 10,000 elements, duplicate references, a disabled target, a target with no name and no automation id, and a target that `SensitiveControlPolicy` marks as sensitive. That policy matches password, passcode, PIN, one-time code, card number, CVV, and similar names (VERIFIED: `windows/src/Sightline.Core/SensitiveControlPolicy.cs`).

What is not done is the production screen that lets a person give the approval (Chapter 33 and Part IX).

What it does not have is a production screen. The person has no trusted way to see the exact action and give consent. Until that exists, the approval has no way to be given by a real user (V3 section 15.3; `windows/README.md`).

## Chapter 31. The write-ahead journal

Before any Windows mutation, the executor writes a journal entry. If the entry cannot be written, nothing happens and the result is `UnknownEffect`. A crash after the write leaves a pending entry, and the next mutation is refused until that entry is reconciled (VERIFIED: CLAUDE.md W-02, W-03).

What is missing: secure per-user provisioning of the journal file, permission checks, safe startup behavior, and a trusted reconciliation screen (V3 section 15.4). A crash must not allow a second execution of an uncertain operation, and that is not yet proven by a crash-injection test (V3 section 15.4 acceptance criteria).

## Chapter 32. Windows observation and action

Observation reads the UI Automation tree within the bounds in Chapter 14. Element references are session-scoped handles, not permanent identities. They must be revalidated before any mutation, and never silently reused for a different element (VERIFIED: `docs/ARCHITECTURE.md`, "Element identity"). The future design binds them to the process, window, and UI Automation identity through "leases", which are planned but not built (V3 section 8.3).

For actions, the executor uses UI Automation patterns first. `Invoke` and `SetValue` are partial: their results are not yet independently verified (V3 section 13).

Password fields fail closed. If the executor cannot read whether a field is a password, it treats the field as one (S-12, W-04).

## Chapter 33. What the Windows half cannot do yet

- Show a production consent screen (Chapter 30).
- Provision and reconcile the journal securely (Chapter 31).
- Verify effects independently for most actions (Chapter 32).
- Talk to the browser half. The browser-to-Windows connection is not built and must be narrow, authenticated, and bounded when it is (V3 section 15.6).
- Run any OCR or vision. Those are planned and must not be claimed (V3 section 13).
- Run a tiny embedded model. That is optional and not implemented (V3 section 9).
- Install or update itself. There is no installer or updater (V3 section 13).

## Chapter 34. PR #8 and the Windows branches

Three Windows branches exist on GitHub, and one pull request. The pull request, `#8`, is for Windows process inspection. It is based on an older `develop` commit, `5f19279`, and it removes the approval and journal wiring from the session class when diffed against current `develop` (VERIFIED: CLAUDE.md G-07 to G-09). Merging it as it stands would undo safety work. The rebased version, `feature/windows-process-inspection-v0-rebased`, has no CI run (VERIFIED: CLAUDE.md G-10).

The other remote branches, `feature/windows-foundation-v0` and `feature/windows-window-discovery-v0`, exist, but their contents were not reviewed (UNVERIFIED: CLAUDE.md G-11).

---

# PART VIII. HISTORY: WHAT HAS BEEN DONE

This part is a record. It separates the work done before this takeover from the work done during it.

## Chapter 35. The work before the takeover (up to 2026-11-11)

The project's ledger in `docs/HANDOFF.md` records the earlier work in order. The most consequential entries, from the 2026-11-11 series, are these (VERIFIED: HANDOFF.md):

- **Sensitive-field protection.** Closed a gap where a harmless `name` attribute could hide a sensitive `id`, and where prefixed autocomplete tokens could be missed. Also closed a gap where a credential label was only linked through an external label element. The guard now runs right before every sensitive-capable DOM operation, not only during observation.
- **Bounded accessible names.** Replaced unbounded label processing with incremental, capped extraction. A name that is too long now marks the observation truncated, so a consequential action cannot act on a partial label.
- **Bounded reads and selects.** Capped the number of text nodes read during a DOM read or verify, and the number of options examined in a select.
- **Bounded text normalization.** Replaced whole-string normalization with a streamed, bounded normalizer, so one huge text node cannot create a large temporary copy.
- **Bounded frame discovery.** Frame discovery now has a hard ceiling on nodes visited, and an incomplete scan marks the snapshot truncated, so a partial frame inventory cannot be mistaken for a complete one.
- **Windows receipt correction.** A UI Automation result that could not be verified was reporting success while leaving a pending journal entry. It now reports `UnknownEffect`.
- **Windows approval hardening.** An old approval is now revoked before new input is processed, and credential-named or unidentifiable targets are refused before an approval is minted.

Two cautions from the ledger itself apply here. Several entries record that a commit was made to the wrong path during one of the sessions, and that the mistaken file was deleted with a follow-up commit. That history is in git and is harmless, but it means the ledger should be read against `git log`. And the entries say repeatedly that full Node and .NET runs, installed-browser runs, and performance measurements were not done (VERIFIED: HANDOFF.md, the same entries).

## Chapter 36. The earlier structure: a second layer of work (commit history, 2026-11-11 and before)

The commit history on `develop` shows the feature commits that the browser and Windows halves are built from. The most recent six commits as of the dossier, newest first, are these (VERIFIED: `git log --oneline -6` on `5725533`; the branch has since gained `ca81bce`, the commit that added this book):

- `5725533` docs: add CLAUDE.md engineering dossier for handoff (this takeover)
- `fb8c9ec` feat(task): opt-in debugger clicks for confirmed actions
- `29a35ad` feat(browser): read-only element locate and click-point validation
- `e643f00` feat(browser): add approval-gated debugger input path (not yet wired)
- `28a4e2c` feat(task): collect addresses across observed pages and attach to results
- `e1a8717` feat(research): build redacted search queries and rank sources

The commit messages show the order: the research queries were built first, then the collector, then the debugger input path (not yet wired), then the locate and click validation, then the opt-in wiring. Read that order as the order the pieces were built, not the order in which they were integrated and tested.

## Chapter 37. The takeover work (2026-11-12 to 2026-11-16)

This is the work done during this takeover. Every item was done in the sandbox and verified where a check was possible.

**Baseline.** Read the handoff package and the live-verification addendum. Fetched `develop` with explicit refspecs, because a plain fetch in the shallow clone updated only `FETCH_HEAD` (VERIFIED: CLAUDE.md G-01, G-02). Confirmed `develop` at `fb8c9ec` and ran the Node suite: 307 pass, 0 fail (PASS).

**The dossier.** Wrote `CLAUDE.md`, the engineering dossier. Every factual claim got an ID, its evidence, and a status. The first draft contained errors that were found by checking the repo and corrected: the WPF framework was attributed to the wrong project; two safety levels were wrong; a branch size was wrong; the approval window was described from memory rather than from code; and a figure from an operator's pasted note had been presented as current when it was out of date. Each correction is recorded in CLAUDE.md Appendix B and section 14.

**Commit and push.** Committed `CLAUDE.md` as `5725533` on `develop`, with the required attribution trailers, and pushed it with a normal fast-forward (no force). The remote confirmed the new hash. CI on `5725533` passed (run 43280368795).

**Review of the debugger path.** Read `cdp-input.js`, `click-point-core.js`, and `debuggerClickApproved`. Found the one-use confirmation gap (Chapter 21), the absence of an outcome check (X-01), a click race and coordinate concern, and an unused text-input function with no focus check. Made no code changes during the review.

**Takeover documents.** Produced a takeover summary, then a longer summary with the dossier appended, then a guide for a reader with no background. Each was checked against the repo before being sent. The guide corrected an error in the earlier summary: the branch divergence figure. The earlier figure, 20 commits, came from a shallow clone. GitHub's compare API reports `develop` as 561 commits ahead of `main` and 17 behind.

**Claude Code setup guidance.** Gave setup instructions for Claude Code, first for the command line and then for the Windows desktop app. Several claims in that guidance are UNVERIFIED against the live app (Part IX, Chapter 42).

**Computer control attempts.** Tried three times to reach the operator's PC through computer-control tools. The tool never listed the Claude app as an app it could see. The attempts were not successful and did not change anything on the PC.

**Scheduled reminder.** Created a 20-minute reminder in this chat, then cancelled it on request. It did not run.

## Chapter 38. What was not done, and why

- **No code change** was made to fix the debugger confirmation gap. A refusal test must come first (CLAUDE.md section 8).
- **No Chrome run.** The sandbox has no Chrome. The debugger path has never been run in a real browser.
- **No Windows run.** The sandbox has no .NET SDK and no interactive desktop.
- **No live model run.** The sandbox has no Ollama.
- **No upload to the repo of this guide** until the operator confirms. The guide was prepared in the sandbox first.
- **No correction to the committed G-04 figure.** The committed `CLAUDE.md` still shows the 20-commit figure. It should be corrected in a separate commit, and it has not been.

---

# PART IX. KNOWN PROBLEMS

Each problem has an identifier from `CLAUDE.md` section 9 or this book. Severity reflects the risk to users, not the effort to fix.

## Chapter 39. Safety problems

**S-01 gap: the debugger path does not consume the one-use confirmation.** *High.* A confirmation is not enforced as one-use on the debugger path. See Chapter 21. Not proven exploitable, but the rule is not met.

**X-01: no outcome check after a debugger click.** *High.* A click that hits the wrong element reports success. This also conflicts with the security document's rule that confirmed actions must produce a semantic effect or return `NO_VERIFIED_EFFECT` (Chapter 8).

**X-09: PR #8 would undo safety work if merged as it stands.** *High, if merged.* See Chapter 34.

**Effect verification in general (V3 15.1).** *High.* A target that disappears might have been filtered, paginated, or changed by something unrelated. Generic structural change is not proof of a server-side change. Each destructive operation needs a trusted result check, or it should stop for manual reconciliation. This is not yet built beyond the Yahoo Mail skill.

**Real-browser safety (V3 15.2).** *High.* The sensitive-label changes have isolated tests but no installed-browser test. Native labels, linked labels, dynamic labels, shadow DOM, iframes, malformed metadata, and identity changes all need testing in both Chrome and Edge.

**Web-accessible resources matched to every site (found in the recheck).** *Medium, impact unverified.* The manifest lets any `http` or `https` page request the page-side scripts (Chapter 13). That exposes the extension's files and lets a site detect that it is installed. The fix is probably to narrow the match, or to remove the resources that do not need to be reachable from pages. Decide which resources need it before changing anything, and record the decision in `docs/DECISIONS.md`. Do not change the list without a test that checks the resources the page agent actually needs.

**Windows consent screen (V3 15.3).** *High.* The primitive exists. The screen does not.

**Windows journal provisioning and reconciliation (V3 15.4).** *High.* See Chapter 31.

## Chapter 40. Evidence problems

**Exact-commit CI for the full .NET and Node suites (V3 15.5).** *Medium.* Hosted CI runs them on `develop`, but the rebased Windows branch has no CI run at all.

**Performance soak (V3 15.8).** *Medium.* No measured memory, CPU, or handle data exists for the browser or Windows half.

**Installed-browser acceptance (X-03).** *High for shipping.* The checklist is in `CLAUDE.md` section 10. It has not been run.

**Live Yahoo capture (X-05).** *Medium.* The skill is written against fixtures.

**Live model quality (X-12).** *High for usefulness.* The local model's behavior on real pages is unknown.

## Chapter 41. Documentation problems

**Branch divergence figure.** The committed `CLAUDE.md` (G-04) says 20 commits. GitHub says `develop` is 561 ahead and 17 behind. Correct the dossier.

**Stale feature row.** `docs/FEATURE_STATUS.md` has a Windows approval row that says there is no one-use approval implementation. The code has one. The V3 handoff flags the same mismatch.

**The product identity.** The README describes a browser product. The architecture document describes a Windows application with a browser companion. Both are in the repo. A new contributor should not pick one and ignore the other. Decide which description leads and update the other to match (V3 "Documentation discrepancy" note).

**Two copies of the dossier.** This book is in the repo as `docs/TAKEOVER.md`. The dossier is in `CLAUDE.md`. Keep this book pointing to `CLAUDE.md` rather than copying it, so they cannot drift apart.

**V3 point-in-time snapshot.** The V3 handoff is dated 2026-11-11. Its branch counts and some status lines are out of date. It says so itself (V3 "What makes this edition different").

## Chapter 42. Claude Code setup claims that are not verified

The guidance given to the operator for Claude Code included the following. None has been checked against the live app. Treat each as UNVERIFIED until the operator confirms it on the PC.

- The desktop app has a Code tab, reached from the top bar. A third-party guide describes a two-tab app (Home and Code). The official desktop quickstart lists three tabs. The operator did not see the Code tab in the app window they sent.
- Windows may need Git for Windows installed before the Code tab works. One third-party guide says so, and the official page was not read in full.
- A paid plan is required. The operator has Pro. The exact requirement was not confirmed on claude.ai.
- Node.js 22 is needed for `npm run check`. This follows from the project's own CI (VERIFIED: CLAUDE.md T-04), but the install on the operator's PC was not checked.

---

# PART X. WHAT TO DO NEXT

## Chapter 43. The recommended order

These recommendations come from the evidence in this book. Each gives its reason and what "done" means.

**1. Fix the one-use confirmation gap on the debugger path.** *Why first:* it is the only open safety-rule failure, and the debugger path is what the owner most wants to try. *Start:* write the refusal test from Chapter 21, confirm it fails on the current code, then fix. *Done when:* the refusal test passes, a second use of the same key is refused, the Node suite passes, and the change is on its own named branch. *Branch name:* `feature/debugger-confirmation-consume`, reported to the operator.

**2. Add an outcome check after debugger clicks (X-01).** *Why:* a click that reports success without checking the page breaks the rule in Chapter 8. *Done when:* a debugger click either shows a semantic effect or returns `NO_VERIFIED_EFFECT`, with a test for each.

**3. Tighten the click path.** Locate immediately before clicking, check the viewport, and decide what zoom and device pixel ratio do. *Done when:* a test shows that a moved element is refused, and the coordinate rule is written down.

**4. Remove or guard `insertText`.** *Why:* it has no caller and no focus check, so it is a trap for whoever wires it up next. *Done when:* it is removed, or a focus and sensitive-field check exists with a refusal test.

**5. Run the browser in a real installed Chrome or Edge.** *Why:* every browser result so far comes from fixtures and fake objects. *How:* follow `docs/BROWSER_ACCEPTANCE.md` and record each check as PASS, FAIL, or BLOCKED. *Done when:* the operator has a dated record of each check on a named browser version.

**6. Test whether Chrome shows its debugging banner (S-17).** *Why:* the comment in `cdp-input.js` and the security story both depend on it. *Done when:* the banner's presence is recorded as VERIFIED or the claim is removed.

**7. Make CI cover the exact commit you intend to ship.** *Why:* feature branches with no pull request get no CI, and the rebased Windows branch has none. *Done when:* the branch is in a pull request, or the workflow is changed, and the run result is recorded.

**8. Reconcile PR #8.** *Why:* merging it as it stands removes safety wiring (G-09). *Choices:* rebase it, replace it with the rebased branch, or close it. *Done when:* the operator has chosen and the choice is recorded in `docs/DECISIONS.md`.

**9. Benchmark the local planner on 20 to 30 saved real pages.** *Why:* the planner's quality is the largest unknown in the product (X-12). *Done when:* the results are recorded as a table, and the operator decides on the model.

**10. Build a trusted effect check for each destructive operation, starting with Yahoo Mail (V3 15.1).** *Why:* a destructive action with no trusted check should stop for manual reconciliation. *Done when:* each destructive path either has a check or refuses.

**11. Build the Windows consent screen (V3 15.3).** *Why:* without it, the Windows approval cannot be given by a person. *Done when:* the acceptance criteria in V3 15.3 pass on a real desktop.

**12. Build the end-to-end browser flow (X-11).** Only after items 1 to 5 are done. *Why:* a complete flow built on unverified parts would look finished when it is not.

**13. Correct the stale documents (Chapter 41).** *Why:* leaving them wrong means the next engineer repeats the same errors. *Done when:* G-04, the Windows approval row, and the product-identity note are fixed in one commit.

## Chapter 44. What not to do

- Do not merge PR #8 as it stands.
- Do not merge `main` into `develop`.
- Do not force-push.
- Do not enable the debugger path by default.
- Do not add a search provider or a cloud model without a logged decision.
- Do not widen site coverage until item 10 is done.
- Do not claim a feature works on a site, browser, or desktop without a labeled run that shows it.
- Do not repeat a figure from an older document without checking it.

---

# PART XI. DECISIONS ONLY THE OPERATOR CAN MAKE

These are not coding tasks. Each one changes what the project may do, so each needs an explicit answer from the owner.

1. **Planning model.** Keep the local model, change it, or accept a cloud model. A cloud path needs a logged decision (S-20, S-24).
2. **Search provider for research.** None is connected. Choosing one conflicts with local-first and needs a decision (S-24).
3. **PR #8.** Rebase, replace, or close.
4. **Debugger clicks.** Keep off by default, or add a setting. Changing the default needs a decision (S-13).
5. **Product identity.** Browser-first or Windows-first in the README and architecture document.
6. **Commit this book to the repo.** It is in `docs/TAKEOVER.md` in the working tree and is not committed.
7. **Correct G-04.** Approve a documentation commit that fixes the branch figure.

---

# PART XII. THE PROJECT'S DOCUMENTS

Each document has a purpose. Read the one that fits your task.

| Document | Purpose | Read when |
|---|---|---|
| `CLAUDE.md` | Engineering dossier: working rules, status of every claim, commands, CI, safety rules | Always, first |
| `docs/TAKEOVER.md` | This book | Before taking over |
| `docs/HANDOFF.md` | Chronological ledger of verified work | Before changing a module, to see what was done and how it was checked |
| `docs/handoff/SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md` | Full product narrative, rationale, and conversation history (point-in-time, 2026-11-11) | For the reasons behind a decision |
| `docs/FEATURE_STATUS.md` | Feature status (one row is stale) | To see what is built |
| `docs/ARCHITECTURE.md` | Architecture, dependency rules, trust order | Before adding a module |
| `docs/SECURITY.md` | Security model and controls, and what is still required | Before any change near safety |
| `docs/PERFORMANCE.md` | Performance budgets | Before adding a buffer or a scan |
| `docs/DECISIONS.md` | Decisions log. Required before weakening a safety rule. | Before any decision |
| `docs/ROADMAP.md` | Roadmap | To plan |
| `docs/USER_MANUAL.md` | End-user manual | Before changing user-facing behavior |
| `docs/BROWSER_ACCEPTANCE.md` | Installed-browser acceptance steps | Before running acceptance |
| `docs/REQUIREMENTS_AND_ACCEPTANCE.md` | Requirements and acceptance criteria | When writing acceptance tests |
| `docs/RELEASE_READINESS.md` | Release gates | Before a release |
| `docs/SOURCE_MAP.md` | Where things live in the source | When navigating |
| `docs/CHANGELOG.md` | Changes by version | To see what changed |
| `docs/PROJECT_BRIEF_AND_TAKEOVER.md` | Earlier takeover brief | For background |
| `docs/DEVELOPMENT_LEDGER.md` | Earlier development ledger | For background |
| `windows/README.md` | Windows layer status and principles | Before touching Windows |
| `CONTRIBUTING.md` | Contribution rules | Before a pull request |
| `SECURITY.md` | Security reporting policy | If you find a vulnerability |
| `.github/pull_request_template.md` | Pull request checklist | When opening a pull request |

Note the naming: the root `SECURITY.md` is a reporting policy, and `docs/SECURITY.md` is the security model. Do not confuse them.

---

# PART XIII. OPERATING THE PROJECT

## Chapter 45. Setup

To run the checks, you need Node.js 22 or newer and git. The CI uses Node 22 (VERIFIED: CLAUDE.md T-04). The browser acceptance tooling needs Node.js 20 or newer (T-07).

To build the Windows half, you need the .NET 8 SDK on Windows. The sandbox does not have it (W-07), so local Windows builds have never been run from the sandbox. CI has built the Windows projects (C-03).

To run the installed-browser acceptance, you need Chrome or Edge on Windows, and the extension loaded unpacked from the `extension` folder (`docs/BROWSER_ACCEPTANCE.md`).

To run the live model acceptance, you need Ollama running locally, and a non-cloud model (S-20).

The project has no npm dependencies (T-05). `npm install` is not required for the checks.

## Chapter 46. The commands

| Command | What it does | Where it runs |
|---|---|---|
| `npm run check` | Syntax-checks each listed module, runs the release audit, runs the Node suite | Linux sandbox, CI |
| `node --test tests/*.test.js` | Runs the Node suite only | Linux sandbox |
| `node tools/release-audit.mjs` | Version alignment, permission allowlist, URL rule | Linux sandbox |
| `node tools/serve-acceptance.mjs` | Serves fixtures on `127.0.0.1:8765` | Linux sandbox |
| `node tools/ollama-acceptance.mjs` | Live check against a local Ollama model | Needs Ollama |
| `tools\start-browser-acceptance.cmd` | Launches installed-browser acceptance on Windows | Windows only |
| `tools\test-windows.ps1` | Restores, builds, runs Core and safety tests, runs the resource probe | Windows, needs .NET 8 SDK |
| `tools\test-windows.ps1 -Interactive` | Adds the real desktop vertical-slice test | Windows, interactive desktop |

(VERIFIED: CLAUDE.md section 4.1.)

## Chapter 47. Branches and pull requests

Work on `develop`. `main` is the GitHub default branch but is not the working branch. Do not work on `main` unless the operator says so (CLAUDE.md G-03, section 3.3).

Do not force-push any branch. Do not merge `main` into `develop` wholesale. Port single files or documents only after review, and name the source commit (CLAUDE.md section 3.3).

Check for an existing branch or pull request before creating one. Open a pull request only when the operator asks, and only after checking for a duplicate (CLAUDE.md section 3.4).

Use the explicit refspec to fetch in a shallow clone: `git fetch --depth=200 origin '+refs/heads/develop:refs/remotes/origin/develop'` (CLAUDE.md section 3.1). Read a hash with `git ls-remote`, never from memory (CLAUDE.md G-03).

Compare branches through the GitHub API rather than a shallow clone's `git log` range, because a shallow clone can undercount (Chapter 41).

## Chapter 48. Commits

Keep commits small, and say why in the message. Push only when `npm run check` passes locally, and say so in the summary (CLAUDE.md section 3.4).

Never commit secrets, tokens, account exports, personal email addresses, or personal data.

Every commit ends with a Co-Authored-By line naming the real model and a Claude-Session line if the operator gives a session URL (CLAUDE.md section 3.4). Add no other attribution line the operator did not ask for.

## Chapter 49. The start-of-task routine

Run these before changing anything (CLAUDE.md section 1.1):

1. `git status`. The working tree must be clean, or you must know exactly what is uncommitted and why.
2. Fetch with the explicit refspec.
3. Run `npm run check` and read the counts.
4. Read `docs/HANDOFF.md` and `docs/FEATURE_STATUS.md`. If they disagree with your measurements, trust the measurements and update the handoff in the same change.
5. Check open PRs and branches before creating anything.
6. Check the latest CI run on `develop`. If it is red, report that before starting new work.

End-of-task (CLAUDE.md section 1.2): `npm run check` passes with the counts you read; every safety change has a refusal test as well as a success test; the commit exists locally; if pushed, `git ls-remote` shows its hash; the CI run for the pushed commit is recorded; the report follows the template in CLAUDE.md section 5.

## Chapter 50. Reporting

Use the labels in CLAUDE.md section 5: PASS, FAIL, BLOCKED, NOT RUN, UNVERIFIED. Give the name of each command or test, and the first error line for a failure. Give the reason for a blocked or not-run item. Keep reports short. Do not recap each step.

Every Windows report must say that hosted CI does not drive a real desktop (CLAUDE.md C-07).

---

# PART XIV. GLOSSARY

**Acceptance.** A test run against the real target (a real browser, a real desktop, a real model) rather than fixtures or fakes.

**Approval.** A one-use permission for one action on one target, given by the person. See *confirmation*.

**Attempted, dispatched, verified, unknown, failed-before-dispatch.** The six states of a consequential action (Chapter 8).

**Bounded.** Has a fixed maximum size or count, stated in the code or the test.

**CDP.** The Chrome DevTools Protocol. The debugger path sends input through it.

**Checkpoint.** A saved, sanitized record of a task's progress, used to resume after an interruption.

**Collector.** The opt-in module that gathers data across pages.

**Confirmation.** A one-use token bound to one action, one target, one snapshot, and one task. In the browser it is valid for five minutes. In the Windows layer the default is two minutes, and the maximum is five.

**Deterministic.** Produces the same output for the same input, with no model in the loop.

**Effect.** A real change on the server or the application, as distinct from a change to the page.

**Fail closed.** When unsure, refuse the action rather than guess.

**Fixture.** A saved page or document used in tests, matching a real page's format. Not proof that a live site works.

**Journal.** The Windows record written before a mutation, so a crash leaves a trace.

**Lease.** A planned Windows mechanism binding an element reference to its process and window (V3 8.3). Not built.

**Locate.** A read-only check that finds an element by its ref and returns its position.

**Local-first.** Ordinary operation does not depend on a cloud service.

**MV3.** Manifest V3, the current Chrome and Edge extension format.

**Oracle.** A trusted check of whether a result really happened.

**Ref.** A stable reference to one control in one snapshot.

**Sensitive field.** A password, one-time code, payment, or token field, which the project never acts on autonomously.

**Skill.** A site-specific rule set. Yahoo Mail is the only one.

**Snapshot.** A bounded structured picture of a page at one moment, with a `snapshotId`.

**Trust order.** User command, then trusted local policy, then OS and app metadata, then page content, then OCR, then model inference.

**UIA.** Windows UI Automation, the accessibility interface for native applications.

**Unknown effect.** An action that might have happened and cannot be confirmed. Never retried.

**Verified.** Checked against a named source, with the source named. Not the same as "believed".

---

# PART XV. APPENDIX: VERIFYING THIS BOOK

Run these in the repo. Each line says what it proves. If any line disagrees with this book, trust the command and fix the book.

```
cd sightline
git status --short                                          # nothing uncommitted (except docs/TAKEOVER.md until committed)
git ls-remote origin refs/heads/develop | cut -c1-7         # 5725533
git log --oneline -6                                        # the six commits in Chapter 36
npm run check; echo "exit=$?"                               # exit 0; 307 pass, 0 fail
gh run list --branch develop --limit 4                      # 5725533 success
gh api repos/DevTunaSoft/Sightline/compare/main...develop \
  --jq '"ahead=\(.ahead_by) behind=\(.behind_by)"'          # ahead=561 behind=17 at time of writing
gh api repos/DevTunaSoft/Sightline/pulls/8 --jq '.state'    # open
grep -c "" tests/*.test.js | wc -l                          # 37 test files
```

---

# APPENDIX: THE ENGINEERING DOSSIER

The full engineering dossier is `CLAUDE.md` in the repo root, at commit `5725533`. It is not copied into this book, so that the two cannot drift apart. Read it before this book's Part IX, because it holds the claim IDs this book cites (G-, P-, S-, T-, C-, W-, X-).

---

*End of the takeover book.*
