# Sightline Beginner User Manual

## What Sightline is becoming

Sightline is being built as a lightweight Windows application that can see and understand software, safely act through Windows UI Automation, and use the existing Chrome/Edge extension as its browser companion.

The current usable alpha remains the browser extension. The standalone Windows application is an engineering preview and is **not yet an end-user release**.

## Current browser alpha

The extension can:
1. observe the webpage you are looking at,
2. understand buttons, fields, links, text, and page state,
3. use local Ollama AI when reasoning is needed,
4. perform bounded browser actions,
5. verify supported effects,
6. stop when something becomes unsafe or unclear.

### Install in Chrome

1. Download or clone the Sightline repository.
2. Open `chrome://extensions`.
3. Turn **Developer mode** on.
4. Click **Load unpacked**.
5. Select the repository's `extension` folder.
6. Pin Sightline if desired.

### Install in Edge

Use the same process from `edge://extensions`.

## Test browser plumbing first

1. Double-click `tools\start-browser-acceptance.cmd`.
2. Open Sightline on the local test page.
3. Click **Run browser self-test**.
4. Confirm the reported checks pass before troubleshooting AI.

## Local AI for the browser alpha

Sightline currently supports a local Ollama endpoint.

1. Install and start Ollama.
2. Install a compatible local model.
3. Configure Ollama to allow Sightline's exact extension origin.
4. Restart Ollama.
5. In Sightline, load installed models and run **Test local AI**.

Do not use a wildcard extension origin unless you intentionally want every installed extension to contact Ollama.

### Large pages and local-model context limits

Sightline sends a **bounded, simplified description of the webpage** to local Ollama instead of the entire page. If a page is very large, some controls may not be included in what the model sees. The model is not allowed to act on controls omitted from its view. If you see **Planner prompt exceeds conservative local context budget**, narrow the page using the site's search or filter controls and start again. Do not repeatedly retry a destructive task after an uncertain action.

Text inside webpages and emails is treated as untrusted data, not instructions. These are experimental safeguards; compatibility with every local model and language has not been verified.

## Browser task modes

**Observe** explains what Sightline sees without changing the page.

**Assist** allows ordinary actions while consequential actions stop for review.

**Autonomous** allows bounded multi-step execution but does not bypass safety gates.

The browser observer also limits how many page nodes it inspects during one scan. On an exceptionally large webpage, or a page with too many nested frames, Sightline may report a **truncated or incomplete observation** and refuse a consequential action. This prevents excess memory/CPU usage and guessing about controls it has not inspected. You can narrow the page using its search or filters, then try again. The revised scanning code has passed targeted tests but still requires real Chrome/Edge memory and performance testing.

### Low-memory behavior in the current browser alpha

Sightline keeps a limited set of webpage controls in memory and releases those references when the page observation changes. Pauses between actions do not require a continuously running background monitor. Repeated short waits clean up their cancellation listeners. These safeguards are present in source, but total memory usage still requires testing in installed Chrome and Edge.

## Pause and Cancel

**Pause** stops execution while retaining a sanitized session checkpoint.

**Cancel** stops the task and removes its resumable checkpoint.

Typed text, screenshots, and credentials are not intended to be stored in the browser checkpoint.

### Unknown action result and crash recovery

If Sightline reports **ACTION_RECONCILIATION_REQUIRED**, an earlier browser operation may already have changed the website before an interruption. Sightline refuses to repeat the action automatically. Inspect the site's current state yourself (for example, whether a message was moved, sent, or deleted), then use **Cancel** to close the previous checkpoint before creating a new task. An error does **not** prove that the prior action had no effect. This also applies when a click, send, field edit, or navigation is interrupted after it begins: Sightline treats the result as unknown instead of automatically performing it again.

If Sightline cannot save a safety checkpoint, it blocks the next action rather than running without recovery evidence. The safeguards are committed as experimental code but **not yet verified in installed Chrome/Edge**.

## Confirmations

Sightline stops for confirmation before high-impact browser actions such as destructive changes, sending/publishing, payments, account/security changes, or cross-origin navigation.

If state changes while the confirmation is open, the old confirmation is invalidated rather than blindly reused.

