# CLAUDE.md — Sightline engineering dossier and working rules

Read this file first. Then read `docs/HANDOFF.md` and `docs/FEATURE_STATUS.md`. Then run the start-of-task checks in section 1 before changing anything.

If an operator's instruction in the current session conflicts with this file, follow the operator and say so. If it conflicts with a rule in section 6, stop and ask.

## 0. How to read this dossier

Every factual claim has an ID (for example `R-07`) and a status:

- **VERIFIED**: checked against the repository, git history, CI, or a primary source during the verification pass. The evidence column names it. Re-check it with the commands in Appendix A before relying on it, because the repo moves.
- **UNVERIFIED**: stated by documentation, a secondary source, or an assumption. No primary check exists. Do not present it as fact.
- **BLOCKED**: cannot be checked in this environment. The reason is given.
- **STALE**: was true at an earlier commit and is known or suspected to have changed.

Baseline for this dossier: `develop` at `fb8c9ec`, verified on 2026-11-12.

## 1. Checklists

### 1.1 Start of task

1. `git status`. The working tree must be clean, or you must know exactly what is uncommitted and why.
2. Fetch branches with the explicit refspec in section 3.1. Do not assume `origin/develop` exists locally.
3. Run `npm run check` and read the counts from the output file (section 4).
4. Read `docs/HANDOFF.md` and `docs/FEATURE_STATUS.md`. If they disagree with your measurements, trust the measurements and update the handoff in the same change.
5. Check open PRs and branches (Appendix A, check A-5) before creating anything.
6. Check the latest CI run on `develop` (section 4.3). If it is red, report that before starting new work.

### 1.2 End of task

1. `npm run check` passes, with counts you have read.
2. Every safety behavior you changed has a refusal-case test as well as a success-case test.
3. The commit exists locally. If you pushed, `git ls-remote origin refs/heads/develop` shows its hash.
4. The CI run for the pushed commit is recorded.
5. The report follows section 5.

## 2. Project facts

### 2.1 What Sightline is

| ID | Claim | Evidence | Status |
|---|---|---|---|
| P-01 | Sightline is a local-first visual AI assistant with a browser half and a Windows half. | `docs/HANDOFF.md` and `windows/README.md` | VERIFIED |
| P-02 | The browser half is a Chrome/Edge Manifest V3 extension, `extension/manifest.json`. | Manifest read; `docs/BROWSER_ACCEPTANCE.md` names Chrome and Edge | VERIFIED for MV3. Edge operation: UNVERIFIED (no Edge run exists). |
| P-03 | The planner calls a local model at `http://127.0.0.1:11434`. | `extension/vision-core.js:1` (`LOCAL_API`); `tools/ollama-acceptance.mjs:1` (`API`) | VERIFIED |
| P-04 | The Windows half targets `net8.0-windows`. | `windows/Directory.Build.props` | VERIFIED |
| P-05 | `Sightline.App` is an executable project with no UI framework in its project file. | `windows/src/Sightline.App/Sightline.App.csproj` (`OutputType Exe`, no `UseWPF`) | VERIFIED |
| P-06 | `Sightline.Windows.TestTarget` is a WPF project. | `windows/tests/Sightline.Windows.TestTarget/Sightline.Windows.TestTarget.csproj` (`UseWPF true`) | VERIFIED |
| P-07 | The Windows layer is experimental and desktop acceptance is pending. | `windows/README.md` status line | VERIFIED (as a documented status) |
| P-08 | The Windows layer uses FlaUI.UIA3 version 5.0.0. | `windows/src/Sightline.Windows/Sightline.Windows.csproj` | VERIFIED |
| P-09 | The Windows layer has no Electron, no background polling loop, and no embedded heavyweight model. | `windows/README.md` "Principles" | VERIFIED as a stated design principle. Not checked against code. |

### 2.2 Design principles

These are design rules from `docs/HANDOFF.md` and `windows/README.md`:

- Deterministic checks before any AI decision.
- Local-first. Outbound services need a decision in `docs/DECISIONS.md`.
- Fail closed on truncated observations, unknown elements, unreadable state, or ambiguity.
- One-use approvals bound to the exact action and snapshot. The window is five minutes: `MAX_CONFIRMATION_AGE_MS = 5 * 60 * 1000` in `extension/page-agent.js:19` (VERIFIED).
- Write-ahead journaling before any Windows mutation (VERIFIED in code, see W-05).
- `UnknownEffect` when an action may have happened and cannot be confirmed. Never replay it.
- Independent effect verification. A page's own success message is not proof.
- Sensitive fields are never read, typed into, or clicked autonomously.
- Bounded everything: observation size, action count, repeated actions and states, text length, page count, row count, diagnostics.

