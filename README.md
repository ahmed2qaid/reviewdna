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

Engineering standards are rarely fully documented. They live in hundreds or thousands of review comments: “move this into the service layer”, “add a regression test”, “never log a token”, “validate the payload first”. ReviewDNA turns that hidden history into a verifiable knowledge layer.

**History + evidence + recurrence + scope + confidence + documentation drift + agent export.**

## What you get

An analysis creates:

- `reviewdna.json` — machine-readable analysis data.
- `reviewdna-report.html` — zero-server interactive dashboard.
- `engineering-dna.md` — shareable Markdown.
- `AGENTS.suggested.md` — evidence-backed agent suggestions.
- `CLAUDE.suggested.md` — Claude Code suggestions.
- `cursor.suggested.mdc` — Cursor suggestions.

The target repository is never modified. Generated policy files are suggestions that require human review.

## Quick start

Requirements: Node.js 20+.

```bash
npm install
npm run build
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js analyze-fixture fixtures/reviews.json --out demo-output
```

Analyze a GitHub repository:

```bash
GITHUB_TOKEN=github_pat_xxx node apps/cli/dist/index.js analyze owner/repo --max-prs 100 --min-evidence 2
```

A token is optional for small public scans but strongly recommended. With a token, ReviewDNA also attempts to read resolved review-thread state for stronger evidence.

## Incremental analysis

ReviewDNA keeps a gitignored local `.reviewdna/` collection cache. Each Pull Request is keyed by its GitHub `updated_at` value. Later runs reuse review records from unchanged PRs and fetch only new or changed PRs.

```bash
node apps/cli/dist/index.js analyze owner/repo --cache-dir .reviewdna
node apps/cli/dist/index.js analyze owner/repo --refresh-cache
node apps/cli/dist/index.js analyze owner/repo --no-cache
```

`--redact` and `--redact-evidence` automatically disable the raw-review cache so a redacted report does not silently leave an unredacted local cache.

## Watch conventions over time

The first Watch run creates a baseline. Later runs generate `reviewdna-delta.json` and `reviewdna-delta.md` showing new, removed, strengthened and weakened conventions.

```bash
node apps/cli/dist/index.js watch owner/repo --out reviewdna-watch
```

You can also compare any two snapshots directly:

```bash
node apps/cli/dist/index.js compare before/reviewdna.json after/reviewdna.json
```

## Evidence, not vibes

ReviewDNA does not promote every comment into policy. By default a convention needs at least two pieces of evidence, bot-authored guidance is excluded, and resolved review threads contribute less confidence than explicitly accepted evidence. Every rule records evidence count, reviewer diversity, time span, inferred scope, confidence components, documentation state and source links.

ReviewDNA also checks common instruction files (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot instructions and Cursor rules). It reports documentation coverage and flags baseline cases where documented guidance points in the opposite direction from repeated historical review guidance.

## Quality gates

The repository includes fixture-driven tests plus a labeled synthetic classification benchmark. CI measures candidate precision/recall and category accuracy and fails if the baseline regresses. The synthetic benchmark is a regression guard, **not a claim of real-world 100% accuracy**.

CI currently exercises Node.js 20, 22 and 24, the benchmark, demo generation, Docker build/smoke, and the composite GitHub Action itself.

## Local-first by design

Deterministic analysis works without any AI provider. Optional OpenAI-compatible and Ollama adapters are isolated behind a provider interface and are not required for core operation. Review text is treated as **untrusted data**, not model instructions.

## Architecture

```text
GitHub → Collector → Normalizer → Classifier → Rule Discovery
       → Evidence / Confidence / Conflict Analysis
       → Documentation Coverage / Drift
       → JSON + Agent Exports + Static Dashboard
```

The core is split into classification, discovery/scoring, documentation/redaction and historical comparison modules. See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Privacy

- no ReviewDNA account
- no telemetry
- GitHub tokens are not serialized into reports
- HTML output escapes review-derived text
- output redaction can pseudonymize reviewers and paths and remove evidence text
- raw collection caching is opt-out and automatically disabled under redaction

See [`SECURITY.md`](SECURITY.md).

## GitHub Action

```yaml
- uses: ahmed2qaid/reviewdna/action@main
  with:
    repository: owner/repo
    max-prs: '100'
    min-evidence: '2'
    redact: 'false'
```

The composite Action builds ReviewDNA, analyzes the target and uploads the generated artifacts. Pin a commit SHA instead of `main` in security-sensitive workflows until stable version tags are published.

## Docker

```bash
docker build -t reviewdna .
docker run --rm -e GITHUB_TOKEN reviewdna analyze owner/repo --max-prs 100
```

## Roadmap

The next differentiating work is before/after diff acceptance evidence, provider-independent semantic clustering, rule evolution, scheduled GitHub-native Watch reports, knowledge PRs, GitHub Pages demos and real-world benchmark calibration.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), [`ROADMAP.md`](ROADMAP.md), or the open issues.

## License

MIT
