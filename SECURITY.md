# Security Policy

## Reporting
Please report suspected vulnerabilities privately through GitHub's security reporting features when enabled. Do not publish credentials or exploit details in a public issue.

## Threat model
ReviewDNA processes untrusted repository metadata and human-authored review text. That content can contain malicious HTML, misleading instructions, prompt injection, oversized payloads, or secrets.

Current mitigations:
- HTML report output escapes review-derived text and embedded JSON protects `<` from terminating script data.
- SVG share-card text is escaped.
- Provider prompts state that review text is untrusted data.
- Core analysis never executes code or shell commands from repository content.
- GitHub tokens are read from environment variables and not serialized into result files.
- Provider adapters require explicit configuration; deterministic mode is the default.
- Bot-authored review guidance is excluded by default.
- A single review is not promoted into a convention by default.
- User-controlled GitHub Action inputs are passed through environment variables/argument arrays rather than direct shell interpolation.
- Knowledge Proposal publishing is dry-run-first and writes only to a constrained proposal namespace/branch.

## Local cache
Incremental analysis can store raw review records under `.reviewdna/`. The directory is gitignored. Redaction modes disable raw-review caching/checkpoints automatically because a redacted report should not silently leave unredacted pipeline state behind. Use `--no-cache` when local retention is not appropriate.

## Sensitive-data redaction
`--redact-sensitive` can scrub supported email, GitHub/OpenAI/AWS token/key, JWT, Bearer credential, credential-assignment, and international-phone patterns while preserving surrounding prose. Pattern-based redaction is a mitigation, not a guarantee that every possible secret format will be detected.

## Optional model providers
Deterministic mode sends no review text to an AI provider. Ollama can run locally. `openai-compatible` is explicit opt-in and sends selected evidence to the configured endpoint. Model output is treated as untrusted: ReviewDNA rejects suspicious prompt-injection-like responses and requires grounding in the deterministic rule/evidence before accepting rewritten wording. Provider refinement cannot change confidence values or evidence provenance.

## Plugin trust boundary
Third-party ReviewDNA plugins are executable Node.js dependencies and are **not sandboxed**. The Plugin SDK constrains data contracts (version/kind/capabilities, bounded scorer contributions, host-controlled exporter persistence), but installing a plugin grants it the permissions of the host process. Pin and review plugin source like any other executable dependency.

## Automated hardening
The repository includes deterministic fuzz tests for malformed/oversized text, HTML/script injection, report escaping and supported credential redaction. It also runs CodeQL, schema/fingerprint compatibility checks, a 10k-review benchmark, Docker/Action smoke tests, and CLI E2E on Ubuntu, Windows and macOS.

See [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) for the current internal review scope, controls and residual risks. This is an internal engineering audit, not a third-party security certification.
