# Sightline Security Model

## Core trust boundary

Webpage text, screenshots, accessibility names, DOM attributes, and model output are **untrusted data**. They cannot directly execute code.

The AI may propose only typed actions accepted by Sightline's validator. Trusted deterministic code resolves and executes those actions.

## Implemented controls

- No arbitrary model-generated JavaScript or shell execution.
- No broad `<all_urls>` host permission.
- Ollama connection restricted to local loopback.
- Password, OTP, payment-security, token/secret-like fields are marked sensitive.
- Sensitive fields cannot be autonomously read, typed, or cleared.
- Textbox values are not used as semantic labels.
- Diagnostic reports strip typed action payloads.
- Session checkpoints strip typed text, selected values, full navigation URLs, and screenshots.
- High-impact actions require confirmation.
- Irreversible delete controls require explicit permanent-delete intent plus confirmation.
- Confirmation keys bind task goal, snapshot, action, and target.
- The page is re-observed immediately before execution, including after user confirmation delays.
- Confirmed consequential actions must produce a semantic effect or return `NO_VERIFIED_EFFECT`.
- Tasks are pinned to the starting tab.
- Tasks are pinned to approved origins; spontaneous origin changes stop execution.
- Cross-origin navigation/link activation requires approval.
- CAPTCHA/MFA/login/account-recovery states hand control to the user.
- Cross-origin iframe content is treated as opaque.
- Same-origin iframe controls use the target document's event realm.

## Prompt injection

Planner prompts explicitly label page/screenshot content as untrusted. Page content cannot change Sightline's action schema or safety policy.

## Data retention

Task checkpoint storage uses `chrome.storage.session`; it is bounded and intended for interruption recovery rather than permanent history.

Agent diagnostics are in-memory until explicitly exported and are bounded to a small sanitized event tail.

## Still required

- Real-browser adversarial prompt-injection acceptance
- Browser permission review during release candidate
- Dependency/license audit
- CSP review
- Real Yahoo destructive-action acceptance with disposable data
- External security review before a production-trust claim
