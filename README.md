# ReviewDNA 🧬

> **Your reviews already contain your engineering DNA.**

ReviewDNA mines Pull Request and code-review history into **evidence-backed engineering conventions** for humans and AI coding agents. Every discovered rule links back to the reviews that support it and includes an explainable confidence score.

```bash
git clone https://github.com/ahmed2qaid/reviewdna.git
cd reviewdna
npm install && npm run build
node apps/cli/dist/index.js analyze owner/repository
```

> npm/npx distribution is planned after the package surface is stabilized; the repository does not pretend a package is published before it actually is.

## Why ReviewDNA?

Engineering standards are rarely fully documented. They live in hundreds or thousands of review comments. ReviewDNA turns that hidden history into a verifiable knowledge layer.

**History + evidence + recurrence + scope + confidence + documentation drift + human decisions + agent export.**

## What you get

An analysis creates:

- `reviewdna.json` — machine-readable rule/evidence data.
- `reviewdna-report.html` — zero-server interactive dashboard.
- `engineering-dna.md` — shareable Markdown report.
- `AGENTS.suggested.md` — evidence-backed agent instructions.
- `CLAUDE.suggested.md` — Claude Code suggestions.
- `cursor.suggested.mdc` — Cursor suggestions.
- `CONTRIBUTING.suggested.md` — recurring undocumented conventions worth reviewing for contributor docs.

The dashboard also exposes Review Hotspots, conservative Automation Opportunities, documentation provenance, rule evolution timelines, and a locally generated 1200×630 SVG share card.

The target repository is never modified and generated policy requires human review.

## Public demo

A reproducible synthetic demo is built from `fixtures/reviews.json` by the real ReviewDNA engine and is ready for GitHub Pages deployment.

Expected Pages URL after the repository's one-time Pages enablement:

**https://ahmed2qaid.github.io/reviewdna/**

Until Pages is enabled in **Settings → Pages → Build and deployment → Source: GitHub Actions**, the `ReviewDNA Public Demo` workflow still builds successfully and uploads the complete `_site/` as a workflow artifact instead of failing.

The demo is explicitly labeled **Synthetic fixture / Synthetic demo**. It does not claim to represent a real repository, team, or maintainer policy.

Build the exact Pages artifact locally:

```bash
npm run demo:site
```

This creates `_site/index.html`, `share-card.svg`, `reviewdna.json`, and `engineering-dna.md`. See [`docs/PUBLIC_DEMO.md`](docs/PUBLIC_DEMO.md).

## Quick start

Requirements: Node.js 20+.

```bash
npm install
npm run build
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js analyze-fixture fixtures/reviews.json --out demo-output
GITHUB_TOKEN=github_pat_xxx node apps/cli/dist/index.js analyze owner/repo --max-prs 100 --min-evidence 2
```

With a GitHub token, ReviewDNA also attempts to read resolved review-thread state. By default, bot guidance is excluded and at least two pieces of review evidence are required before a convention is promoted.

## Incremental analysis and Watch

ReviewDNA keeps a gitignored `.reviewdna/` collection cache keyed by each Pull Request's GitHub `updated_at`. Later runs fetch only new or changed PRs. Use `--no-cache` or `--refresh-cache` when needed. Redaction disables raw-review caching automatically.

```bash
node apps/cli/dist/index.js watch owner/repo --max-prs 500 --out reviewdna-watch
node apps/cli/dist/index.js compare before/reviewdna.json after/reviewdna.json
```

The first Watch run creates a baseline. Later runs generate `reviewdna-delta.json` and `reviewdna-delta.md` covering new, removed, strengthened, weakened, lifecycle/scope, documentation, and human-decision changes. `--fail-on-changes` can turn changes into a CI signal, and `--baseline-file` lets automation persist the baseline separately from report artifacts.

The composite GitHub Action supports `mode: watch` and restores `.reviewdna` with `actions/cache`, so unchanged Pull Request history is reused across scheduled runs. A fork-ready scheduled example is included in [`examples/reviewdna-watch.yml`](examples/reviewdna-watch.yml).

