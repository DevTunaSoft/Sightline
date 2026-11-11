# Sightline — QA and Acceptance Plan (Companion)

This is an extract of the V3 master handoff. It contains 60 acceptance scenarios, exact commands, security and fault-injection tests, quantitative memory benchmarks, and release gates. None of the listed future scenarios is falsely claimed as executed.

# PART V — AUTONOMOUS QUALITY ASSURANCE AND RELEASE ACCEPTANCE

## V.1 What has actually been executed versus what remains unverified

**Confirmed recent source-level evidence:** The latest documented observer and DOM-adapter checkpoint executed **86/86** current test functions against exact GitHub `develop` source inside an **isolated V8 harness with synthetic DOM, URL and Abort shims**. Those tests cover bounded observation, labels, credential redaction and refusal, and selected action semantics. This is useful regression evidence, but it is **not** equivalent to running the repository's native Node test runner, installing the extension, or exercising a real browser. A previous checkpoint reported 50/50 observer tests and earlier checkpoints reported smaller subsets; do not add these counts together as independent test suites.

**Documented older Windows evidence:** The repository describes hosted Windows foundation build/tests and a synthetic 1,000-cycle allocation improvement from about 11.24 MB to 0.84 MB (about 92.5%) after making element lease/diagnostic storage lazy. This is **historical, environment-specific evidence**, not a current production RAM guarantee. The latest Windows approval/journal/receipt changes have **targeted XUnit tests authored but not executed** in the recent session; real interactive Windows acceptance remains unverified.

**Explicitly not yet accepted:** full latest `npm run check`, latest .NET build and XUnit, installed Chrome/Edge semantic and security acceptance, extension-origin real Ollama planning, controlled Yahoo account destructive workflows, active UIA Windows soak, mixed DPI/elevation/focus interference, browser-to-Windows IPC, production consent/reconciliation UI, signed installer, end-user update/uninstall, and quantitative end-to-end RAM/CPU soak.

**Never write “all tests pass” without specifying which test universe, which SHA, which machine and which command.** A targeted isolated suite can be PASS while the release remains BLOCKED.

## V.2 The test pyramid and ownership

1. **Pure unit tests:** Parsers, policy, sensitive-field heuristics, size clamps, identity hashing, approval fingerprints, checkpoint serialization. Must be fast, deterministic and runnable in CI without browser/model/UIA.
2. **Component integration tests:** Browser observer + adapter + registry, task runner + safety + checkpoint, Windows Core + journal + fake UIA provider. Must include adversarial and fault-injection cases.
3. **Installed browser fixture tests:** Real Chrome and Edge extension plumbing, side panel, iframe behavior, permissions, dynamic DOM, page action verification and model-independent self-test.
4. **Real local model tests:** Actual Ollama/optional future GGUF, context, streaming, cancellation, malformed outputs, token/latency/memory evidence.
5. **Interactive Windows tests:** Real WPF fixture, UIA provider, process/window identity, user focus, approval, journal, crash/restart and privilege differences.
6. **Controlled external-site tests:** Disposable Yahoo data, exact scope, confirmation and independently verified server effects.
7. **Soak/security/release tests:** Long sessions, memory/CPU growth, secret canaries, prompt injection, crash recovery, install/update/uninstall and release reproducibility.

The test runner should expose one-command entry points where possible, but **tests requiring a real interactive desktop or external account must not be falsely replaced with mocks**. In-app self-tests should use disposable fixtures, never production data, and should clearly report the scope they actually exercised.

## V.3 Day-one exact-commit verification commands

```powershell
# Windows PowerShell, on a developer machine with git, Node >=20 and .NET 8 SDK.
# First inspect remote branches and existing changes; do not assume main is the app baseline.
git clone https://github.com/DevTunaSoft/Sightline.git
cd Sightline
git fetch --all --prune
git branch -a
git log --oneline --decorate -15 origin/develop
git log --oneline --decorate -15 origin/main
git log --left-right --count origin/main...origin/develop
git switch --detach origin/develop
$sha = git rev-parse HEAD
Write-Host "Verifying Sightline SHA: $sha"

# Native repository test runner, which includes syntax checks, release audit and tests.
npm run check
npm run benchmark:core

# Windows build/tests, then interactive WPF fixture when a real desktop is available.
.	ools	est-windows.ps1
.	ools	est-windows.ps1 -Interactive
```