**Confirmation safety (experimental):** Each approval applies to one specific action and can be used only once. It expires automatically after five minutes, without a background timer. If an old confirmation is rejected, begin a fresh review; do not assume the earlier action failed. This source change has not yet been verified inside installed Chrome or Edge.

## Yahoo Mail

Use **Yahoo readiness** before a real Yahoo task. It is read-only.

Sightline is designed to stop for login, MFA, CAPTCHA, account recovery, or security challenges and let you handle them directly.

Permanent deletion remains more restricted than moving mail to Trash.

**Select all is currently restricted:** Sightline refuses bulk Trash when Yahoo's Select all checkbox is active because it cannot yet prove which messages, including results beyond the visible page, would be affected. This remains blocked even on a search page until verified message identities are supported.

**Important current alpha limitation:** Moving Yahoo messages to Trash can change the mail account even when Sightline reports **NO_VERIFIED_EFFECT** or **ACTION_RECONCILIATION_REQUIRED**. Pagination, disappearing preview rows, and text from an email are not sufficient to prove the intended messages moved. Sightline deliberately stops instead of automatically retrying an uncertain bulk action. Before taking another action, personally check the exact messages in the search results and in Trash. Do not repeatedly approve or rerun the same move until the earlier result is reconciled. The browser skill's stronger verification has not been accepted on a real Yahoo account.

**Dynamic webpages:** A changing clock or advertisement is not reliable evidence that a consequential button worked. Sightline now looks for structural changes to the target (for example, a control disappears or its checked state changes) where available. A lack of structural evidence may stop a task even when the action occurred; inspect the application before retrying.

## Windows engineering preview

The Windows foundation currently includes:
- bounded UI Automation observation,
- session-scoped element references,
- stale-reference rejection,
- semantic UIA Invoke and SetValue code paths,
- SetValue readback verification,
- bounded diagnostics,
- resource counters for RAM/handles/threads,
- automated Windows build and safety tests.

It does **not** yet have a normal end-user GUI, installer, complete focus protection, or real-desktop acceptance evidence.

**Windows approvals (engineering preview):** The Windows foundation now has a one-use approval mechanism. A specific action can be approved only for a short period and cannot reuse an approval after it is consumed or the observed target changes. The feature retains a small fingerprint instead of the text typed into a field. The full user-facing review and confirmation screen has **not** been completed, so this is not an end-user-ready Windows automation feature. The included acceptance runner can use the mechanism only against its disposable test application.

**Windows recovery safeguard (engineering preview):** Sightline now requires a durable, single-action journal before performing an approved Windows UI Automation mutation. If an action is interrupted or cannot be verified, the journal records that the result is uncertain and blocks further Windows mutations, including after a restart. This is intentional: **do not repeat the action or delete the pending record without independently checking the application**. An end-user recovery dialog and a stable production storage location are still being developed. The Windows implementation and acceptance tests have not yet been run on the newest source revision.

**Windows value-entry safety:** Sightline does not put the text from a Windows input field into the action result. If it reports `UnknownEffect` after trying to change a field, the field may already have changed. Examine the application before attempting the operation again. This protection is implemented in source but has not passed real-Windows acceptance yet.

### Developer verification

On Windows with the .NET 8 SDK:

```powershell
.\tools\test-windows.ps1
```

The script restores, builds, runs the Windows/core safety tests, captures a lightweight process-resource baseline, and writes bounded evidence under:

```text
.artifacts\windows-foundation
```

This is an engineering verification path, not the final user experience.

## Diagnostics

Browser reports are exportable from the extension and intentionally omit sensitive action payloads/screenshots.

The Windows foundation now records bounded, sanitized structured UIA diagnostics in memory. An optional rotating JSONL sink is implemented with fixed queue/file/retention limits and secret redaction, but persistent logging is not yet exposed as a normal end-user setting. A user-facing diagnostics viewer is still planned.

## Current warning

Sightline is still pre-production. Do not use it for irreversible production workflows until the corresponding real-machine release gates have evidence.

### Interactive Windows engineering acceptance

On a real interactive Windows development machine, the controlled WPF vertical slice can be exercised with:

```powershell
.\tools\test-windows.ps1 -Interactive
```

This is intended for development acceptance only. It does not automate arbitrary desktop applications yet.
