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
- ✅ baseline before/after commit comparison for inline comments
- ✅ evidence dispositions: accepted / adopted / acknowledged / unresolved / rejected-candidate
- ✅ conservative rejected-candidate inference from explicit PR-author replies and checked-but-unchanged deep evidence
- ✅ CODEOWNERS-aware direct-reviewer evidence weighting without team-membership guessing
- ✅ bot filtering and minimum-evidence promotion
- ✅ synthetic precision/recall/category regression benchmark
- stronger causal rejection/adoption inference from richer review-thread history
- real-world labeled benchmark calibration

## 0.3 — Semantic intelligence
- ✅ optional Ollama and OpenAI-compatible wording refinement with grounding safeguards
- ✅ provider-neutral embedding abstraction
- ✅ deterministic local feature embedding provider
- ✅ Ollama and OpenAI-compatible embedding providers
- ✅ guarded semantic clustering beyond token overlap
- ✅ separate embedding-provider and wording-provider CLI controls
- ✅ semantic regression benchmark and auditable clusterer metadata
- ✅ parent/sub-rule relationships
- ✅ conservative superseded-rule detection and evidence-derived rule evolution timeline
- real-world semantic-clustering threshold calibration

## 0.4 — Documentation drift
- ✅ common AGENTS/CLAUDE/CONTRIBUTING/Copilot/Cursor scanning
- ✅ documented vs undocumented coverage
- ✅ baseline opposite-guidance drift detection
- ✅ semantic documentation support/conflict analysis with polarity safeguards
- ✅ auditable lexical/semantic documentation provenance and Watch deltas
- ✅ generate `CONTRIBUTING.suggested.md`
- real-world documentation matcher calibration

## 0.5 — Incremental engine
- ✅ `.reviewdna/` PR-state cache using GitHub `updated_at`
- ✅ incremental PR collection
- ✅ stable content hashes for GitHub and fixture inputs/options
- ✅ versioned resumable pipeline checkpoints with strict repository/input/options validation
- ✅ `--resume`, checkpoint override and checkpoint-disable controls
- ✅ token/cost preflight for optional embedding and LLM stages
- ✅ user-supplied per-million pricing with aggregate remote-cost budget guard
- ✅ machine-readable `reviewdna-cost.json`
- ✅ redaction and automatic raw-cache/checkpoint disablement under redaction
- ✅ targeted secret/PII redaction while preserving surrounding prose
- ✅ cache/checkpoint compatibility regression coverage

## 0.6 — GitHub-native workflow
- ✅ composite GitHub Action with artifact upload and smoke test
- stable tagged Action distribution
- ✅ local Watch mode with JSON/Markdown deltas
- ✅ richer lifecycle/scope/documentation delta classification
- ✅ cached scheduled Watch workflow example for fork-based deployments
- ✅ Action support for semantic docs, resume/checkpoints, sensitive redaction and cost controls
- ✅ tracked human `review` / `ignore` / `promote` / `override` decision file
- ✅ local evidence-backed Knowledge Proposal review bundle
- ✅ explicit dry-run-first GitHub publishing of Knowledge Proposals as review Pull Requests
- GitHub Pages report deployment
- end-to-end Knowledge Proposal PR demo on a public repository

## 0.7 — Rich dashboard
- ✅ rule explorer with filters/evidence expansion
- ✅ display rule fingerprints and human decisions
- ✅ display evidence dispositions, CODEOWNER signals and score effects
- ✅ review hotspots with evidence deduplication, percentages and category distribution
- ✅ documentation coverage/drift
- ✅ display documentation support/conflict provenance and matcher scores
- ✅ CLI snapshot compare
- ✅ relationship badges and expandable rule evolution timelines
- ✅ deterministic automation opportunities with suggested enforcement mechanisms
- ✅ exportable 1200×630 SVG share card with local dashboard download

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
- stable schema, fingerprint and CLI contracts
- production tagged Action
- complete local-first flow
- public demo repositories
- release documentation and launch assets
