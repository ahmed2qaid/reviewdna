# Changelog

## 0.1.0 - 2026-08-30
- Initial ReviewDNA TypeScript workspace and typed schema.
- GitHub collector, deterministic classifier and evidence-backed rule discovery.
- Explainable confidence scoring, scope inference and conflict scaffolding.
- Static dashboard and AGENTS/Claude/Cursor/Markdown exports.
- Resolved review-thread evidence collection with authenticated GitHub GraphQL.
- Documentation coverage and baseline opposite-guidance drift detection.
- Snapshot comparison plus local Watch reports.
- Two-evidence promotion threshold and bot filtering.
- Resolved threads weighted below explicitly accepted evidence.
- Reviewer/path/evidence redaction mode.
- Synthetic classification quality gates, Docker packaging and smoke-tested GitHub Action.
- Incremental PR cache using GitHub `updated_at` with redaction-aware cache disablement.
- Optional Ollama/OpenAI-compatible rule refinement with evidence grounding and prompt-injection output rejection.
- Rich Watch deltas for lifecycle, scope and documentation changes, plus history snapshots and configurable baseline files.
- Cached GitHub Action Watch mode with a scheduled fork-ready workflow example.
- Optional `--deep-evidence` comparison from reviewed commit to merged PR head; same-file post-review changes strengthen resolved evidence without being treated as causal proof.
- Stable-ish rule fingerprints plus tracked `reviewdna.decisions.json` human decisions (`review`, `ignore`, `promote`, `override`).
- Human decisions preserve original evidence/confidence, are visible in reports, and are respected by agent exports and Watch comparisons.
- Added `CONTRIBUTING.suggested.md` for recurring undocumented conventions and a neutral `decisions-template` CLI command.
