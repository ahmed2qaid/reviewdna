# ReviewDNA Architecture

## Design principles

1. **Evidence first.** A rule without traceable review evidence is not a ReviewDNA rule.
2. **Local first.** Core analysis works without a hosted service or AI account.
3. **Provider neutral.** LLM-assisted refinement is optional and isolated behind interfaces.
4. **Human authority.** Historical inference and AI refinement are evidence layers; tracked human decisions remain the final policy layer.
5. **Untrusted input.** Repository and review content is data; it can contain prompt injection or hostile HTML.
6. **Machine readable.** `reviewdna.json` is a first-class product surface.
7. **Auditable transformation.** Human overrides preserve original inferred wording, evidence and confidence instead of erasing provenance.

## Pipeline

```text
GitHub REST / GraphQL
  │
  ▼
Incremental Collector ── pagination / auth / rate limits / PR cache
  │
  ├── optional resolved-thread state
  └── optional deep commit→head same-file evidence
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
  ├── Stable-ish rule fingerprint
  ├── Scope inference
  ├── Evidence aggregation
  ├── Confidence scoring
  ├── Conflict detection
  └── Lifecycle status
  │
  ▼
Documentation coverage / drift
  │
  ▼
Optional grounded wording refinement
  │
  ▼
Tracked human decisions (`reviewdna.decisions.json`)
  │          │
  │          ├── review   → neutral
  │          ├── ignore   → visible evidence, excluded from policy exports
  │          ├── promote  → explicitly approved for policy exports
  │          └── override → team wording with original inference preserved
  │
  ▼
AnalysisResult schema v1.0
  │
  ├── JSON / Markdown
  ├── AGENTS / Claude / Cursor suggestions
  ├── CONTRIBUTING suggestions
  ├── Interactive static HTML
  └── Watch delta / history snapshots
```

## Confidence model v0.1

The score is intentionally explainable. It combines frequency, reviewer diversity, recency, accepted/resolved evidence, persistence, and conflict penalties. The v0.1 weights are heuristics and are expected to be calibrated against a real-world labeled benchmark before v1.0.

Resolved thread state alone is deliberately weaker than explicit accepted evidence. `--deep-evidence` can strengthen a resolved inline comment when the reviewed commit and merged PR head show a later change to the same file. That signal is correlation, not causal proof that the review comment produced the change.

## Rule identity and human decisions

`RULE-0001` style IDs are presentation-order IDs and can move between runs. ReviewDNA therefore assigns a content-derived fingerprint such as `rdna-testing-...` for tracked decisions and snapshot matching. Fingerprints are pre-v1 identity anchors, not yet a permanent compatibility promise; unmatched decisions are surfaced rather than silently dropped.

Human decisions never rewrite evidence, reviewer diversity, dates, or confidence. `override` stores the prior inferred text in `originalText`, so a report can distinguish what history suggested from what the team explicitly chose to say.

## Next evidence work

The remaining evidence-quality work includes rejected-suggestion inference, CODEOWNERS-aware weighting, and calibration against labeled real-world review histories. These should strengthen provenance without turning ReviewDNA into people-ranking analytics.