## 3. Repository and git

### 3.1 Fetching in this clone

| ID | Claim | Evidence | Status |
|---|---|---|---|
| G-01 | The clone may be shallow. A plain `git fetch origin develop` can update only `FETCH_HEAD`, after which `git show origin/develop` fails. | Observed in this session. | VERIFIED |
| G-02 | The explicit refspec below updates the remote-tracking branches. | Used successfully in this session. | VERIFIED |

```
git fetch --depth=200 origin '+refs/heads/develop:refs/remotes/origin/develop' '+refs/heads/main:refs/remotes/origin/main'
git ls-remote origin refs/heads/develop
```

Do not quote a hash from memory. Read it with `git ls-remote`.

### 3.2 Branches and history

| ID | Claim | Evidence | Status |
|---|---|---|---|
| G-03 | `develop` is at `fb8c9ec`. | `git ls-remote origin refs/heads/develop` | VERIFIED at verification time. Moves. |
| G-04 | `main` has 20 commits that `develop` lacks. | `git log --oneline origin/develop..origin/main \| wc -l` = 20 | VERIFIED |
| G-05 | `a836297` added a 312-line temporary file named `develop` at the repo root. `edc55d2` removed it. | `git show --stat a836297` and `git show --stat edc55d2` | VERIFIED |
| G-06 | The nine documentation files from `main` were ported in `fa3859d`: `.github/pull_request_template.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/DECISIONS.md`, `docs/DEVELOPMENT_LEDGER.md`, `docs/PROJECT_BRIEF_AND_TAKEOVER.md`, `docs/RELEASE_READINESS.md`, `docs/REQUIREMENTS_AND_ACCEPTANCE.md`, `docs/SOURCE_MAP.md`. | `git show --name-only fa3859d` | VERIFIED |
| G-07 | PR #8 (Windows process inspection) is open, base `develop`, head `feature/windows-process-inspection-v0`. | `gh api repos/DevTunaSoft/Sightline/pulls/8` | VERIFIED at verification time |
| G-08 | PR #8 branches from `5f19279`, an older `develop` commit, and its branch has 253 commits that `develop` lacks. | `git merge-base origin/develop origin/pr8` = `5f19279`; `git log --oneline 5f19279..origin/pr8 \| wc -l` = 253 | VERIFIED |
| G-09 | PR #8's session diff against current `develop` removes approval and journal wiring from `WindowsAutomationSession`. | Observed in this session. | VERIFIED at verification time. STALE if PR #8 is rebased. |
| G-10 | The rebased port is on `feature/windows-process-inspection-v0-rebased`. It has no CI run. | `git ls-remote` lists the branch; `gh run list --branch feature/windows-process-inspection-v0-rebased` returns nothing | VERIFIED |
| G-11 | Other remote branches exist: `feature/windows-foundation-v0` and `feature/windows-window-discovery-v0`. Their content and status were not reviewed. | `git ls-remote origin` | VERIFIED that they exist. Content: UNVERIFIED. |

### 3.3 Branch rules

- Work on `develop`. Do not work on `main` unless the operator says so.
- Do not force-push any branch.
- Do not merge `main` into `develop` wholesale. Port single files or docs only after review, and name the source commit.
- Do not discard or rewrite main-only history.
- Do not create duplicate branches or PRs. Check first (A-5).
- Do not merge PR #8 as-is (G-09).
- Experiment branches get a clearly named prefix, and the operator must be told the name.
- Never touch a branch the operator did not name, other than `develop`.

### 3.4 Commits, pushes, and PRs

- Small commits. The message says why.
- Push only when `npm run check` passes locally. Say so in the summary.
- Never commit secrets, tokens, account exports, personal email addresses, or personal data.
- Every commit ends with:

```
Co-Authored-By: <real model name> <noreply@anthropic.com>
Claude-Session: <session URL, if the operator gives one>
```

- Add no attribution line the operator did not ask for.
- Open a PR only when the operator asks, after checking for a duplicate.
- If `gh pr view` or `gh issue view` fails, use `gh api` REST. GraphQL lookups failed in this environment.

## 4. Commands, tests, and CI

### 4.1 Commands

