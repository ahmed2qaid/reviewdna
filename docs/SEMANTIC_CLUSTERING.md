# ReviewDNA Semantic Clustering

ReviewDNA's default clusterer remains deterministic token-overlap clustering. Semantic clustering is an optional evidence-grouping stage for review comments that express the same engineering convention with different wording.

## Safety boundary

Embeddings do **not** create rules. The pipeline remains:

```text
review records
  -> deterministic classification / noise filtering
  -> optional semantic grouping of surviving evidence
  -> the normal evidence + confidence + conflict pipeline
  -> documentation checks
  -> optional wording refinement
  -> human decisions
```

Semantic clustering cannot bypass `minEvidence`, bot filtering, evidence provenance, confidence scoring, conflicts, or human decisions.

## Local semantic mode

The zero-account option uses ReviewDNA's deterministic local feature embeddings:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --clusterer semantic \
  --embedding-provider local
```

`local-feature-v1` hashes normalized engineering concepts, word features, bigrams and a small transparent concept lexicon into normalized vectors. It is deterministic and offline. It is not marketed as a neural language model.

## Ollama embeddings

For stronger model-based semantic similarity while staying local:

```bash
node apps/cli/dist/index.js analyze owner/repo \
  --clusterer semantic \
  --embedding-provider ollama \
  --embedding-model nomic-embed-text \
  --embedding-url http://127.0.0.1:11434
```

The provider uses Ollama's `/api/embed` endpoint and can batch the classified review texts.

## OpenAI-compatible embeddings

```bash
REVIEWDNA_EMBEDDING_API_KEY=... \
node apps/cli/dist/index.js analyze owner/repo \
  --clusterer semantic \
  --embedding-provider openai-compatible \
  --embedding-model YOUR_EMBEDDING_MODEL \
  --embedding-url https://provider.example/v1
```

This calls the endpoint's `/embeddings` API. **Classified review text is sent to that endpoint.** Remote embeddings are never enabled implicitly.

Environment equivalents:

```text
REVIEWDNA_EMBEDDING_BASE_URL
REVIEWDNA_EMBEDDING_API_KEY
REVIEWDNA_EMBEDDING_MODEL
```

Embedding settings are intentionally separate from `REVIEWDNA_LLM_*`, which control optional wording refinement.

## Guarded clustering

A candidate can only join a semantic cluster when:

1. its deterministic ReviewDNA category matches;
2. its positive/negative polarity matches;
3. similarity to the cluster centroid passes the semantic threshold; and
4. similarity to every existing cluster member stays above a lower complete-link floor.

The final guard prevents chain merging, where A is close to B and B is close to C but A and C represent different conventions.

## Thresholds

Providers expose conservative defaults:

- `local-feature-v1`: `0.28`
- Ollama embeddings: `0.72`
- OpenAI-compatible embeddings: `0.76`

Override with:

```bash
--semantic-threshold 0.74
```

ReviewDNA records the chosen clusterer, embedding provider and threshold in `reviewdna.json` so analyses remain auditable.

## Quality gates

`benchmarks/semantic.json` contains labeled engineering paraphrase groups. `npm run benchmark` evaluates both the normal review-classification benchmark and the local semantic pair benchmark. The semantic benchmark is a regression guard, not a claim that the local feature embedding model has production-grade semantic accuracy.

Before v1.0 the model-based thresholds and clustering behavior still need calibration on a larger real-world labeled code-review dataset.
