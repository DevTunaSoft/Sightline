# Sightline Performance and Resource Budgets

Sightline follows a **deterministic software before AI, DOM before vision** rule.

## Hard code-level budgets

- Semantic controls: max 300 per snapshot
- Serialized semantic snapshot: max 48 KB
- Visible page text: max 8 KB
- Element text: bounded
- Diagnostic events retained: max 200
- Checkpoint action history: max 40
- Checkpoint serialized budget: max 24 KB
- Default foreground inference concurrency target: 1
- Browser task actions: default max 40
- Browser task duration: default max 120 seconds
- Planner request timeout: 90 seconds
- Planner malformed-response repair: max 1 retry
- Vision fallbacks: max 2 per task
- Vision fallbacks for identical semantic state: max 1
- Vision description added to planner context: max 3,000 characters
- Screenshot base64 budget: 6,000,000 characters

## Architecture choices

- Visible page text collection stops at its budget instead of materializing an unlimited `innerText`.
- Snapshot bounding uses bounded binary search rather than repeated one-element serialization.
- Screenshots are used only when the semantic planner explicitly requests visual help.
- Screenshots are not stored in task checkpoints.
- Same-origin iframe controls share the same global element/text budget.
- Cross-origin iframes are not scraped.
- Task history and diagnostics are bounded tails, not unbounded transcripts.

## Current synthetic benchmark evidence

The repository includes `npm run benchmark:core`.

Prior verified hosted-runner measurements after the snapshot optimization showed a 5,000-element synthetic input reduced from roughly 12 seconds to well below a second while remaining under the 48 KB output budget. Diagnostic stress retains only the configured event tail.

Synthetic benchmark timing is hardware-dependent and is **not** a real-browser RAM/CPU acceptance result.

## Release performance gates

Target, excluding Ollama/model memory:
- normal extension working-set target: <150 MB
- idle CPU: effectively near zero
- idle AI inference: zero
- no sustained memory growth during long-session soak
- ordinary semantic actions should not invoke vision

Real Chrome/Edge measurements remain required before production acceptance.
