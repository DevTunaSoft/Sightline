# Sightline Beginner User Manual

This guide assumes you do not want to write code.

## What Sightline is

Sightline is a browser side panel that can:
1. see the webpage you are looking at,
2. understand buttons, fields, links, text, and page state,
3. use local AI when reasoning is needed,
4. perform browser actions,
5. verify what happened,
6. stop when something becomes unsafe or unclear.

## Install the current alpha

### Chrome

1. Download or clone the Sightline repository.
2. Open Chrome.
3. Type `chrome://extensions` into the address bar.
4. Turn **Developer mode** on.
5. Click **Load unpacked**.
6. Choose the `extension` folder inside Sightline.
7. Pin Sightline if you want quick access.

### Edge

Use the same steps, starting at `edge://extensions`.

## Before using AI: test the browser plumbing

1. Double-click:

   ```text
   tools\start-browser-acceptance.cmd
   ```

2. A local test page opens.
3. Open Sightline on that page.
4. Click **Run browser self-test**.
5. You should see PASS lines for:
   - page observation
   - sensitive-field redaction
   - same-origin iframe access
   - opaque cross-origin iframe boundary
   - typing
   - clicking
   - state verification
   - destructive-action confirmation gate
   - cross-origin confirmation gate

If this fails, fix the browser-extension problem before troubleshooting Ollama.

## Set up Ollama

1. Install Ollama.
2. Start Ollama.
3. Install a local vision model. Initial recommendation:

   ```text
   ollama pull gemma3:4b
   ```

4. Go to your browser's extensions page and copy Sightline's extension ID.
5. Set Ollama's allowed origin to the exact extension origin:

   ```text
   chrome-extension://YOUR_ACTUAL_EXTENSION_ID
   ```

6. Fully restart Ollama.

Do not use a wildcard extension origin unless you intentionally want every installed extension to be able to contact Ollama.

## Test local AI

Inside Sightline:

1. Click **Load installed models**.
2. Select your local vision model.
3. Click **Test local AI**.

This checks:
- Sightline can reach Ollama from the extension
- the model is installed
- the model declares vision support
- a tiny local image inference succeeds

No real screenshot is used for that test.

## The three modes

### Observe

Use this when you want Sightline to explain what it sees without changing the page.

### Assist

Use this for most early testing.

Sightline can perform ordinary actions, but dangerous actions stop for review.

### Autonomous

Sightline can perform a bounded multi-step task by itself.

Autonomous does **not** mean unrestricted. Safety gates still apply.

## Starting a task

1. Open the webpage you want to work with.
2. Open Sightline.
3. Choose a mode.
4. Type the goal.
5. Click **Run task**.

Sightline pins the task to that browser tab. Switching to another tab will not redirect the task.

## Pause vs Cancel

### Pause

Pause stops execution and keeps a sanitized session checkpoint.

Use **Run task** again to resume.

The checkpoint does not store typed text, screenshots, or full navigation URLs.

### Cancel

Cancel stops execution and removes the resumable checkpoint.

Use this when you do not want the old task to return.

## Confirmations

Sightline asks for confirmation before high-impact actions such as:
- deleting or moving data to Trash
- sending/publishing
- purchases/payments
- account/security changes
- leaving the current website origin

If the page changes while you are reading the confirmation, the confirmation becomes invalid and Sightline re-plans instead of clicking the old target.

## Yahoo Mail

### First: readiness check

1. Sign into Yahoo yourself.
2. Open Yahoo Mail.
3. Open Sightline.
4. Click **Yahoo readiness**.

This is read-only.

Sightline checks whether it can see the mail search control and reports optional search/filter/select/Trash/count information.

If Yahoo displays MFA, CAPTCHA, login, account recovery, or a security challenge, Sightline stops and lets you handle it.

### Safe destructive behavior

For a request like:

```text
Find my old Amazon emails and move them to Trash.
```

Sightline is designed to:
1. search/filter first,
2. determine the visible result scope/count when possible,
3. show sample messages,
4. stop for confirmation,
5. move mail to Trash,
6. verify Yahoo shows evidence of the change.

Sightline blocks an apparently unfiltered Inbox-wide Trash action unless your original task explicitly requested a whole-Inbox action.

**Empty Trash / Delete Forever** is a different, more dangerous action. Sightline blocks it unless the original task explicitly asked for permanent deletion, and it still requires confirmation.

## Vision fallback

Sightline normally uses lightweight semantic page information.

If the planner genuinely needs visual layout/image information, it may request a screenshot-based local vision pass.

Limits:
- maximum two vision fallbacks per task
- maximum one for the same unchanged page state
- task tab must be visible/active
- screenshot is not stored in the resume checkpoint

The progress log tells you when vision is being used.

## Exporting diagnostics

After a task or self-test, click **Export agent report (.json)**.

The report contains bounded diagnostic events/timings.

It intentionally excludes:
- typed action text
- screenshots
- full task action payloads
- passwords/tokens

## If something fails

Use the gates in this order:

1. **Run browser self-test**
2. **Test local AI**
3. **Yahoo readiness**
4. Then test a real task

That tells us whether the problem is:
- browser plumbing
- Ollama/CORS/model
- Yahoo page structure/login
- autonomous planning/execution

## Current alpha warning

Sightline 0.2.0-alpha is still under active validation. Do not use it for irreversible production workflows until the remaining release gates are completed.
