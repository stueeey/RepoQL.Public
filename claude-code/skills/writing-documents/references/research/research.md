# Writing Research Documents

This guidance governs how research is structured and presented.

Gather your evidence first, then use this guide to present it clearly.

---

## This Document Covers

How to structure and present research findings.

## Structure

Research is often comparative. Structure for comparison.

```markdown
# [Topic] Research

Research for [what decision this informs].

*Research date: [date]*

## Context
[Decision, scope, constraints]

## [Option/Area A]
[Facts, capabilities, limitations, field sentiment]
> [Source](link) — what it establishes

## [Option/Area B]
[Facts, capabilities, limitations, field sentiment]
> [Source](link) — what it establishes

## Comparison
| Dimension | Option A | Option B |
|-----------|----------|----------|
| [Metric]  | [Value]  | [Value]  |

## Gaps
[What you couldn't determine]
```

## Formatting Guidance

- **Tables** for feature matrices and direct comparisons
- **Prose** for context, nuance, and field sentiment
- **Sources near claims** — not collected at the end
- **Dates noted** where freshness matters

## The Transformation

You will write this:
```
Option A has better performance and cleaner API design,
making it the clear choice for our use case.
```

Write this instead:
```
| Metric | Option A | Option B |
|--------|----------|----------|
| p99 latency | 50ms | 120ms |
| API style | REST | GraphQL |

Option A is widely adopted for latency-sensitive workloads.

> [Benchmark source](link)
```

One prescribes. One presents with synthesis.

## Before Finalizing

Verify the document:

1. **Purpose visible** — Reader knows what decision this informs within the first paragraph
2. **Sources present** — Every claim has a source near it
3. **Gaps explicit** — What couldn't be determined is stated
4. **Neutrality intact** — No prescription crept in during writing
5. **Dates noted** — Source currency is clear where it matters

## Exemplar

See `exemplar.md` — embedding models for developer laptops.

## Template

See `template.md` — structural compass with self-check.