| Command | What it does | Runs in the Linux sandbox? |
|---|---|---|
| `npm run check` | Syntax-checks the extension modules named in the script, runs the release audit, runs the Node suite. | Yes |
| `node --test tests/*.test.js` | Node suite only. | Yes |
| `node tools/release-audit.mjs` | Version alignment, manifest permission allowlist, remote-URL literal rule. | Yes |
| `node tools/serve-acceptance.mjs` | Serves `tests/fixtures/` on `127.0.0.1:8765` (override with `SIGHTLINE_ACCEPTANCE_PORT`). | Yes |
| `node tools/ollama-acceptance.mjs` | Live check against a local Ollama model. | Only with Ollama running locally |
| `tools\start-browser-acceptance.cmd` | Windows launcher for installed-browser acceptance. Starts the fixture server and opens the page. | No |
| `tools\test-windows.ps1` | Restore, build, Core tests, Windows safety tests, resource probe. Writes evidence to `.artifacts/windows-foundation`. | No: needs Windows and the .NET 8 SDK |
| `tools\test-windows.ps1 -Interactive` | Adds the real desktop vertical-slice test. | No: needs an interactive desktop |

| ID | Claim | Evidence | Status |
|---|---|---|---|
| T-01 | `npm run check` exits 0 with 307 tests passing and 0 failing. | Re-run during verification: `# tests 307`, `# pass 307`, `# fail 0`, exit 0 | VERIFIED at `fb8c9ec` |
| T-02 | The repo has 37 Node test files under `tests/`. | `ls tests/*.test.js \| wc -l` | VERIFIED |
| T-03 | Every extension module is named in the `check` script. | Script comparison in this session: unchecked list was empty | VERIFIED |
| T-04 | Node 22 is used in the sandbox and in CI. | `node -v` = v22.23.4; `.github/workflows/ci.yml` sets Node 22 | VERIFIED |
| T-05 | There are no npm dependencies. | `package.json` has empty `dependencies` and `devDependencies` | VERIFIED |
| T-06 | `tools/test-windows.ps1` runs restore, build, Core tests, Windows safety tests, and a resource probe, in that order, then the interactive test only with `-Interactive`. | Read from `tools/test-windows.ps1` lines 21–56 | VERIFIED by reading the script. Not run here (BLOCKED: no .NET SDK). |
| T-07 | Installed-browser acceptance needs Node.js 20 or newer. | `docs/BROWSER_ACCEPTANCE.md`; launcher message | VERIFIED as documented |

### 4.2 CI

`.github/workflows/ci.yml`:

| ID | Claim | Evidence | Status |
|---|---|---|---|
| C-01 | Triggers: pushes to `main` and `develop`, and pull requests into them. | `ci.yml` lines 3–7 | VERIFIED |
| C-02 | Jobs: `validate` (ubuntu-latest, Node 22), `windows-foundation` (windows-latest, .NET 8.0.x), `package-extension` (ubuntu-latest). | `ci.yml` | VERIFIED |
| C-03 | `windows-foundation` builds, runs Core and safety tests, captures resource baselines and a repeated-session trend, and uploads `sightline-windows-test-results-<sha>`. | `ci.yml` lines 30–61 | VERIFIED |
| C-04 | Runs cancel in progress for the same ref. | `ci.yml` concurrency block | VERIFIED |
| C-05 | `fb8c9ec` CI run 43158936134: `validate`, `windows-foundation`, and `package-extension` all succeeded. | `gh run view` on the latest develop run | VERIFIED |
| C-06 | `29a35ad` CI run 43158234847 succeeded. `e643f00` CI run 43150832913 succeeded. `28a4e2c` CI run 43150582819 succeeded. | `gh run list --branch develop` | VERIFIED |
| C-07 | Hosted CI does not replace interactive desktop acceptance. | Stated in `windows/README.md` | VERIFIED as a documented position |

Hosted CI verifies builds and tests on Windows. It does not drive a real desktop. Say so in every Windows report.

### 4.3 Start-of-task CI check

```
gh run list --branch develop --limit 3 --json databaseId,headSha,conclusion,workflowName --jq '.[]|"\(.databaseId) \(.headSha[0:7]) \(.workflowName) \(.conclusion)"'
```

If the latest run is red, report the run ID and the failing job before starting new work.

## 5. Verification labels and report format

Labels:

- **PASS**: a command or test you ran, which you name.
- **FAIL**: ran and failed. Give the name and the first error line.
- **BLOCKED**: cannot run here. Give the reason (no desktop, no Chrome, no .NET SDK, no Ollama, no network).
- **NOT RUN**: could run here and did not. Give the reason.
- **UNVERIFIED**: stated by documentation or assumption without evidence.

A passing fixture is not evidence that a live site works. Fixtures show only that the code matches the fixture's format.

Report template:

```
Changed: <one line per file>
Commit: <hash on develop, or "not committed">
Checks: npm run check → <n> pass / <n> fail
CI: <run ID and conclusion for the pushed commit, or "not pushed">
Live or other: <label> — <what, and why>
Open: <what is still unverified or stopped>
```

Keep it short. Do not recap each step.

## 6. Safety rules

