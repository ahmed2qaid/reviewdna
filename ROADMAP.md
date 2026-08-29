# ReviewDNA Roadmap

The target is a production-quality v1.0, not a toy demo.

## 0.1 — Foundation (implemented)
- TypeScript workspace and typed schema
- GitHub PR/review collector
- deterministic classification and rule discovery
- evidence aggregation
- explainable confidence score
- basic conflict detection
- scope inference
- static interactive dashboard
- AGENTS / Claude / Cursor / Markdown exports
- fixture demo, tests, CI, security baseline

## 0.2 — Evidence quality
- ✅ review-thread resolution collection (baseline, token-authenticated GraphQL)
- before/after diff linking
- accepted/rejected suggestion inference
- CODEOWNERS-aware evidence weighting
- robust bot filtering
- benchmark dataset and precision/recall metrics

## 0.3 — Semantic intelligence
- embeddings abstraction
- local embedding provider
- semantic clustering beyond token overlap
- parent/sub-rule relationships
- superseded-rule detection
- rule evolution timeline

## 0.4 — Documentation drift
- ✅ scan AGENTS.md, CLAUDE.md, CONTRIBUTING.md, Copilot/Cursor rules
- ✅ mark documented vs undocumented conventions and coverage percentage
- detect historical guidance that conflicts with current review behavior
- generate CONTRIBUTING.suggested.md

## 0.5 — Incremental engine
- `.reviewdna/` cache
- content hashes
- resumable pipeline checkpoints
- incremental PR scans
- cost estimator for optional LLM stages
- redaction mode

## 0.6 — GitHub-native workflow
- production GitHub Action distribution
- scheduled Watch mode
- report artifact and GitHub Pages deployment
- “new engineering conventions” pull request generation
- human promote/ignore decision file

## 0.7 — Rich dashboard
- rule explorer with category/status/scope filters
- evidence explorer
- review heatmap
- convention coverage
- ✅ CLI snapshot compare (new/removed/strengthened/weakened)
- richer rule timeline and visual compare periods
- automation opportunities (ESLint/CI candidates)
- exportable share card

## 0.8 — Ecosystem
- plugin interfaces for collectors/providers/exporters/scorers
- Docker image
- public JSON schema package
- programmatic API examples
- GitLab collector prototype

## 0.9 — Hardening
- large-repository benchmarks
- security audit and fuzz tests
- schema compatibility suite
- Windows/macOS/Linux E2E
- docs site and migration guides

## 1.0 — Stable
- calibrated evidence/confidence model
- stable schema and CLI contracts
- production Action
- complete local-first flow
- public demo repositories
- release documentation and launch assets
