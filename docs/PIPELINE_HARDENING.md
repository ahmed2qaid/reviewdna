# Resumable pipeline, cost preflight and sensitive redaction

ReviewDNA can process repositories with long review histories without treating every run as disposable. This layer adds resumable analysis, explicit cost estimates for optional remote AI stages, and selective secret/PII redaction.

## Resume safely

```bash
npx reviewdna analyze owner/repo --resume
```

ReviewDNA persists a versioned pipeline checkpoint under `.reviewdna/` when raw persistence is allowed. A checkpoint is reused only when all of the following still match:

- repository identity
- review/document content hash
- analysis option hash
- supported checkpoint schema version

A stale or mismatched checkpoint is ignored rather than silently reused.

You can override the checkpoint path:

```bash
npx reviewdna analyze owner/repo \
  --resume \
  --checkpoint-file .reviewdna/custom.pipeline.json
```

Disable pipeline checkpoints while keeping other behavior:

```bash
npx reviewdna analyze owner/repo --no-checkpoint
```

The scheduled Action example enables `resume: true` together with Action cache restoration so interrupted/previous work can be reused only when its content identity is still valid.

## Cost preflight

ReviewDNA does not hard-code provider prices because model/provider pricing changes independently of ReviewDNA releases.

It always treats token counts as estimates. Dollar estimates are produced only from prices supplied by the user.

```bash
npx reviewdna analyze owner/repo \
  --clusterer semantic \
  --embedding-provider openai-compatible \
  --embedding-model MODEL \
  --embedding-url https://provider.example/v1 \
  --estimate-cost \
  --embedding-input-price-per-million 0.10
```

For optional wording refinement:

```bash
npx reviewdna analyze owner/repo \
  --provider openai-compatible \
  --model MODEL \
  --provider-url https://provider.example/v1 \
  --estimate-cost \
  --llm-input-price-per-million 1.00 \
  --llm-output-price-per-million 4.00
```

### Budget guard

```bash
npx reviewdna analyze owner/repo \
  --estimate-cost \
  --max-remote-cost-usd 1.50 \
  --embedding-input-price-per-million 0.10
```

When a remote stage would make the aggregate estimate exceed the configured budget, ReviewDNA rejects the stage before the provider request. If a budget is configured but required price inputs are missing, ReviewDNA fails closed instead of pretending the dollar estimate is reliable.

A machine-readable estimate is written to:

`reviewdna-output/reviewdna-cost.json`

Local deterministic analysis and local embeddings do not require paid-provider pricing.

## Sensitive-text redaction

```bash
npx reviewdna analyze owner/repo --redact-sensitive
```

This mode preserves surrounding prose where possible while replacing common sensitive values such as:

- email addresses
- GitHub-style access tokens
- common API/secret-key assignments
- JWTs
- Bearer credentials
- international phone numbers

Example:

```text
Before: Contact alice@example.com, api_key=supersecretvalue12345
After:  Contact [redacted-email], api_key=[redacted-secret]
```

Sensitive redaction is applied across inferred rule text, evidence text, reviewer text, relevant paths/URLs, human-decision prose and rejected-review text.

For stronger anonymization of reviewers and paths, use:

```bash
npx reviewdna analyze owner/repo --redact
```

To remove evidence bodies entirely:

```bash
npx reviewdna analyze owner/repo --redact-evidence
```

## Privacy boundary

Any redaction mode disables raw review cache persistence and pipeline checkpoint persistence automatically. `--resume` is ignored in that situation because ReviewDNA intentionally refuses to persist the raw intermediate state needed for resume.

Redaction of generated artifacts does not change the source repository and does not write policy files.

## GitHub Action

The composite Action exposes the same controls:

```yaml
- uses: ./action
  with:
    repository: owner/repository
    mode: watch
    use-cache: 'true'
    resume: 'true'
    use-checkpoints: 'true'
    redact-sensitive: 'false'
    estimate-cost: 'true'
```

Optional user-supplied pricing and a budget can be passed with:

```yaml
    embedding-input-price-per-million: '0.10'
    llm-input-price-per-million: '1.00'
    llm-output-price-per-million: '4.00'
    max-remote-cost-usd: '2.00'
```

Do not put provider API keys in these inputs. Continue to provide credentials through GitHub Secrets/environment variables supported by the selected provider.

## Guarantees and non-guarantees

- A matching checkpoint is an optimization, not a source of truth; content/options identity is validated before reuse.
- Token counts are heuristic estimates, not provider invoices.
- Dollar estimates depend entirely on user-supplied pricing.
- Sensitive redaction targets known patterns and reduces exposure risk; it is not a formal DLP system.
- No cost or resume option grants ReviewDNA permission to modify repository policy files.
