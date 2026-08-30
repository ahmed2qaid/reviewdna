# ReviewDNA Semantic Documentation Drift

ReviewDNA first applies its deterministic lexical documentation matcher to repository instruction files, then can optionally add semantic matching with `--semantic-docs`.

Semantic documentation matching **supplements** lexical evidence. It never deletes lexical matches and it does not turn an embedding result into repository policy.

## What it compares

ReviewDNA scans its existing instruction sources such as:

- `AGENTS.md`
- `CLAUDE.md`
- `CONTRIBUTING.md`
- `.github/copilot-instructions.md`
- Cursor instruction files

`CODEOWNERS` is ownership metadata and is excluded from prose documentation matching.

## Local semantic documentation

The zero-account/offline path uses ReviewDNA's deterministic local feature embeddings:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --semantic-docs \
  --embedding-provider local
```

This can be used while rule clustering stays deterministic.

To enable both semantic rule clustering and semantic documentation matching:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --clusterer semantic \
  --semantic-docs \
  --embedding-provider local
```

## Model-based embeddings

Ollama example:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --semantic-docs \
  --embedding-provider ollama \
  --embedding-model nomic-embed-text \
  --embedding-url http://127.0.0.1:11434
```

OpenAI-compatible example:

```bash
REVIEWDNA_EMBEDDING_API_KEY=... \
node apps/cli/dist/index.js analyze owner/repo \
  --semantic-docs \
  --embedding-provider openai-compatible \
  --embedding-model YOUR_EMBEDDING_MODEL \
  --embedding-url https://provider.example/v1
```

Remote embedding providers are never enabled implicitly. When selected, ReviewDNA sends inferred rule text and repository instruction fragments to the configured embedding endpoint. Wording-refinement provider settings remain separate.

## Polarity safety

Embeddings often place opposite statements close together. ReviewDNA therefore separates semantic similarity from policy direction.

For a rule such as:

```text
Validate API request input before service calls.
```

these can be semantically close:

```text
Request payload checking belongs before service invocation.
Never validate API request input before service calls.
```

The first can become semantic `support`; the second is evaluated as semantic `conflict` because its polarity is opposite.

A semantic conflict also has to beat the strongest same-polarity match in the same document by a margin. This reduces false drift warnings when a file contains mixed examples or historical text.

## Auditable provenance

Each rule can expose `documentationEvidence` entries:

```json
{
  "path": "AGENTS.md",
  "kind": "support",
  "matcher": "semantic",
  "score": 0.842
}
```

or:

```json
{
  "path": "CONTRIBUTING.md",
  "kind": "conflict",
  "matcher": "lexical",
  "score": 0.314
}
```

The dashboard exposes these entries directly so a documentation decision is inspectable rather than opaque.

## Resource controls

Semantic documentation matching is bounded by default:

- up to 400 documentation fragments total;
- up to 80 fragments per source;
- embedding batches of 64 inputs.

The core API exposes these limits through `SemanticDocumentationOptions`.

The CLI can override the semantic support threshold with:

```bash
--documentation-semantic-threshold 0.72
```

Provider defaults are used when the flag is omitted.

## Watch mode

Watch comparison tracks changes to documentation provenance in addition to documented/undocumented state and conflict source lists. A change in matcher or similarity evidence is surfaced as `documentation-evidence`.

## GitHub Action

The composite Action supports the same feature:

```yaml
- uses: ./action
  with:
    repository: owner/repository
    mode: watch
    semantic-docs: 'true'
    embedding-provider: local
```

`examples/reviewdna-watch.yml` demonstrates a scheduled fork-ready configuration using local embeddings and no external embedding account.

## Security note

The Action passes user-controlled inputs through environment variables and Bash argument arrays rather than interpolating them directly into executable shell command text. This reduces shell-injection risk in reusable workflow inputs.

## Calibration status

The local feature matcher and current thresholds are regression-tested but are not claimed to be universally calibrated. Before v1.0, ReviewDNA still needs a larger real-world labeled benchmark for documentation support/conflict precision and recall.