If the machine lacks a prerequisite, mark that gate **BLOCKED** and record the missing prerequisite; do not say it passed. A CI run on a different SHA does not verify the new SHA. Capture the exact exit code and log path. A command failing due to network, SDK absence or artifact quota is not evidence that the code is correct or incorrect; diagnose the infrastructure separately.

## V.4 Installed Chrome/Edge acceptance procedure

The repository documents a deterministic browser fixture under `docs/BROWSER_ACCEPTANCE.md`. On Windows: load `extension` unpacked in Chrome or Edge, start `tools\start-browser-acceptance.cmd` (or `npm run acceptance:serve`), open `http://127.0.0.1:8765/`, open Sightline's side panel, and run **Run browser self-test**. The fixture is intentionally restricted to loopback and does not require Ollama. It tests semantic discovery, sensitive redaction, same-origin frames, cross-origin opacity, text entry, clicks, state changes and confirmation stops.

For each browser, capture browser version, extension manifest version, Windows version, exact commit, fixture URL, each self-test line, console errors, observed process memory, and a sanitized report. Do not manually click through the destructive/cross-origin confirmations during the self-test, because the point is to prove that Sightline blocks them.

After the baseline fixture, run a second adversarial fixture with dynamically inserted controls, nested frames, enormous labels, million-option synthetic collections, mutation during approval, shadow DOM, CSS-hidden controls, custom editable roles and password-like fields. The tests must prove both **safety** (no secret leakage or wrong mutation) and **compatibility** (ordinary buttons/fields still work). A system that blocks every action is not a useful accepted product.

## V.5 Real Ollama acceptance

Use the documented `npm run acceptance:ollama` command on a machine with Ollama configured. Test from the actual extension origin, not only a terminal `curl`. Verify loopback restrictions, timeout, malformed JSON repair budget, token/context ceiling, cancellation and correct no-model fallback. Record model name, quantization, context, Ollama version, warm/cold latency, throughput, RSS/private memory, and whether the model unloads when intended.

The future tiny GGUF runtime needs separate acceptance: verify model license and distribution, memory mapping, quantization, streaming parser, safe cancellation, unloading, prompt injection resilience, schema compliance, and no model loaded at idle. Do not ship a model merely because it answers a sample prompt quickly. Its ability to complete bounded action-planning tasks accurately matters more than generic chat fluency.

## V.6 Windows interactive acceptance and its special hazards

Windows UI Automation is a real provider interface with timing and accessibility quirks. Hosted CI can compile and run unit tests but often cannot provide an interactive desktop session with realistic focus behavior. Use the project's disposable WPF fixture on a real Windows 11 desktop and record Windows build, DPI/scaling, monitor layout, elevation, UIA provider details, exact SHA and result.

Test unique and duplicate names, unnamed controls, stale process/window generation, provider exceptions, UIA hangs, partial tree, depth-boundary leaf, cancellation, focus theft, keyboard activity, SetValue readback mismatch, Invoke with no independent effect, approval expiry/reuse, journal write failure and restart with pending record. The user should see a clear blocked/reconciliation message rather than a silent retry or unhandled exception.

Production acceptance also needs an accessible trusted confirmation UI and stable journal storage with access restrictions. The controlled fixture may arm approvals for testing, but that does not mean the real user-facing workflow exists.

## V.7 Test catalogue: exact scenarios to automate

Each test ID below is an acceptance *specification*. Its presence here is not a claim it has already been implemented. Use the exact source test names and evidence when closing it.