For large or remote-provider analyses, ReviewDNA also supports validated pipeline checkpoints (`--resume`), user-priced token/cost preflight, a remote-cost ceiling, and targeted sensitive-data redaction. See [`docs/PIPELINE_HARDENING.md`](docs/PIPELINE_HARDENING.md).

## Evidence, not vibes

ReviewDNA does not equate “thread resolved” with “guidance accepted.” Evidence is deliberately weighted:

- explicit accepted evidence is strongest;
- resolved guidance is a weaker signal;
- with `--deep-evidence`, a resolved inline comment is strengthened when the commit that was reviewed is compared with the merged PR head and the same file changed afterward.

The deep signal is still a conservative correlation, not proof that the review comment caused the change. It is opt-in because it requires additional GitHub compare API calls.

Every rule retains source links, evidence count, reviewer diversity, first/last seen dates, inferred scope, recency, persistence, conflict state, documentation state, a stable-ish fingerprint, and an explainable confidence breakdown.

ReviewDNA also checks common repository instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot instructions and Cursor rules), reports documentation coverage, and can add optional semantic documentation support/conflict matching with auditable lexical/semantic provenance.

## Human decisions

ReviewDNA discoveries are **evidence, not policy**. Each discovered convention receives a fingerprint such as `rdna-api-design-4a72bc11`, so a team can keep an explicit, reviewable decision about that convention even when rule ordering changes between scans.

Generate a tracked decision template from an analysis:

```bash
node apps/cli/dist/index.js decisions-template reviewdna-output/reviewdna.json
```

This creates `reviewdna.decisions.json`. Every entry starts in the neutral `review` state; generating the file does **not** approve any rule.

```json
{
  "version": 1,
  "decisions": [
    {
      "fingerprint": "rdna-api-design-4a72bc11",
      "action": "promote",
      "reason": "Approved by maintainers"
    }
  ]
}
```

Supported actions:

- `review` — neutral; no effect.
- `ignore` — keep the rule and evidence visible, but exclude it from agent/contributor exports.
- `promote` — explicitly approve the rule for exports even when automatic thresholds would exclude it.
- `override` — approve team-authored wording while preserving the original inferred wording, evidence, and confidence.

ReviewDNA automatically reads `reviewdna.decisions.json` when present. Use `--no-decisions` to bypass it or `--decisions path/to/file.json` for another tracked file. Unknown fingerprints are reported rather than silently discarded. Fingerprints are intended as pre-v1 identity anchors; the schema can still evolve before v1.0.

## Knowledge proposal package

Once a team has reviewed an analysis, ReviewDNA can package the exportable conventions into a self-contained review bundle:

```bash
node apps/cli/dist/index.js proposal reviewdna-output/reviewdna.json --out reviewdna-proposal
```

The bundle contains:

- `reviewdna-proposal.json` — manifest with rule fingerprints, decisions, scopes and evidence links.
- `REVIEWDNA_PROPOSAL.md` — human-readable proposal with evidence references.
- `AGENTS.proposed.md`
- `CLAUDE.proposed.md`
- `cursor.proposed.mdc`
- `CONTRIBUTING.proposed.md`

The proposal uses the same policy-selection rules as the agent exports: ignored rules are excluded, promoted/overridden rules are included, and automatically selected rules must pass the confidence/lifecycle/conflict gates. It preserves source evidence URLs so reviewers can verify why each convention exists.

**`proposal` does not modify the target repository and does not open a Pull Request.** It deliberately creates a reviewable package first.

Publishing that already-reviewed bundle is a separate, explicit step and is a true dry-run unless `--apply` is supplied:

```bash
node apps/cli/dist/index.js publish-proposal owner/repo reviewdna-proposal \
  --branch reviewdna/proposal-example

# Explicit write only after reviewing the dry run:
node apps/cli/dist/index.js publish-proposal owner/repo reviewdna-proposal \
  --branch reviewdna/proposal-example \
  --apply
```

