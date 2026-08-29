# Changelog

## 0.1.0 - 2026-08-30
- Initial ReviewDNA TypeScript workspace and typed schema.
- GitHub collector, deterministic classifier and evidence-backed rule discovery.
- Explainable confidence scoring, scope inference and conflict scaffolding.
- Static dashboard and AGENTS/Claude/Cursor/Markdown exports.
- Resolved review-thread evidence collection with authenticated GitHub GraphQL.
- Documentation coverage and baseline opposite-guidance drift detection.
- Snapshot comparison for new, removed, strengthened and weakened conventions.
- Default two-evidence promotion threshold and bot filtering.
- Resolved review threads weighted below explicitly accepted evidence.
- Reviewer/path/evidence redaction mode.
- Synthetic classification quality gates, Docker packaging and smoke-tested composite GitHub Action.
- Core split into classification, discovery/scoring, documentation/redaction and comparison modules.
- Incremental PR collection with `.reviewdna/` cache keyed by PR `updated_at`.
- Redaction automatically disables the raw-review cache.
- Local `watch` mode with JSON and Markdown change reports.
