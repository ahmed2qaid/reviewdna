# ReviewDNA 🧬

> **Your reviews already contain your engineering DNA.**

ReviewDNA mines Pull Request and code-review history into **evidence-backed engineering conventions** for humans and AI coding agents. Every discovered rule links back to the reviews that support it and includes an explainable confidence score.

```bash
git clone https://github.com/ahmed2qaid/reviewdna.git
cd reviewdna && npm install && npm run build
node apps/cli/dist/index.js analyze owner/repository
```

> npm/npx distribution is planned after the package surface is stabilized; the repository does not pretend a package is published before it actually is.

> **Status:** early open-source release (`v0.1`). The deterministic engine, GitHub collector, evidence model, dashboard, agent exports, tests, and CI are implemented. Semantic clustering and acceptance tracking will continue to improve toward v1.0.

## Why ReviewDNA?

Engineering standards are rarely fully documented. They live in hundreds or thousands of review comments: “move this into the service layer”, “add a regression test”, “never log a token”, “validate the payload first”. ReviewDNA turns that hidden history into a verifiable knowledge layer.

**History + evidence + recurrence + scope + confidence + agent export.**

## What you get

Running an analysis creates `reviewdna.json`, a zero-server `reviewdna-report.html`, `engineering-dna.md`, and suggested `AGENTS.md`, `CLAUDE.md`, and Cursor rule files. The source repository is never modified and policy suggestions require human review.

## Quick start

Requirements: Node.js 20+.

```bash
npm install
npm run build
node apps/cli/dist/index.js doctor
node apps/cli/dist/index.js analyze-fixture fixtures/reviews.json --out demo-output
```

Analyze a public GitHub repository:

```bash
GITHUB_TOKEN=github_pat_xxx node apps/cli/dist/index.js analyze owner/repo --max-prs 100 --min-evidence 2
```

A token is optional for small public scans but recommended because anonymous API limits are low. With a token, ReviewDNA also attempts to read resolved review-thread state for stronger evidence. Use `--redact` to pseudonymize reviewer names and paths, or `--redact-evidence` to hide raw evidence text too.

ReviewDNA checks common repository instruction files (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot instructions, and Cursor rules) and reports documentation coverage plus potential drift where historical review guidance points in the opposite direction.

Compare two analysis snapshots:

```bash
node apps/cli/dist/index.js compare before/reviewdna.json after/reviewdna.json
```

This highlights new, removed, strengthened, and weakened conventions.

## Evidence, not vibes

A ReviewDNA rule is not simply “what an LLM thinks the codebase prefers.” The engine records evidence count, reviewer diversity, first/last seen dates, scope, recency, persistence, conflicts, documentation state, and an explainable confidence breakdown. A resolved thread contributes less confidence than evidence explicitly marked accepted, and a single review is not promoted to a convention by default.

## Quality gates

The repository includes unit/integration-style fixtures plus a small labeled synthetic classification benchmark. CI measures candidate precision/recall and category accuracy and fails when the baseline regresses. The synthetic benchmark is a regression guard, **not a claim of 100% real-world accuracy**. Real-world labeled benchmarks remain part of the v1.0 hardening plan.

Current quality gates cover bot filtering, minimum-evidence promotion, documentation drift, redaction, evidence weighting, Node 20/22/24, Docker build/smoke, and the composite Action.

## Local-first by design

The deterministic analysis does not require an AI provider. Optional OpenAI-compatible and Ollama adapters are isolated behind a provider interface. Review text is treated as **untrusted data**, not model instructions.

## Architecture

```text
GitHub → Collector → Normalizer → Classifier → Rule Discovery
       → Evidence Engine → Confidence / Conflict Analysis
       → Documentation Coverage / Drift
       → JSON + Agent Exports + Static Dashboard
```

Core classification, discovery/scoring, documentation/redaction, and historical comparison are separated into modules so semantic clustering can be added without turning the engine into a monolith. See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Security & privacy

No ReviewDNA account or telemetry is required. Tokens come from environment variables and are not serialized into reports. Review-derived HTML is escaped. Model adapters explicitly treat review text as untrusted input. See [`SECURITY.md`](SECURITY.md).

## GitHub Action

```yaml
- uses: ahmed2qaid/reviewdna/action@main
  with:
    repository: owner/repo
    max-prs: '100'
    min-evidence: '2'
    redact: 'false'
```

The composite Action builds ReviewDNA, analyzes the target, and uploads generated artifacts. Pin a commit SHA instead of `main` in security-sensitive workflows until stable version tags are published.

## Docker

```bash
docker build -t reviewdna .
docker run --rm -e GITHUB_TOKEN reviewdna analyze owner/repo --max-prs 100
```

## Roadmap highlights

Next major work: before/after diff acceptance evidence, provider-independent semantic clustering, richer rule evolution, incremental cache/resume, GitHub Pages reports, knowledge PRs, and a real-world labeled benchmark.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), [`ROADMAP.md`](ROADMAP.md), or the open issues.

## License

MIT
