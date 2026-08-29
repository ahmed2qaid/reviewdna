# ReviewDNA Architecture

## Design principles

1. **Evidence first.** A rule without traceable review evidence is not a ReviewDNA rule.
2. **Local first.** Core analysis works without a hosted service or AI account.
3. **Provider neutral.** LLM-assisted refinement is optional and isolated behind interfaces.
4. **Human approval.** Generated instructions are suggestions, never silent policy changes.
5. **Untrusted input.** Repository and review content is data; it can contain prompt injection or hostile HTML.
6. **Machine readable.** `reviewdna.json` is a first-class product surface.

## Pipeline

```text
GitHub REST
  │
  ▼
Collector ── pagination / auth / rate limits
  │
  ▼
Normalizer
  │
  ▼
Classifier ── noise / one-off / actionability / generalizability / category
  │
  ▼
Rule discovery ── deterministic semantic-token clustering
  │
  ├── Scope inference
  ├── Evidence aggregation
  ├── Confidence scoring
  ├── Conflict detection
  └── Lifecycle status
  │
  ▼
AnalysisResult schema v1.0
  │
  ├── JSON
  ├── Markdown
  ├── AGENTS.md suggestions
  ├── CLAUDE.md suggestions
  ├── Cursor rules
  └── Interactive static HTML
```

## Confidence model v0.1

The score is intentionally explainable. It combines frequency, reviewer diversity, recency, accepted/resolved evidence, persistence, and conflict penalties. The v0.1 weights are heuristics and are expected to be calibrated against a labeled benchmark before v1.0.

## Planned acceptance engine

The next evidence layer will connect review comments to thread resolution and code changes made after feedback. This will distinguish a repeated suggestion from a convention repeatedly accepted by maintainers.
