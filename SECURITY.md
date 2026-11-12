# Sightline Security and Privacy Policy

Sightline operates across sensitive browser and Windows surfaces. **Local-first does not mean automatically safe**. This file defines design expectations; it does not certify the current build.

## Trust boundaries

- Highest authority: explicit user instruction within applicable local safety policy and approval.
- Trusted executor applies typed, validated actions only.
- Browser DOM, page text, window metadata, screenshots, OCR, external files and model replies are **untrusted data**, never privileged directions.
- The browser companion and future local IPC must use least privilege, exact origins, bounded messages and authenticated/authorized endpoints.
- Elevation/UIPI boundaries must be respected. Never silently bypass OS access controls.

## High-impact operations

By default require explicit scope presentation and confirmation before deleting or bulk changing content, sending/publishing, money movement, changing accounts/security settings, granting permissions, or irreversible changes. Re-observe and revalidate targets after approval. If an action result is ambiguous, **stop and investigate rather than replay it**.

## Secrets and sensitive data

Do not send to models or logs passwords, session cookies, bearer tokens, keys, MFA codes, payment credentials, or the contents of sensitive input fields. Redact before context construction and before persistence/export. Diagnostic reports should contain sanitized operation metadata, timestamps, durations, failure categories and resource metrics rather than payloads or raw screenshots. Screenshots and captures require explicit retention rules. Avoid telemetry/network egress by default.

## Memory and persistence

Bound event counts, in-memory queues, snapshots, retained task context, file sizes and log retention. Delete transient visual data promptly. The design should offer user-understandable retention/deletion controls; verify actual availability against the implementation before documenting them as shipped.

## Threat and regression test inventory

| Threat | Minimum regression |
|---|---|
| Prompt injection in page, window or OCR content | Inject hostile instructions; ensure policy and goal remain unchanged |
| Secret leakage into model or export | Seed canary secrets; assert no canary in prompts/logs/reports |
| Wrong tab/window or stale reference | Navigate/recreate and require fail-closed revalidation |
| Destructive replay or confirmation scope drift | Change target after confirmation; verify stop/re-prompt |
| Unauthorized cross-origin or IPC messages | Reject wrong origin, malformed payload, oversize input, missing authorization |
| User interaction/focus race | Manual keyboard/mouse interference must pause/abort safely |
| Elevated or protected UI | Report inaccessible actions; no privilege bypass |
| Unbounded resource growth | Long-running/large-input soak measures RAM, CPU, handles, threads and log storage |
| Malicious dependency or borrowed code | License/dependency review and secret scanning before merge |
| Interrupted/corrupt checkpoint | Recover without replaying unknown consequential effects |

## Reporting vulnerabilities

Use GitHub's private security advisory reporting mechanism if enabled, or contact repository maintainers privately. **Do not post credentials, private user data, exploit details affecting active installations, or unredacted diagnostic reports in public issues.** If a private channel is unavailable, open a minimal public issue requesting a secure contact method without sensitive details.

## Release status

A successful CI run is not an external security audit. Security sign-off requires documented evidence for actual target platforms, permissions, integration boundaries, privacy-redaction tests and consequential-action gates.