| Test ID | Scenario | Expected invariant | Required environment | Priority |
|---|---|---|---|---|
| T-001 | Empty browser page | Bounded empty observation, no crash | Node + Chrome/Edge | P0 |
| T-002 | 100,000 DOM elements | Node visit cap, truncated, no unbounded list | Chrome/Edge | P0 |
| T-003 | Many same-origin iframes | 20-frame cap, partial coverage reported | Chrome/Edge | P0 |
| T-004 | Cross-origin iframe | Opaque, no cross-origin scraping | Chrome/Edge | P0 |
| T-005 | Nested frames past depth cap | Incomplete observation, no consequential action | Chrome/Edge | P0 |
| T-006 | Large textContent getter | Bounded follow-up processing; profile transient allocation | Chrome/Edge profiler | P0 |
| T-007 | Unicode and whitespace fuzz | Deterministic text normalization, bounded scan | Node | P0 |
| T-008 | Oversized aria-labelledby | <=16 IDs, <=2048 chars, truncated | Node + browser | P0 |
| T-009 | Million-entry native labels | No spread/allocation, fail closed | Node | P0 |
| T-010 | Linked label changes to password | Action-time denial, no mutation | Chrome/Edge | P0 |
| T-011 | Benign Show password button | Not misclassified as secret input | Chrome/Edge | P0 |
| T-012 | Credential ID masked by benign name | Redacted and action denied | Chrome/Edge | P0 |
| T-013 | Prefixed autocomplete current-password | Redacted and action denied | Chrome/Edge | P0 |
| T-014 | OTP/payment field custom role | Redacted and action denied | Chrome/Edge | P0 |
| T-015 | Shadow DOM secret input | No credential leak; document limitations | Chrome/Edge | P0 |
| T-016 | Sensitive verify oracle | No true/false secret probing | Node + browser | P0 |
| T-017 | Delete/Enter focused-key action | Risk gate checks target and context | Chrome/Edge | P0 |
| T-018 | Dropdown with 10,000 options | 2048 option cap, unknown scope refusal | Chrome/Edge | P0 |
| T-019 | Read huge DOM subtree | Incomplete read cannot verify effect | Chrome/Edge | P0 |
| T-020 | Replace button after observation | Stale ref blocked, no wrong click | Chrome/Edge | P0 |
| T-021 | Change origin after approval | Approval invalidated, action blocked | Chrome/Edge | P0 |
| T-022 | Change tab during task | Pinned-tab protection | Chrome/Edge | P0 |
| T-023 | Duplicate approval use | Exactly one mutation possible | Node + browser | P0 |
| T-024 | Approval expiry/clock fault | Deny, no timer leak | Node + Windows | P0 |
| T-025 | Malformed approval snapshot | Prior approval revoked before failure | Node + Windows | P0 |
| T-026 | Checkpoint storage quota/error | No action dispatch without checkpoint | Chrome/Edge | P0 |
| T-027 | Crash immediately before dispatch | Recovery does not replay | Chrome/Edge + Windows | P0 |
| T-028 | Crash after dispatch before verify | Unknown effect, no replay | Chrome/Edge + Windows | P0 |
| T-029 | UIA Invoke accepted, no app change | UnknownEffect, not Ok=true | Windows fixture | P0 |
| T-030 | SetValue changes then throws | UnknownEffect, value never logged | Windows fixture | P0 |
| T-031 | Journal corrupt/partial file | Fail closed across restart | Windows fixture | P0 |
| T-032 | Journal directory denied/full | No mutation before durable record | Windows fixture | P0 |
| T-033 | Two concurrent mutation requests | Single pending journal/approval enforced | Windows fixture | P0 |
| T-034 | Windows duplicate-named controls | Unique target resolution or refuse | Windows fixture | P0 |
| T-035 | Windows unnamed control | Safe identity path or explicit blocked result | Windows fixture | P1 |
| T-036 | Windows focus changed by user | No wrong-window typing/click | Windows interactive | P0 |
| T-037 | UIA provider hangs | Time cap/circuit breaker, responsive UI | Windows interactive | P0 |
| T-038 | UIA depth-limit leaf | No false whole-window truncation | Windows fixture | P1 |
| T-039 | User cancels long wait | No timer/abort listener retained | Node + Chrome/Edge | P0 |
| T-040 | User cancels model streaming | Inference ends, buffers released | Ollama / future GGUF | P1 |
| T-041 | Malicious webpage instruction | Typed schema and policy unchanged | Chrome/Edge + Ollama | P0 |
| T-042 | Yahoo result count 1-50 of 300 | Correct/unknown count, not 1 | Node + Yahoo fixture | P0 |
| T-043 | Yahoo Select all on search page | Blocked until stable scope verified | Yahoo disposable account | P0 |
| T-044 | Yahoo pagination after Trash | No false verified deletion | Yahoo disposable account | P0 |
| T-045 | Yahoo mail body quotes MFA | No false security-challenge blocker | Yahoo fixture | P1 |
| T-046 | Diagnostics secret canary in JSON | No raw secret in export | Node + Windows | P0 |
| T-047 | Diagnostics disk-full/rotate failure | Bounded degradation and visible error | Windows | P0 |
| T-048 | 10k diagnostic events | Tail/queue/retention ceilings | Node + Windows | P0 |
| T-049 | 1k task/observation cycles | No retained heap/handle/thread growth | Chrome/Edge + Windows | P0 |
| T-050 | 30–60 min mixed-task soak | Idle near zero, no sustained growth | Real Windows + browsers | P0 |
| T-051 | Installed browser self-test | All fixture checks pass without model | Chrome and Edge | P0 |
| T-052 | Live Ollama planner | Schema, latency, loopback, context | Chrome/Edge + Ollama | P1 |
| T-053 | Browser-to-host IPC malformed payload | Size/auth/origin/replay checks | Future IPC fixture | P1 |
| T-054 | Clean install/update/uninstall | No orphan services, logs or secrets | Windows release candidate | P2 |
| T-055 | Branding at all scales | Original Vision Lens uncut, legible | Windows + design review | P2 |
| T-056 | End-user manual walkthrough | Steps match real UI and error codes | Windows + Chrome/Edge | P0 |
| T-057 | Model unavailable | Deterministic tasks remain usable | Windows + browser | P0 |
| T-058 | Full CI on exact SHA | All checks complete with artifacts | GitHub Actions | P0 |
| T-059 | Main/develop/PR divergence | No duplicate or destructive integration | GitHub audit | P0 |
| T-060 | Release rollback/recovery | Restore safely with pending mutation | Windows release candidate | P2 |