These protect users. Weakening any of them needs an explicit operator decision and an entry in `docs/DECISIONS.md`. The "Evidence" column shows where each rule is enforced.

| ID | Rule | Evidence | Status |
|---|---|---|---|
| S-01 | High-risk actions need one-use confirmation bound to the exact action. | `extension/safety-gate.js`; `extension/page-agent.js` (pending confirmation, binding check) | VERIFIED |
| S-02 | Current classifier outputs: "Archive all" high, "Reject all" high, "Delete permanently" high, "Move to Trash" high, "Mark all as read" normal, "Empty Trash" blocked. | Probe run in this session against `classifyActionRisk` at `fb8c9ec`; tests in `tests/safety-gate.test.js` and `tests/safety-gate-bulk-actions.test.js` | VERIFIED at `fb8c9ec` |
| S-03 | Blocked actions are refused without a confirmation prompt (`ACTION_BLOCKED`). | `extension/page-agent.js` (returns `ACTION_BLOCKED` when `confirmationRequired` is false) | VERIFIED |
| S-04 | Yahoo Mail bulk Trash requires a search route, a search control, and a parseable count. | `extension/skills/yahoo-mail.js` `checkSkillDestructiveScope`; tests in `tests/yahoo-mail-analysis.test.js` | VERIFIED |
| S-05 | The Yahoo count parser accepts only `Showing X–Y of Z` and `N results`. `N messages` counting was removed deliberately. | `extension/skills/yahoo-mail.js` regexes at lines 42–43; commit `6d8c345` (from earlier session notes) | VERIFIED for the regexes. The commit message was not re-read in this pass. |
| S-06 | Free-text success messages never certify Trash. Count changes and independent checks are the evidence. | `tests/yahoo-mail-analysis.test.js` (Trash verification expects `verified: null`) | VERIFIED |
| S-07 | Cancel during confirmation returns `ABORTED`, which maps to `TASK_CANCELLED`. | `extension/browser-task-runner.js` (`if (signal?.aborted) return { ok: false, code: 'ABORTED', ... }`) | VERIFIED |
| S-08 | Cancel during a mutating action returns `UNKNOWN_EFFECT`, because the page may already have changed. | `extension/action-executor-core.js` (`MUTATING_ACTIONS`, abort branch) | VERIFIED |
| S-09 | Handler exceptions during a mutating action return `UNKNOWN_EFFECT` and never echo provider error text. | `extension/action-executor-core.js` catch branch | VERIFIED |
| S-10 | Stale snapshots and stale refs are refused. The page agent re-observes the live page before executing. | `extension/page-agent.js` (`STALE_SNAPSHOT`, live refresh); `extension/action-executor-core.js` (`STALE_REF`) | VERIFIED |
| S-11 | Sensitive targets cannot be clicked, typed into, or read autonomously. | `extension/dom-action-adapter.js` (`SENSITIVE_FIELD` branches) | VERIFIED |
| S-12 | Windows password reads fail closed. | `windows/src/Sightline.Windows/FlaUiActionExecutor.cs:135` (`Safe(() => element.Properties.IsPassword.Value, true)`) | VERIFIED |
| S-13 | The debugger path is opt-in. `useDebuggerClicks` defaults to false. | `extension/browser-task-runner.js` option default | VERIFIED |
| S-14 | The debugger path attaches only to the approved task tab, validates coordinates, and always detaches. | `extension/cdp-input.js` (`TAB_NOT_APPROVED`, `BAD_COORDINATES`, `finally` detach); tests in `tests/cdp-input.test.js` | VERIFIED |
| S-15 | The debugger path clicks only after two locates agree on the same point. | `extension/browser-task-runner.js` (`debuggerClickApproved`); `extension/click-point-core.js`; `tests/debugger-click-runner.test.js` | VERIFIED |
| S-16 | The debugger path does not hide any browser banner, and no Chrome flag that suppresses it is used. | `grep -rn "silent-debugger" extension tools` returns nothing | VERIFIED that the repo does not suppress it. Whether Chrome shows a banner: see S-17. |
| S-17 | Chrome shows a "debugging this browser" banner while an extension is attached. | Not in `developer.chrome.com` debugger reference (checked in this pass). Reported by secondary sources and a community issue report. | UNVERIFIED. Test it in Chrome before stating it. |
| S-18 | The release audit allowlists exactly `sidePanel`, `activeTab`, `debugger`, `scripting`, `storage`. | `tools/release-audit.mjs:32` | VERIFIED |
| S-19 | The only URL literal exception is the OOXML namespace prefix `http://schemas.openxmlformats.org/`. | `tools/release-audit.mjs:79` | VERIFIED |
| S-20 | The Ollama acceptance script rejects cloud-tagged models. | `tools/ollama-acceptance.mjs:2` (`CLOUD_TAG`), lines 53 and 75 | VERIFIED |
| S-21 | Research queries pass through redaction for secrets, emails, paths, URLs, IP addresses, and card-like numbers. | `extension/research-core.js` (`REDACTIONS`); `tests/research-core.test.js` | VERIFIED |
| S-22 | Web content is data, not instructions. | Design rule in `docs/HANDOFF.md` | VERIFIED as a documented rule. Enforcement for a future search backend is not built. |
| S-23 | No anti-bot evasion: no disguising automation, no identity rotation, no fingerprint spoofing, no CAPTCHA or bot-check bypass. | Operator instruction in this session; this dossier | VERIFIED as an operator rule |
| S-24 | No outbound model or search call without a decision. | `docs/DECISIONS.md` (decision required); no outbound call exists in `extension/` | VERIFIED that no outbound model call exists. Check the decisions log before adding one. |

