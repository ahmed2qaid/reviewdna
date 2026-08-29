# ReviewDNA Roadmap

The target is a production-quality v1.0, not a toy demo.

## 0.1 — Foundation
- ✅ TypeScript workspace, typed schema and modular core
- ✅ GitHub PR/review collector
- ✅ deterministic classification and evidence-backed rule discovery
- ✅ explainable confidence, scope and baseline conflict detection
- ✅ interactive static dashboard and agent exports
- ✅ tests, CI, CodeQL baseline and security documentation

## 0.2 — Evidence quality
- ✅ review-thread resolution collection with authenticated GraphQL
- before/after diff linking
- accepted/rejected suggestion inference
- CODEOWNERS-aware evidence weighting
- ✅ bot filtering and minimum-evidence promotion
- ✅ synthetic precision/recall/category regression benchmark
- real-world labeled benchmark calibration

## 0.3 — Semantic intelligence
- ✅ optional Ollama and OpenAI-compatible wording refinement with grounding safeguards
- embeddings abstraction
- local embedding provider
- semantic clustering beyond token overlap
- parent/sub-rule relationships
- superseded-rule detection and rule evolution timeline

## 0.4 — Documentation drift
- ✅ common AGENTS/CLAUDE/CONTRIBUTING/Copilot/Cursor scanning
- ✅ documented vs undocumented coverage
- ✅ baseline opposite-guidance drift detection
- semantic documentation conflict analysis
- generate CONTRIBUTING.suggested.md

## 0.5 — Incremental engine
- ✅ `.reviewdna/` PR-state cache using GitHub `updated_at`
- ✅ incremental PR collection
- content hashes for non-GitHub inputs
- resumable pipeline checkpoints
- cost estimator for optional LLM stages
- ✅ redaction and automatic raw-cache disablement under redaction
- richer secret/PII redaction

## 0.6 — GitHub-native workflow
- ✅ composite GitHub Action with artifact upload and smoke test
- stable tagged Action distribution
- ✅ local Watch mode with JSON/Markdown deltas
- scheduled hosted Watch mode
- GitHub Pages report deployment
- evidence-backed knowledge pull requests and human promote/ignore decisions

## 0.7 — Rich dashboard
- ✅ rule explorer with filters/evidence expansion
- review heatmap
- ✅ documentation coverage/drift
- ✅ CLI snapshot compare
- richer visual rule timeline
- automation opportunities and exportable share cards

## 0.8 — Ecosystem
- plugin interfaces for collectors/providers/exporters/scorers
- ✅ Dockerfile and CI smoke build
- published Docker image
- public JSON schema package and programmatic API examples
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
- production tagged Action
- complete local-first flow
- public demo repositories
- release documentation and launch assets