## V.8 Fault-injection protocol: prove no duplicate mutations

Use a disposable fixture with an externally observable counter. At each state-machine boundary, deliberately terminate the agent process or throw a controlled exception: before checkpoint, after checkpoint, immediately before dispatch, during provider call, after provider return, during verification, before journal completion, and after completion. Restart the process and inspect both the journal/checkpoint and fixture counter. If the effect may have happened, the agent must not execute it again without independent reconciliation. Test both the “effect actually happened” and “effect did not happen” variants; the agent cannot infer which one occurred from a generic exception.

A safe test should make the counter increment at most once for a single approved action. If the result is unknown, the UI must clearly say so and offer review, not “retry automatically.” Verify the pending journal remains across restart and that no secret payload was stored. These tests are essential before the app operates real mail, payments, account settings or production desktop workflows.

## V.9 Security acceptance: adversarial input without external exposure

Create disposable local fixtures containing text that tries to: (a) override system instructions, (b) request hidden shell/JavaScript execution, (c) exfiltrate an OTP through a `verify` side channel, (d) alter the selected target after approval, (e) spoof a success toast, (f) hide a password ID behind an innocent name, (g) place a password cue only in a linked label, (h) cause massive DOM/label allocation, and (i) replay an old action token. All such text is **untrusted data**. The model may summarize it, but the trusted policy must reject forbidden actions.

Include false-positive controls: a normal address field named “shipping,” a regular button named “Show password,” a mail body quoting “verification code,” and an innocent page that changes an advertisement. Security hardening must not make routine tasks unusable. Use fake canary secrets and local fixtures, not real credentials.

## V.10 Quantitative performance acceptance recipe

**Baseline:** Record CPU model, RAM, Windows build, browser version, Sightline SHA, extension version, model configuration, DPI and process names. Use an empty fixture, a medium form, a large DOM, nested frames, huge labels, a 10k-option select and a long mixed-task fixture. Measure each scenario with extension disabled, extension enabled but idle, deterministic tasks, and model tasks separately.