## 7. Architecture

### 7.1 Browser runtime

Every module in `extension/`, grouped by role. All 32 top-level `.js` files are listed. Run Appendix A, check A-8, to confirm the list has not drifted.

| Group | Modules | Role |
|---|---|---|
| Extension shell | `background.js`, `panel.html`, `panel.js`, `agent-panel.js`, `manifest.json` | Lifecycle, side panel, and the panel UI. |
| Page runtime | `page-agent.js`, `page-agent-bootstrap.js` | Runs in the page. Handles `SIGHTLINE_PING`, `SIGHTLINE_OBSERVE`, `SIGHTLINE_EXECUTE`, and `SIGHTLINE_LOCATE`. Holds the single pending confirmation. The bootstrap sets it up. |
| Observation | `page-observer.js`, `page-observer-core.js`, `ref-registry.js` | Bounded semantic snapshots, refs, sensitive-field detection. |
| Action protocol | `action-protocol.js`, `action-executor-core.js`, `dom-action-adapter.js` | Validates actions, runs them through an adapter, returns receipts, and maps aborts and failures to codes. The DOM adapter refuses sensitive targets. |
| Bridge | `browser-bridge.js` | Talks to tabs: observe, execute, task-tab lookup, screenshot capture. |
| Planning | `planner-client.js`, `planner-core.js` | Bounded planner input and calls to the local model. Adds system guardrail messages around the user JSON. |
| Vision | `client.js`, `vision-core.js` | Bounded screenshot analysis, used only as a fallback. Endpoint `LOCAL_API`. At most 2 fallbacks per task (`MAX_VISION_FALLBACKS_PER_TASK`). |
| Task loop | `task-loop-core.js`, `browser-task-runner.js` | Observe, plan, confirm, execute, verify, checkpoint. `TaskProgressGuard` limits repeats. |
| Safety | `safety-gate.js`, `skill-blockers.js` | Risk classification and gating. |
| Skills | `skill-registry.js`, `skills/yahoo-mail.js` | Site-specific checks, scope rules, effect verification. Yahoo Mail is the only skill. |
| Checkpoints | `task-checkpoint.js` | Saves and restores progress. |
| Diagnostics | `diagnostics-core.js`, `performance-core.js` | Bounded ledgers and timing. |
| Acceptance | `browser-self-test.js`, `local-ai-self-test.js`, `yahoo-readiness.js` | Self-tests for installed plumbing, the local model, and Yahoo page readiness. |
| Opt-in extras | `export-core.js`, `collect-core.js`, `research-core.js`, `cdp-input.js`, `click-point-core.js` | IP extraction and `.xlsx` writer; cross-page collector; redacted research queries; debugger input; click-point validation. |

Remaining modules not in the groups above: none. Count check: 32.

### 7.2 Flow of one action

1. The page agent observes and returns a snapshot with a `snapshotId`.
2. The planner proposes one action that refers to a ref in that snapshot.
3. The page agent validates the action, re-observes the live page, checks that the ref and snapshot still match, and runs the gate.
4. If confirmation is needed, the page agent returns `CONFIRMATION_REQUIRED` with the target, risk, and a `confirmationKey`. The runner asks the operator. The binding that checks the key against the action is held inside the page agent (`confirmationBinding` in `extension/page-agent.js`), not returned to the runner.
5. If the operator confirms and the opt-in debugger path is on, a click goes through `debuggerClickApproved`: two locates must agree and pass `click-point-core`, then `cdp-input` clicks. Otherwise the page agent runs the confirmed action.
6. After execution, the runner runs the skill's independent effect check, if one applies.
7. The checkpoint and timeline update. The loop stops on done, a limit, cancellation, or an unrecoverable error.

Verification note: the debugger path's receipt reports `ok: true` once input is dispatched. It does not check the page afterward. Same as page-script clicks today. See the open items in section 9.

