# Installed Browser Acceptance

This procedure validates Sightline's actual installed browser-extension plumbing independently of Ollama.

## What the deterministic self-test verifies

The test uses only the dedicated local fixture. It does not depend on an AI model.

It checks:
- extension can observe the current HTTP page
- semantic controls are discovered
- sensitive fields are redacted
- opaque cross-origin iframe is reported rather than scraped
- same-origin iframe controls are discovered
- top-page textbox typing works
- top-page button clicking works
- semantic state change is observed
- same-origin iframe typing/clicking works
- destructive action is stopped at the confirmation gate
- cross-origin link activation is stopped at the confirmation gate

The self-test refuses to execute actions unless the active page is the Sightline fixture on `localhost` or `127.0.0.1`.

## Windows: easiest path

1. Install Node.js 20+ if it is not already installed.
2. In Chrome open `chrome://extensions`; in Edge open `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository's `extension` folder.
5. Run:

   ```text
   tools\start-browser-acceptance.cmd
   ```

6. The fixture opens at:

   ```text
   http://127.0.0.1:8765/
   ```

7. Open Sightline's side panel on that fixture page.
8. Click **Run browser self-test**.
9. Confirm every line reports **PASS**.
10. Do not click through the destructive/cross-origin confirmations manually during the self-test; the harness is checking that Sightline stops before those actions.
11. Press **Ctrl+C** in the server window when finished.

## Manual server command

From the repository root:

```text
npm run acceptance:serve
```

## Evidence to capture

For a release acceptance run, record:
- Chrome or Edge version
- Sightline commit SHA
- Windows version
- PASS/FAIL output from the side panel
- any console error
- whether the same-origin iframe checks passed
- whether both confirmation-gate checks passed

## Separate acceptance gates

Passing this self-test does **not** prove:
- Ollama connectivity
- planner quality
- vision-model quality
- Yahoo Mail compatibility
- long-session resource behavior

Those have separate gates so a model/runtime problem cannot be confused with browser-control plumbing.
