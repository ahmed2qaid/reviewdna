# Programmatic API and JSON Schema

ReviewDNA can be used as a TypeScript/JavaScript library inside the workspace in addition to the CLI and GitHub Action. The packages are not published to npm yet, so the examples below describe the repository/workspace contract rather than claiming registry availability.

## Packages

- `@reviewdna/schema` — TypeScript contracts for review records, rules, analysis output, insights, decisions, and proposal manifests.
- `@reviewdna/core` — deterministic classification/discovery, documentation analysis, semantic interfaces, evolution, redaction, cost/checkpoint helpers, and structured insights.
- `@reviewdna/report` — static HTML dashboard and SVG share-card renderers.

## Public AnalysisResult JSON Schema

The machine-readable contract lives at:

```text
packages/schema/analysis-result.schema.json
```

The schema uses JSON Schema Draft 2020-12 and identifies the current output contract as:

```text
https://reviewdna.dev/schema/analysis-result-1.0.json
```

Within the workspace/package export map it is available as:

```js
import analysisResultSchema from '@reviewdna/schema/analysis-result.schema.json' with { type: 'json' };
```

Consumers that do not support JSON-module imports can read the exported JSON file using their normal filesystem or JSON Schema tooling. The JSON Schema is intended for editor validation, CI contracts, data pipelines, and integrations that consume `reviewdna.json` without importing TypeScript types.

## TypeScript contract

Type-only consumers can use the existing schema package:

```ts
import type { AnalysisResult, EngineeringRule, ReviewRecord } from '@reviewdna/schema';

function highConfidenceRules(result: AnalysisResult): EngineeringRule[] {
  return result.rules.filter(rule => rule.confidence >= 80);
}
```

## Run the analysis engine directly

The repository includes an executable example at `examples/programmatic-analysis.mjs`:

```bash
npm install
npm run example:programmatic
```

It reads `fixtures/reviews.json`, calls the deterministic core directly, derives structured insights, and writes:

```text
example-output/reviewdna.json
example-output/reviewdna-report.html
example-output/reviewdna-share-card.svg
```

The essential flow is:

```js
import { applyAnalysisInsights, discoverRules } from '@reviewdna/core';
import { renderHtml, renderShareSvg } from '@reviewdna/report';

let result = discoverRules(records, repository, 'fixture', { minEvidence: 2 });
result = applyAnalysisInsights(result);

const html = renderHtml(result);
const shareCard = renderShareSvg(result);
```

`discoverRules` remains deterministic. Optional GitHub collection, documentation scanning, semantic embeddings, AI wording refinement, tracked human decisions, checkpointing, and proposal publishing are separate layers rather than hidden behavior in this call.

## Contract safety

`tests/json-schema-contract.test.mjs` generates current programmatic output and validates it against the public schema subset used by ReviewDNA. It also verifies that invalid `schemaVersion` values and unknown top-level fields are rejected. CI runs this contract on Node.js 20, 22, and 24.

The JSON Schema is versioned independently through `schemaVersion`. Pre-v1 package/API surfaces may still evolve, so integrations should check `schemaVersion` before processing an analysis.