### 7.3 Windows runtime

| Project | Role | Status |
|---|---|---|
| `windows/src/Sightline.Core` | Contracts (`Actions.cs`, `Observation.cs`) and core logic. Defines `SightlineErrorCode.UnknownEffect`. | VERIFIED by file presence and grep |
| `windows/src/Sightline.Windows` | FlaUI UI Automation integration. `FlaUiActionExecutor` (see W-01 to W-05). | VERIFIED |
| `windows/src/Sightline.App` | Executable. No UI framework configured (P-05). | VERIFIED |
| `windows/tests/Sightline.Core.Tests` | Core tests. | VERIFIED |
| `windows/tests/Sightline.Windows.Tests` | Windows safety-layer tests. | VERIFIED |
| `windows/tests/Sightline.Windows.Acceptance` | Acceptance tests for the desktop path. `Program.cs`. | VERIFIED |
| `windows/tests/Sightline.Windows.TestTarget` | WPF target app the acceptance tests drive (P-06). | VERIFIED |

| ID | Claim | Evidence | Status |
|---|---|---|---|
| W-01 | `FlaUiActionExecutor` checks approval before anything else. | `FlaUiActionExecutor.cs:85` (`_approval?.IsApproved`) | VERIFIED |
| W-02 | It then checks the journal has no pending entry (`HasPending`). | `FlaUiActionExecutor.cs:94–101` | VERIFIED |
| W-03 | It writes a journal entry (`TryBegin`) before the mutation. If that fails, it returns `UnknownEffect` and does not act. | `FlaUiActionExecutor.cs:150–158` | VERIFIED |
| W-04 | `IsPassword` defaults to true when unreadable, so the password path fails closed. | `FlaUiActionExecutor.cs:135` | VERIFIED |
| W-05 | UIA `Invoke` acceptance is not proof of an application effect. | `FlaUiActionExecutor.cs:179` comment; `:272` detail text | VERIFIED |
| W-06 | The xUnit2031 rule is fixed by using `Assert.Single(collection, predicate)`. | `MutationJournalTests.cs:98`; `OneShotDesktopActionApprovalTests.cs:120` | VERIFIED in source. Build passed in CI at `5d64159` and later. |
| W-07 | No .NET SDK is available in the sandbox, so no local C# build has run here. | `command -v dotnet` returned nothing | VERIFIED |

## 8. Testing conventions

- Node tests use `node:test` and `node:assert/strict`.
- Files are `tests/<module>.test.js`, named after the module they cover.
- Every safety change needs a refusal test: sensitive target, stale snapshot, unapproved tab, moved element, failed attach, blocked action, cancel during confirmation.
- Fake browsers use the real message types (`SIGHTLINE_PING`, `SIGHTLINE_OBSERVE`, `SIGHTLINE_EXECUTE`, `SIGHTLINE_LOCATE`). A fake that reports a viewport or response the real page would not report hides bugs.
- Fixtures must match a real captured page. Do not invent a format and call it verified.
- Order matters in the Yahoo tests. The scope check reads `elements[0]`, which must be the Trash button.
- A test that treats a free-text success line as proof of deletion violates S-06. Fix the test, not the rule.

## 9. Open items and known gaps

| ID | Gap | Status |
|---|---|---|
| X-01 | Debugger clicks have no outcome check after dispatch. A click that lands on the wrong element still reports success. | OPEN |
| X-02 | Debugger clicks have not run in Chrome. Tests use fake browser objects. | BLOCKED on a Chrome run |
| X-03 | Installed-browser acceptance (section 10) has not been run. | BLOCKED (needs Chrome on Windows) |
| X-04 | Live Ollama acceptance has not been run. | BLOCKED (needs Ollama) |
| X-05 | Live Yahoo Mail page layout has not been captured. Fixtures match the parser format, not a live page. | UNVERIFIED |
| X-06 | Windows desktop acceptance has not been run on a real desktop. | BLOCKED |
| X-07 | Windows build and tests passed in CI only. | VERIFIED in CI (C-05, C-06). Local build: BLOCKED (W-07). |
| X-08 | The process-inspection port is not built or tested on Windows. | BLOCKED (no run) |
| X-09 | PR #8 must be rebased or replaced before merge (G-08, G-09). | OPEN, needs operator decision |
| X-10 | The research feature has no search backend. | OPEN, needs operator decision (section 11) |
| X-11 | The collector, IP extraction, and `.xlsx` writer work in tests. The end-to-end browser flow that uses them is not built. | OPEN |
| X-12 | The planning model is a local model. Capability on messy real pages is untested. | OPEN, needs a benchmark (section 12, step 6) |

