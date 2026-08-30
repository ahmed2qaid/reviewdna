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

The target repository is never modified and generated policy requires human review.

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

## Evidence, not vibes

ReviewDNA does not equate “thread resolved” with “guidance accepted.” Evidence is deliberately weighted:

- explicit accepted evidence is strongest;
- resolved guidance is a weaker signal;
- with `--deep-evidence`, a resolved inline comment is strengthened when the commit that was reviewed is compared with the merged PR head and the same file changed afterward.

The deep signal is still a conservative correlation, not proof that the review comment caused the change. It is opt-in because it requires additional GitHub compare API calls.

Every rule retains source links, evidence count, reviewer diversity, first/last seen dates, inferred scope, recency, persistence, conflict state, documentation state, a stable-ish fingerprint, and an explainable confidence breakdown.

ReviewDNA also checks common repository instructions (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot instructions and Cursor rules), reports documentation coverage, and flags baseline opposite-guidance drift.

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

## Optional AI refinement

Deterministic mining remains the default. AI refinement is an explicit second stage that may rewrite the wording of already-discovered rules; it cannot create rules or change evidence/confidence.

Local Ollama:

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

The repository includes fixture-driven tests plus a labeled synthetic classification benchmark. The benchmark is a regression guard, **not a claim of 100% real-world accuracy**. CI exercises Node.js 20/22/24, benchmark/demo generation, Docker, the composite GitHub Action, incremental-cache behavior, deep-evidence collection, and human-decision behavior.

## Local-first by design

Deterministic analysis requires no AI account. Ollama can refine rules locally. Remote providers are explicit opt-in. Review text is always treated as **untrusted data**, not model instructions.

## Architecture

```text
GitHub → Incremental Collector → Normalizer → Classifier → Rule Discovery
       → Evidence / Confidence / Conflict Analysis
       → Documentation Coverage / Drift
       → optional grounded wording refinement
       → tracked Human Decisions
       → JSON + Agent/Contributor Exports + Static Dashboard + Watch Delta
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Privacy & security

No ReviewDNA account or telemetry is required. Tokens are not serialized into reports. HTML output escapes review-derived content. Output redaction can pseudonymize reviewers/paths and remove raw evidence text. Redaction disables the raw-review cache automatically. See [`SECURITY.md`](SECURITY.md).

## GitHub Action

One-time analysis:

```yaml
- uses: ahmed2qaid/reviewdna/action@main
  with:
    repository: owner/repo
    max-prs: '100'
    min-evidence: '2'
    redact: 'false'
```

Continuous watch:

```yaml
- uses: ahmed2qaid/reviewdna/action@main
  with:
    repository: owner/repo
    mode: watch
    max-prs: '500'
    min-evidence: '3'
    deep-evidence: 'false'
```

Pin a commit SHA in security-sensitive workflows until stable version tags exist.

## Docker

```bash
docker build -t reviewdna .
docker run --rm -e GITHUB_TOKEN reviewdna analyze owner/repo --max-prs 100
```

## Roadmap

Next differentiating work: rejected-suggestion inference, CODEOWNERS-aware evidence, provider-independent semantic clustering, rule evolution, evidence-backed knowledge PRs, GitHub Pages demos, and real-world benchmark calibration.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), [`ROADMAP.md`](ROADMAP.md), or the open issues.

## License

MIT