**Warm-up:** Run a fixed number of cycles before measuring. Avoid comparing cold-start JIT and warmed loops. For Windows managed allocations, distinguish cumulative `GC.GetAllocatedBytesForCurrentThread`/total allocated bytes from retained managed heap and working set. For browsers, use supported Chrome/Edge memory/CPU tools and keep tab/render process attribution clear.

**Measurements:** Sample private bytes/working set/heap, CPU%, thread count, handle count, action latency, scan duration, model RSS, diagnostic queue depth and checkpoint bytes. Record p50, p95, peak, final-baseline and cooldown recovery. Repeat each scenario three times where practical; store raw CSV/JSON evidence with no user content. A leak is a consistent upward trend after stabilization, not a single temporary peak.

**Targets versus evidence:** Repository docs target extension working set under 150 MB excluding Ollama, idle CPU near zero, idle inference zero, and no sustained long-session growth. These are **targets** until real installed-browser tests pass. A future embedded model needs an explicit separate RAM ceiling agreed from measurements; do not silently count model memory as “outside the product” when presenting total user-visible RAM use.

**Regression response:** If a new change increases memory or CPU, profile allocation stacks and hot paths before raising budgets. Prefer lazy iteration, pooled/reused small buffers when safe, bounded per-task lifetimes and reduced repeated work. Avoid persistent caches unless they demonstrably reduce total cost and have strict size/TTL/cleanup. Keep a safety test that verifies truncation remains fail-closed after optimization.

## V.11 Release gate matrix

| Gate | Current checkpoint | Required evidence to mark PASS |
|---|---|---|
| Source architecture | Partial | Fresh branch/PR audit, module dependency checks, exact SHA |
| Node full suite | NOT RUN on latest SHA in this session | `npm run check` exit 0 with full test report |
| Browser observer targeted tests | PASS 86/86 isolated V8 | Already recorded as targeted evidence only; native Node rerun needed |
| Chrome installed fixture | UNVERIFIED | Chrome self-test + security fixtures + performance |
| Edge installed fixture | UNVERIFIED | Edge self-test + security fixtures + performance |
| Real local Ollama | UNVERIFIED | Actual extension-origin model task, network and resource evidence |
| Windows .NET latest source | NOT RUN | Restore/build/XUnit exit 0 on exact SHA |
| Interactive Windows UIA | UNVERIFIED | Controlled WPF fixture and focus/failure tests |
| Windows production consent/recovery | NOT IMPLEMENTED / incomplete | Trusted UI, stable journal path, reconciliation test |
| Browser-to-Windows IPC | NOT IMPLEMENTED | Secure versioned bridge + disconnect/replay tests |
| Yahoo destructive workflow | UNVERIFIED / restricted | Disposable account, stable IDs, independent effect oracle |
| Long-session RAM/CPU | NOT RUN | Controlled real-device soak, no sustained growth |
| Privacy/security review | PARTIAL | Canary, prompt-injection, permissions, CSP, dependencies |
| Windows installer/update | NOT ACCEPTED | Clean install/update/uninstall and rollback |
| End-user manual accuracy | PARTIAL | Actual UI walkthroughs with versioned evidence |
| Production release | BLOCKED | All applicable gates PASS, risk sign-off and artifact provenance |

## V.12 How to write a test result into the ledger

Use this exact minimum record for every meaningful checkpoint:

```text
TEST_ID:
COMMIT_SHA:
BRANCH:
ENVIRONMENT: OS/browser/.NET/Node/model versions and hardware
COMMAND_OR_UI_STEPS:
FIXTURE_AND_INPUTS: synthetic; no real secrets
EXPECTED:
ACTUAL:
STATUS: PASS | FAIL | BLOCKED | NOT RUN | UNVERIFIED
DURATION_AND_RESOURCE_EVIDENCE:
LOG_OR_ARTIFACT_PATH:
FAILURE_ROOT_CAUSE:
FIX_COMMIT:
REGRESSION_RERUN:
LIMITATIONS:
NEXT_ACTION:
```

If the tool environment cannot run a test, record the blocker and the exact commands for another machine. Do not loop indefinitely on DNS or missing SDK. Two identical failures trigger a root-cause investigation and a materially different approach. Two cycles without measurable progress trigger a documented handoff and a move to independent work.


---