## 10. Installed-browser acceptance (Windows, manual)

This checks the real extension in a real browser. It does not use a model.

1. Install Node.js 20 or newer (T-07).
2. Open `chrome://extensions` (or `edge://extensions`). Turn on Developer mode.
3. Choose **Load unpacked**. Select the repository's `extension` folder.
4. Run `tools\start-browser-acceptance.cmd`. It serves `tests/fixtures/` at `http://127.0.0.1:8765/`.
5. Open that address in the same browser.
6. The self-test runs these checks. The names are from `extension/browser-self-test.js`:
   - Observe fixture
   - Dedicated localhost fixture
   - Semantic controls discovered
   - Sensitive fields redacted
   - Opaque frame reported
   - Same-origin frame reported
   - Top-page search box found, type action succeeded
   - Search button found, top-page click succeeded
   - Top-page state change verified
   - Same-origin iframe controls found, frame metadata present, iframe type succeeded, iframe click succeeded, iframe state change visible
   - Destructive fixture control found, destructive action requires confirmation
   - Cross-origin fixture link found, cross-origin link requires confirmation
7. The self-test returns `SELF_TEST_WRONG_PAGE` and takes no action unless the active page is the fixture on `localhost` or `127.0.0.1`.

Record each check as PASS, FAIL, or BLOCKED. Do not mark the whole procedure PASS from a partial run. The debugger click path is not in this self-test. Test it as a separate step on the same fixture.

## 11. Open decisions (ask the operator first)

- Choosing an outbound search provider for research, or whether one is allowed at all (conflicts with local-first, S-24).
- Choosing or changing the planning model. Claude in Chrome relies on a much larger cloud model (UNVERIFIED: no primary source for its model); Sightline's local model is the main capability gap.
- Adding a UI setting for debugger clicks, or changing its default (S-13).
- Changing the Yahoo count or destructive-scope rule (S-04, S-05).
- Porting main-only commits beyond the nine documentation files (G-06).
- Merging or closing PR #8, or replacing it with the rebased branch (G-07 to G-10).
- Adding an npm dependency (T-05) or an extension permission (S-18).
- Enabling any cloud-model path (S-20, S-24).

## 12. Next work, in order

1. Confirm the baseline: fetch (G-02), `npm run check` (T-01), latest CI (C-05).
2. Run the installed-browser acceptance (section 10) and record each check.
3. Test whether Chrome shows the debugging banner, and record the result, which resolves S-17.
4. Add a panel setting for debugger clicks, off by default, with a label that matches what step 3 shows. Test it. Do not change the default.
5. Run the debugger click path on the local fixture in Chrome. Record the result.
6. Add an outcome check after debugger clicks (X-01).
7. Decide the planning-model question with the operator (section 11). Benchmark the general task loop on 20–30 saved real pages.
8. Build the browser task flow end to end: open a URL, search, follow results across pages, collect IP addresses, export a workbook (X-11).
9. Widen site coverage beyond Yahoo Mail only after step 7 passes.
10. Windows: verify the rebased process-inspection branch in CI, then the approval and journal production paths, then desktop acceptance on a real machine.

## 13. How to work

- Read a file before editing it. Do not edit from memory.
- Make the smallest change that fixes the cause. Do not refactor unrelated code in the same commit.
- Add a test for every behavior change, including refusal cases for safety changes.
- Name each new extension module in `package.json`'s `check` script. An unnamed module is not checked (T-03).
- Keep every new collection or buffer bounded, and say what the bound is.
- Label each claim you make with the status vocabulary in section 5.
- When unsure, say so. Do not round up.
- Ask one specific question rather than guess at anything that touches a safety rule.
- Do not say the app works on a site, browser, or desktop unless a labeled test or run shows it.
- Keep summaries short.

## 14. Known pitfalls (from earlier sessions)

- **Shallow clone.** Use the refspec in section 3.1. A plain fetch may update only `FETCH_HEAD`.
- **Moving `develop`.** Re-read `git ls-remote` before quoting a hash.
- **"Repository moved" push notice.** It can appear on a successful push. Confirm with `git ls-remote`.
- **Planner payloads.** Find the user message by role. The planner adds system messages around it (P-03 area, `planner-core.js` lines 93, 108, 112).
- **Viewport in locate results.** `validateLocateResult` needs the viewport from the locate result. Passing `null` makes every debugger click refuse.
- **Sandbox classifier.** Running `npm run check` in a separate worktree was once denied. Run it in the attached clone.
- **Feature branches get no CI.** Say so instead of reporting green (C-01, G-10).
- **No .NET in the sandbox** (W-07). Do not claim a local C# build.
- **Interactive checks need a desktop.** Chrome and WPF/UI Automation results cannot come from this sandbox.
- **Live pages differ from fixtures** (X-05).
- **Stale numbers.** A recommendation text the operator pasted in an earlier session cited eight JavaScript failures and 17 main-only commits. Those figures are out of date and are not in `docs/HANDOFF.md`. Current: 307 tests passing (T-01), 20 main-only commits (G-04).

