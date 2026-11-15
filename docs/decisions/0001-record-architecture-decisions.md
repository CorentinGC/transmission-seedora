# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

Seedora is maintained by a small team working with AI agents, and is opening to outside contributors. Several structural choices (one shared UI package for two shells, the `PlatformApi` abstraction, RPC proxied by the Next.js server) are visible in the code but their reasons are not written anywhere. Decisions still to come — the SSRF host policy, credential storage, unifying the `@shared` alias — need a place where the reasoning outlives the conversation that produced it.

## Decision

Significant technical decisions are recorded as Architecture Decision Records in `docs/decisions/`, one file per decision, named `NNNN-short-title.md` and numbered sequentially.

A decision is significant when it constrains future work: a dependency or framework choice, a security policy, a cross-app contract, a data format, a deliberate trade-off someone will later be tempted to undo.

An accepted ADR is not edited to change its decision. A new ADR supersedes it, and the old one's status is updated to `Superseded by NNNN`.

## Consequences

- Reviewers and agents can check a change against the recorded decision instead of guessing intent.
- Writing an ADR is part of the work for any change of that kind; the tech lead owns them.
- Small overhead per decision; decisions that are trivially reversible do not need one.

---

## Template

```markdown
# NNNN — Title

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context

What problem are we solving, and what constrains the answer?

## Decision

What we are doing, stated as a rule someone can follow.

## Alternatives considered

Each option in a line or two, and why it lost.

## Consequences

What becomes easier, what becomes harder, what we now have to maintain.
```
