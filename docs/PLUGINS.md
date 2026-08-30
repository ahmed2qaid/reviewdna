# ReviewDNA Plugin SDK

ReviewDNA exposes a small, versioned extension contract through `@reviewdna/plugin-sdk`.

The current plugin API version is `1`. The SDK is deliberately separate from CLI internals so an integration can depend on the contract without importing the entire analysis engine.

## Plugin kinds

### Collector

Collectors return normalized `ReviewRecord[]` plus optional repository documentation. They do not mutate ReviewDNA state.

```ts
import { definePlugin } from '@reviewdna/plugin-sdk';

export default definePlugin({
  apiVersion: '1',
  kind: 'collector',
  name: 'example-reviews',
  async collect(request, context) {
    return {
      records: [],
      metadata: { repository: request.repository }
    };
  }
});
```

A collector can use `request.maxItems` and `request.cursor` for pagination. The host owns persistence and decides when returned records enter the analysis pipeline.

### Provider

Providers declare capabilities explicitly. A provider can implement embeddings, rule wording refinement, or both.

```ts
export default definePlugin({
  apiVersion: '1',
  kind: 'provider',
  name: 'local-embedding',
  capabilities: ['embedding'],
  recommendedThreshold: 0.3,
  async embed(texts) {
    return texts.map(() => [1, 0, 0]);
  }
});
```

Declaring a capability without implementing its method is rejected by runtime validation.

### Exporter

Exporters return artifacts to the host. The contract intentionally does not give exporters an unrestricted filesystem writer.

```ts
export default definePlugin({
  apiVersion: '1',
  kind: 'exporter',
  name: 'rules-jsonl',
  export(result) {
    return [{
      path: 'rules.jsonl',
      mediaType: 'application/x-ndjson',
      content: result.rules.map(rule => JSON.stringify(rule)).join('\n')
    }];
  }
});
```

The host decides whether and where returned artifacts are written.

### Scorer

Scorers return bounded, explainable signals. They do **not** mutate `rule.confidence` directly.

```ts
import { assertScoreContribution, definePlugin } from '@reviewdna/plugin-sdk';

export default definePlugin({
  apiVersion: '1',
  kind: 'scorer',
  name: 'documentation-signal',
  score(rule) {
    return assertScoreContribution({
      key: 'documentation-signal',
      value: rule.documented ? 0 : 2,
      reason: rule.documented
        ? 'The convention is already documented.'
        : 'The recurring convention is not documented.'
    });
  }
});
```

A score contribution must be finite and between `-25` and `25`, and must contain a human-readable reason. Applying a contribution to final confidence remains a host policy decision.

## Registry

`PluginRegistry` provides typed registration and lookup while rejecting duplicate `<kind>:<name>` identities.

```ts
const registry = new PluginRegistry();
registry.register(exporter);
registry.register(scorer);

const configuredExporter = registry.get('exporter', 'rules-jsonl');
```

Plugin names are lowercase slugs. `assertPlugin()` validates API version, name, kind, required methods, provider capabilities and optional threshold ranges at runtime.

## Safety model

Plugin contracts are input/output oriented. A plugin is not handed a mutable ReviewDNA pipeline object and cannot silently bypass evidence provenance, human decisions, redaction, or policy-export gates through the SDK contract itself.

Third-party plugin code still executes with the permissions of the host Node.js process. Treat plugins as executable dependencies: pin versions, review source, and use ordinary software supply-chain controls.

## Executable example

Run the repository example:

```bash
npm run example:plugin
```

It creates an exporter and scorer, registers them, analyzes the synthetic fixture with the real ReviewDNA engine, writes `plugin-example-output/rules.ndjson`, and prints a scorer contribution without applying it automatically.

See `examples/custom-plugin.mjs` and the SDK contract at `packages/plugin-sdk/src/index.ts`.

## Compatibility

The current extension contract is pre-v1 even though `apiVersion` is `1`. Breaking changes to the plugin contract require an explicit API-version change; normal repository releases must not silently reinterpret an existing plugin API version.
