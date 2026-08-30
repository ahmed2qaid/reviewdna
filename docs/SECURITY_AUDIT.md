# ReviewDNA internal security audit — 2026-08-30

This document records an **internal engineering security review**, not an independent third-party penetration test or certification.

## Scope reviewed

The review covers the surfaces most likely to process attacker-controlled repository data:

- GitHub and GitLab review/comment collection.
- Review normalization and deterministic classification.
- Static HTML and SVG report rendering.
- Sensitive-data redaction.
- Optional remote model/refinement boundaries.
- GitHub Action input handling.
- Knowledge Proposal publishing safeguards.
- Plugin SDK trust boundaries.
- Large and malformed review corpora.

## Findings and controls

### Untrusted review text → static reports

Risk: review text can contain HTML, SVG, JavaScript-like strings, quote-breaking payloads, or `</script>` sequences.

Controls:

- Server-rendered HTML fragments escape `& < > " '`.
- Embedded analysis JSON replaces `<` with its escaped Unicode representation before entering the script block.
- SVG text is XML/HTML escaped.
- `tests/security-fuzz.test.mjs` injects HTML/script/image-event payloads and asserts that raw attacker markup is not emitted.

### Review text → optional LLM prompts

Risk: prompt-injection-like review text could try to alter refinement behavior or request secrets.

Controls:

- Deterministic analysis is the default and requires no model.
- Remote refinement is explicit opt-in.
- Provider system text labels review evidence as untrusted data.
- Refined wording is length bounded and must remain grounded in deterministic rule/evidence tokens.
- Suspicious instruction/output patterns are rejected and fall back to deterministic wording.
- Provider refinement does not change evidence or confidence.

### Credentials and PII in output

Risk: source reviews can contain tokens, API keys, credentials, emails, or phone numbers.

Controls:

- Targeted sensitive-data redaction covers supported GitHub/OpenAI/AWS/JWT/Bearer/credential/email/phone patterns.
- Redaction mode disables raw cache/checkpoint persistence automatically.
- Fuzz regression tests compose multiple credential classes and verify the original secret values are removed.

Limit: pattern-based redaction cannot guarantee discovery of every secret format. Users handling sensitive repositories should minimize retention and review generated artifacts before sharing.

### GitHub Action shell injection

Risk: workflow inputs can become shell fragments.

Control: user-controlled composite Action inputs are routed through environment variables and Bash argument arrays rather than directly interpolated into executable shell text.

### Knowledge Proposal publishing

Risk: an analysis tool with repository write permission could overwrite policy files or create unexpected branches.

Controls:

- Publishing is dry-run by default and requires explicit `--apply`.
- Proposal branches are constrained to the `reviewdna/*` namespace.
- Existing proposal branches are refused.
- The complete proposal bundle is validated before writes.
- Writes are scoped under `.reviewdna/proposals/<id>/` rather than overwriting `AGENTS.md`, `CONTRIBUTING.md`, or other policy files.
- A review Pull Request is opened rather than silently merging policy.

### Plugin SDK

Risk: a third-party plugin is executable Node.js code.

Controls in the contract:

- Plugin API version, kind, name and required capabilities are runtime validated.
- Scorers return bounded, explained contributions instead of mutating confidence directly.
- Exporters return artifacts; the host controls persistence.
- Collector results enter the host pipeline as normalized records.

Limit: plugins execute with the host process permissions. The SDK is not a sandbox. Third-party plugins must be treated like any other executable dependency and pinned/reviewed accordingly.

### Resource exhaustion

Risk: very large review histories or oversized review text can cause excessive CPU/memory use.

Controls:

- Collector limits exist for Pull/Merge Requests and per-request pagination.
- Large-repository CI benchmark exercises 10,000 synthetic reviews and records throughput/heap delta.
- A deliberately broad 60-second / 1-GB regression guard catches catastrophic performance regressions without pretending CI timing is a production SLO.
- Fuzz tests include multi-kilobyte review bodies.

### Cross-platform path behavior

Risk: Windows path semantics differ from POSIX paths.

Control: CLI E2E uses `fileURLToPath()` and runs on GitHub-hosted Ubuntu, Windows and macOS runners.

## Automated security gates

- CodeQL on every PR/push path configured by the repository.
- Deterministic security fuzz suite in normal Node 20/22/24 test matrix.
- Schema/fingerprint compatibility suite to detect silent contract changes.
- Docker smoke build.
- Local and immutable-release GitHub Action smoke tests.
- Cross-platform CLI E2E.
- Large-repository benchmark.

## Residual risks before 1.0

- Pattern-based secret detection is not a DLP product and can miss novel credential formats.
- GitLab evidence semantics are still a prototype and do not yet implement all GitHub-specific deep evidence signals.
- Remote model endpoints are external trust boundaries chosen by the user.
- Plugin code is trusted executable code, not sandboxed.
- No independent external penetration test has been performed.
- Real-world benchmark calibration still needs maintainer-labeled public datasets.

Security work is expected to continue as the schema, CLI and provider/plugin contracts approach 1.0 stability.