The publisher writes only under `.reviewdna/proposals/<id>/` on a `reviewdna/*` branch and opens a review Pull Request. It never silently overwrites `AGENTS.md`, `CONTRIBUTING.md`, or another repository policy file.

## Optional semantic intelligence and AI refinement

Deterministic mining remains the default. Semantic clustering is an optional evidence-grouping stage; AI wording refinement is a separate explicit stage that may rewrite the wording of already-discovered rules. Neither stage can create evidence or bypass human decisions.

Local semantic clustering:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --clusterer semantic \
  --embedding-provider local
```

Local Ollama wording refinement:

```bash
node apps/cli/dist/index.js analyze owner/repo --provider ollama --model qwen3:8b
```

OpenAI-compatible endpoint:

```bash
REVIEWDNA_LLM_API_KEY=... \
REVIEWDNA_LLM_BASE_URL=https://provider.example/v1 \
REVIEWDNA_LLM_MODEL=my-model \
node apps/cli/dist/index.js analyze owner/repo --provider openai-compatible --max-refine-rules 25
```

Remote refinement sends selected review evidence to the configured endpoint and ReviewDNA warns when it is enabled. Model output is length-checked, grounded against the deterministic rule/evidence, and prompt-injection-like output is rejected. Human decisions are applied after optional wording refinement, so a team remains the final policy authority.

## Quality gates

The repository includes fixture-driven tests plus labeled synthetic classification/semantic regression benchmarks. These benchmarks are regression guards, **not claims of real-world accuracy**. CI exercises Node.js 20/22/24, benchmark generation, the complete reproducible Pages demo site, release-metadata verification, Docker, the composite GitHub Action, incremental-cache behavior, deep-evidence collection, human-decision behavior, redaction, cost/checkpoint behavior, and knowledge-proposal provenance.

## Local-first by design

Deterministic analysis requires no AI account. Local feature embeddings and Ollama can keep optional semantic/wording stages local. Remote providers are explicit opt-in. Review text is always treated as **untrusted data**, not model instructions.

## Architecture

```text
GitHub → Incremental Collector → Normalizer → Classifier → Rule Discovery
       → Evidence / Confidence / Conflict Analysis
       → Documentation Coverage / Drift
       → optional semantic grouping / grounded wording refinement
       → tracked Human Decisions
       → Rule Evolution + Structured Insights
       → JSON + Agent/Contributor Exports + Static Dashboard + Watch Delta
       → optional local Knowledge Proposal package / explicit review PR
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Privacy & security

No ReviewDNA account or telemetry is required. Tokens are not serialized into reports. HTML output escapes review-derived content. Output redaction can pseudonymize reviewers/paths, remove raw evidence text, or selectively scrub common secrets/PII. Redaction disables raw-review caches and checkpoints automatically. See [`SECURITY.md`](SECURITY.md).

## GitHub Action

The first immutable pre-v1 Action release is `v0.1.0`.

One-time analysis:

```yaml
- uses: ahmed2qaid/reviewdna/action@v0.1.0
  with:
    repository: owner/repo
    max-prs: '100'
    min-evidence: '2'
    redact: 'false'
```

Continuous watch:

```yaml
- uses: ahmed2qaid/reviewdna/action@v0.1.0
  with:
    repository: owner/repo
    mode: watch
    max-prs: '500'
    min-evidence: '3'
    resume: 'true'
```

`@main` follows development and is intentionally not a stable reference. For the strongest supply-chain pinning in security-sensitive workflows, use the exact commit SHA behind the release tag.

## Docker

```bash
docker build -t reviewdna .
docker run --rm -e GITHUB_TOKEN reviewdna analyze owner/repo --max-prs 100
```

## Roadmap

Next release-focused work: npm/package publishing, activating the prepared public Pages deployment, an end-to-end Knowledge Proposal PR demo, real-world benchmark calibration, cross-platform E2E, and release/launch assets.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), [`ROADMAP.md`](ROADMAP.md), or the open issues.

## License

MIT