## Appendix A. Re-verification commands

Run these to re-check the VERIFIED items. Each prints what it checks.

```
# A-1 Baseline
git status --short
git ls-remote origin refs/heads/develop | cut -c1-7                 # G-03
npm run check > /tmp/check.log 2>&1; echo "exit=$?"; grep -E "^# (tests|pass|fail)" /tmp/check.log    # T-01

# A-2 Commits exist (C-05, C-06, G-05, G-06)
for h in fb8c9ec 29a35ad e643f00 28a4e2c fa3859d a836297 edc55d2; do git log -1 --format='%h %s' $h; done

# A-3 Main-only count (G-04)
git fetch --depth=300 origin '+refs/heads/main:refs/remotes/origin/main'
git log --oneline origin/develop..origin/main | wc -l

# A-4 PR #8 and its branch point (G-07, G-08)
gh api repos/DevTunaSoft/Sightline/pulls/8 --jq '.state+" "+.head.ref+" "+.base.ref'
git fetch origin 'refs/pull/8/head:refs/remotes/origin/pr8'
git merge-base origin/develop origin/pr8 | cut -c1-7
git log --oneline 5f19279..origin/pr8 | wc -l

# A-5 Branches and duplicates (G-10, G-11)
git ls-remote origin | awk '{print $2}' | grep -E "feature|develop|main"
gh run list --branch feature/windows-process-inspection-v0-rebased --limit 3

# A-6 CI (C-05, C-06)
gh run list --branch develop --limit 4 --json databaseId,headSha,conclusion,workflowName --jq '.[]|"\(.databaseId) \(.headSha[0:7]) \(.workflowName) \(.conclusion)"'

# A-7 Safety classifier probe (S-02)
node --input-type=module -e "import {classifyActionRisk} from './extension/safety-gate.js'; for (const l of ['Archive all','Reject all','Empty Trash','Delete permanently','Mark all as read','Move to Trash']) console.log(l, classifyActionRisk({action:'click',ref:'@e1'},{ref:'@e1',role:'button',name:l,sensitive:false}).level)"

# A-8 Module list (7.1) and check coverage (T-03)
ls extension/*.js | wc -l
node -e "const s=require('./package.json').scripts.check; const m=[...s.matchAll(/extension\/([\w-]+)\.js/g)].map(x=>x[1]); const fs=require('fs'); console.log('unchecked:', fs.readdirSync('extension').filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3)).filter(x=>!m.includes(x)));"

# A-9 Safety constants and rules (S-03, S-05, S-07, S-08, S-13, S-18, S-19, S-20)
grep -n "MAX_CONFIRMATION_AGE_MS =" extension/page-agent.js
grep -n "MAX_VISION_FALLBACKS_PER_TASK =" extension/browser-task-runner.js
grep -n "useDebuggerClicks = false\|useDebuggerClicks === true" extension/browser-task-runner.js
grep -n "allowedPermissions=" tools/release-audit.mjs
grep -n "schemas.openxmlformats" tools/release-audit.mjs
grep -n "CLOUD_TAG" tools/ollama-acceptance.mjs
grep -rn "silent-debugger" extension tools || echo "no silent banner flag"

# A-10 Windows evidence (W-01 to W-05)
sed -n 85p windows/src/Sightline.Windows/FlaUiActionExecutor.cs
sed -n 94,101p windows/src/Sightline.Windows/FlaUiActionExecutor.cs
sed -n 135p windows/src/Sightline.Windows/FlaUiActionExecutor.cs

# A-11 Project types (P-05, P-06)
grep -n "OutputType\|UseWPF" windows/src/Sightline.App/*.csproj windows/tests/Sightline.Windows.TestTarget/*.csproj

# A-12 Local .NET availability (W-07)
command -v dotnet || echo "no dotnet"
```

## Appendix B. Document history

- Dossier rewritten on 2026-11-12 after a verification pass against `fb8c9ec`. Corrections from the earlier draft: Windows UI framework (P-05, P-06), safety levels for "Empty Trash" and "Delete permanently" (S-02), the main-only commits (G-05), PR #8 branch size (G-08), the approval window (five minutes), the vision endpoint location (P-03), and the stale-number attribution (section 14).
- The debugging-banner claim was downgraded from fact to UNVERIFIED (S-17) after the Chrome debugger reference was found silent on it.
