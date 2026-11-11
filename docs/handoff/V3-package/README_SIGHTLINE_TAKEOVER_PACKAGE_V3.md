> **GitHub publication note (2026-11-11):** This directory contains the five companion Markdown documents extracted from the V3 takeover package. The full master dossier is at [SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md](../SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md). The original binary ZIP was **not** committed; text was transferred through the document service and line endings/formatting may differ from the original ZIP entries. Original ZIP SHA-256 checksums are therefore not published as checksums for these GitHub text files. The master dossier and companion files are usable directly on GitHub; consult the active `docs/HANDOFF.md` ledger for newer verified changes.\n\n# Sightline — Engineering Takeover Package V3

**Date:** 2026-11-11. **Product:** Sightline — *See. Understand. Act.*

This archive is a **documentation and takeover package**, not a source-code clone, compiled application, or proof of a passing production build. Get current source from https://github.com/DevTunaSoft/Sightline and inspect `develop` before acting. `main` is the default branch and is not identical to `develop`.

## Read in this order

1. `SIGHTLINE_MASTER_HANDOFF_V3_2026-11-11.md` — self-contained complete dossier. It includes the prior technical handoff, conversation-derived rationale, architecture, code contracts, 40 requirements, 60 tests, 35 historical audit findings, 20 work packages, and exact continuation instructions.
2. `SIGHTLINE_NEXT_AGENT_RUNBOOK_V3.md` — compact entry point for coding.
3. `SIGHTLINE_REQUIREMENTS_AND_RATIONALE_V3.md` — 40 requirement records and original reasons for decisions.
4. `SIGHTLINE_TEST_AND_ACCEPTANCE_PLAN_V3.md` — test matrix, fault injection, memory measurements and release gates.
5. `SIGHTLINE_HISTORICAL_AUDIT_RECONCILIATION_V3.md` — prior 35 findings with cautious current status.
6. `SHA256SUMS.txt` — package integrity checks.

## Critical status

Latest targeted browser observer/adapter tests: **86/86 PASS in isolated V8**, not the full native Node suite or installed Chrome/Edge. Windows latest .NET/XUnit and real WPF acceptance **NOT RUN/UNVERIFIED** in the recent session. Browser/Windows full product, production trusted Windows approval/recovery, tiny embedded GGUF and secure IPC are not production accepted. Resource budgets are architectural limits, not verified real-browser RAM ceilings.

## Safety

Do not use this package as permission to force-merge diverged GitHub branches, operate production mail destructively, or skip trusted confirmation/reconciliation. Keep `docs/HANDOFF.md` in the repository as the chronological source of truth; this is the deep onboarding reference.