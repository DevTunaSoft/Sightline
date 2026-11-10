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

## Browser task modes

**Observe** explains what Sightline sees without changing the page.

**Assist** allows ordinary actions while consequential actions stop for review.

**Autonomous** allows bounded multi-step execution but does not bypass safety gates.

## Pause and Cancel

**Pause** stops execution while retaining a sanitized session checkpoint.

**Cancel** stops the task and removes its resumable checkpoint.

Typed text, screenshots, and credentials are not intended to be stored in the browser checkpoint.

## Confirmations

Sightline stops for confirmation before high-impact browser actions such as destructive changes, sending/publishing, payments, account/security changes, or cross-origin navigation.

If state changes while the confirmation is open, the old confirmation is invalidated rather than blindly reused.

## Yahoo Mail

Use **Yahoo readiness** before a real Yahoo task. It is read-only.

Sightline is designed to stop for login, MFA, CAPTCHA, account recovery, or security challenges and let you handle them directly.

Permanent deletion remains more restricted than moving mail to Trash.

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

The Windows foundation currently uses bounded in-memory diagnostics. Persistent rotating logs and a user-facing diagnostics viewer are still planned.

## Current warning

Sightline is still pre-production. Do not use it for irreversible production workflows until the corresponding real-machine release gates have evidence.
\n### Interactive Windows engineering acceptance\n\nOn a real interactive Windows development machine, the controlled WPF vertical-slice can be exercised with:\n\n```powershell\n.\\tools\\test-windows.ps1 -Interactive\n```\n\nThis is intended for development acceptance only. It does not automate arbitrary desktop applications yet.\n