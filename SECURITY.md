# Security Policy

## Reporting
Please report suspected vulnerabilities privately through GitHub's security reporting features when enabled. Do not publish credentials or exploit details in a public issue.

## Threat model
ReviewDNA processes untrusted repository metadata and human-authored review text. That content can contain malicious HTML, misleading instructions, prompt injection, oversized payloads, or secrets.

Current mitigations:
- HTML report output escapes review-derived text.
- Provider prompts state that review text is untrusted data.
- Core analysis never executes code or shell commands from repository content.
- GitHub tokens are read from environment variables and not serialized into result files.
- Provider adapters require explicit configuration; deterministic mode is the default.
- Bot-authored review guidance is excluded by default.
- A single review is not promoted into a convention by default.

## Local cache
Incremental analysis can store raw review records under `.reviewdna/`. The directory is gitignored. `--redact` and `--redact-evidence` disable raw-review caching automatically because a redacted report should not silently leave an unredacted cache behind. Use `--no-cache` for any workflow where local retention is not appropriate.

Before v1.0 we plan dedicated prompt-injection, XSS, path-handling, token-leakage, malformed-API, and large-input fuzz tests.
