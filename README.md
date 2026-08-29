# ReviewDNA 🧬

> **Your reviews already contain your engineering DNA.**

ReviewDNA mines Pull Request and code-review history into **evidence-backed engineering conventions** for humans and AI coding agents. Every discovered rule links back to the reviews that support it and includes an explainable confidence score.

```bash
npx reviewdna analyze owner/repository
```

> **Status:** early open-source release (`v0.1`). The deterministic engine, GitHub collector, evidence model, dashboard, agent exports, tests, and CI are implemented. Semantic clustering and acceptance tracking will continue to improve toward v1.0.

## Why ReviewDNA?

Engineering standards are rarely fully documented. They live in hundreds or thousands of review comments: “move this into the service layer”, “add a regression test”, “never log a token”, “validate the payload first”. ReviewDNA turns that hidden history into a verifiable knowledge layer.

**History + evidence + recurrence + scope + confidence + agent export.**

## What you get

Running an analysis creates:

- `reviewdna.json` — machine-readable knowledge graph seed.
- `reviewdna-report.html` — a zero-server interactive dashboard.
- `engineering-dna.md` — shareable Markdown report.
- `AGENTS.suggested.md` — suggestions for Codex/Copilot-style agents.
- `CLAUDE.suggested.md` — suggestions for Claude Code.
- `cursor.suggested.mdc` — suggestions for Cursor.

The source repository is never modified. Suggested agent instructions require human review.

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
GITHUB_TOKEN=github_pat_xxx node apps/cli/dist/index.js analyze owner/repo --max-prs 100
```

A token is optional for small public scans but strongly recommended because anonymous GitHub API limits are low. With a token, ReviewDNA also attempts to read resolved review-thread state for stronger evidence.

ReviewDNA also checks common repository instruction files (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, Copilot instructions, and Cursor rules) and reports **documentation coverage**: which historical conventions are already written down and which remain undocumented.

Compare two analysis snapshots:

```bash
node apps/cli/dist/index.js compare before/reviewdna.json after/reviewdna.json
```

This highlights new, removed, strengthened, and weakened conventions.

## Evidence, not vibes

A ReviewDNA rule is not simply “what an LLM thinks the codebase prefers.” The engine records:

- evidence count
- reviewer diversity
- first and last seen dates
- scope inferred from file paths
- accepted/resolved evidence when available
- recency and persistence
- conflicts
- a transparent confidence breakdown

Example:

```text
RULE-0007
API input should always be validated before service invocation.

Confidence: 91%
Evidence: 12 reviews / 5 reviewers
Scope: src/api/**
Status: strong
```

## Local-first by design

The current deterministic analysis does not require any AI provider. The provider package defines optional OpenAI-compatible and Ollama adapters for later semantic refinement. Review text is always treated as **untrusted data**, not model instructions.

## Architecture

```text
GitHub → Collector → Normalizer → Classifier → Rule Discovery
       → Evidence Engine → Confidence / Conflict Analysis
       → JSON + Agent Exports + Static Dashboard
```

Workspace packages:

- `@reviewdna/schema` — stable data contracts.
- `@reviewdna/core` — deterministic mining and scoring engine.
- `@reviewdna/github` — GitHub REST collector with pagination/rate-limit handling.
- `@reviewdna/providers` — optional LLM provider abstraction.
- `@reviewdna/exporters` — AGENTS/Claude/Cursor/Markdown outputs.
- `@reviewdna/report` — single-file interactive HTML report.
- `reviewdna` — CLI application.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`ROADMAP.md`](ROADMAP.md).

## Security & privacy

- No ReviewDNA account is required.
- No telemetry is included.
- Tokens are read from environment variables and are never written to reports.
- Review text is escaped in HTML reports to reduce XSS risk.
- Review comments are considered untrusted input for model adapters.
- The deterministic mode keeps analysis local except for direct GitHub API requests.

See [`SECURITY.md`](SECURITY.md).

## GitHub Action

A composite action scaffold is included under `action/action.yml`. It checks out the project, installs dependencies, builds the workspace, runs ReviewDNA, and uploads the generated report as an artifact. A publish-ready bundled action is planned before stable v1.0.

## Roadmap highlights

- richer semantic clustering with provider-independent embeddings
- before/after diff acceptance and rejected-evidence inference (resolved review-thread collection is implemented)
- documentation-drift conflict detection (documented-vs-undocumented coverage is implemented)
- lifecycle: emerging / established / stale / superseded
- stronger contradiction detection
- incremental cache and resumable scans
- share cards and GitHub Pages report publishing
- automatic knowledge PRs with human approval
- GitLab collector

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), the roadmap, or a `good first issue` once issues are published.

## License

MIT
