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
- Added a local `proposal` command that packages selected conventions, agent/contributor files and source evidence into a review bundle without modifying the target repository or opening a Pull Request.
- Added an explicit dry-run-first `publish-proposal` workflow. Publishing requires `--apply`, accepts only `reviewdna/*` branches, validates the complete proposal bundle before writes, stores proposal files only under `.reviewdna/proposals/<id>/`, refuses existing proposal branches, creates a single proposal commit, and opens a review Pull Request without overwriting repository policy files.
- Added evidence dispositions (`accepted`, `adopted`, `acknowledged`, `unresolved`, `rejected-candidate`) with separate positive and negative confidence effects.
- Added explicit PR-author response inference for accepted/rejected review guidance and deep-evidence checked-state tracking for unresolved comments.
- Migrated the review cache to schema v2 so legacy cached records without the new evidence signals are recollected once.
- Added CODEOWNERS-aware evidence weighting with GitHub-style last-match precedence and direct-user matching only; team membership is never guessed.
- CODEOWNERS metadata is excluded from documentation-drift text matching and surfaced separately in the dashboard alongside evidence dispositions and score effects.
