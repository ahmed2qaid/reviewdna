# ReviewDNA migration guide

ReviewDNA is still pre-1.0. This guide records the compatibility rules maintainers and early adopters should use while moving between tagged releases and the development branch.

## From `v0.1.0` to current `main`

`v0.1.0` is the first immutable GitHub Action release. Current `main` contains additional ecosystem and hardening work that has not been retroactively added to that tag.

### GitHub Action users

Existing workflows pinned to:

```yaml
uses: ahmed2qaid/reviewdna/action@v0.1.0
```

continue to use the immutable `v0.1.0` source. Do not replace the pin with `@main` merely to receive new functionality; `main` is a development reference.

When a later tagged release is published, update the tag deliberately and review its release notes. For the strongest supply-chain pin, use the exact commit SHA behind a release tag.

### Analysis JSON

The public analysis contract remains:

```json
{
  "schemaVersion": "1.0"
}
```

The Draft 2020-12 JSON Schema lives at:

```text
packages/schema/analysis-result.schema.json
```

CI maintains an `AnalysisResult 1.0` ABI baseline. Existing required fields, published enum values and baseline properties cannot be silently removed while the schema continues to identify itself as `1.0`.

Consumers should still ignore optional fields they do not need. New optional fields can appear during the pre-1.0 product lifecycle when they are compatible with the published schema contract.

### Rule fingerprints

Fingerprints are compatibility anchors for decisions and comparisons. Current compatibility tests verify that fingerprints remain stable when equivalent evidence is reordered or transport-only metadata such as review IDs, reviewers or evidence URLs changes.

A future intentional fingerprint algorithm break must not be shipped as an invisible behavioral change. It needs migration notes and an explicit contract/version decision.

### Human decisions

Tracked decision files use:

```json
{
  "version": 1,
  "decisions": []
}
```

Keep `reviewdna.decisions.json` under normal code review. Unknown fingerprints are surfaced rather than silently treated as approvals. Every generated decision starts neutral unless a maintainer explicitly chooses `ignore`, `promote` or `override`.

### Cache and checkpoints

`.reviewdna/` is implementation state, not a permanent interchange format. ReviewDNA validates cache/checkpoint schema and input/options identity before reuse.

When upgrading after a cache/checkpoint format change, the safe recovery path is:

```bash
node apps/cli/dist/index.js analyze owner/repo --no-cache
```

or remove the local `.reviewdna/` directory and recollect. Do not preserve incompatible raw caches merely to avoid API requests.

Redaction modes automatically disable raw-review persistence when retaining unredacted intermediate data would defeat the requested privacy mode.

### Plugin SDK

The current extension contract declares:

```ts
apiVersion: '1'
```

Plugin API version and package release version are different concepts. A normal ReviewDNA package/repository release must not reinterpret an existing plugin API version incompatibly.

Plugins should use `definePlugin()`/`assertPlugin()` and should not depend on CLI private modules. Third-party plugins are executable Node.js dependencies and are not sandboxed.

### GitLab collector

The GitLab collector is currently a prototype. Its Merge Request `iid` maps into the existing `ReviewRecord.prNumber` compatibility field. Do not build provider-specific business logic that assumes the field name means GitHub Pull Requests.

GitLab-specific deep-evidence, CODEOWNERS and author-response parity are not yet guaranteed.

### Programmatic API

Use public workspace entry points such as:

```ts
import { discoverRules, applyAnalysisInsights } from '@reviewdna/core';
import type { AnalysisResult } from '@reviewdna/schema';
```

Avoid importing files from another package's `src/` or `dist/` internals. Those paths are not compatibility promises.

### Generated policy files

Suggested/proposed files remain review artifacts, not automatic policy. Upgrades must preserve the rule that ReviewDNA does not silently overwrite a repository's existing `AGENTS.md`, `CONTRIBUTING.md` or similar policy files.

Knowledge Proposal publishing remains dry-run-first and explicit.

## Before upgrading a production workflow

1. Read the target GitHub Release notes.
2. Run ReviewDNA against a representative repository snapshot.
3. Compare the new `reviewdna.json` with the previous output.
4. Review fingerprint and decision-file changes.
5. Inspect generated agent/contributor instructions rather than auto-merging them.
6. Re-run with privacy/redaction flags used in production.
7. Pin the selected release tag or exact commit SHA.

## Toward 1.0

ReviewDNA will not claim stable 1.0 contracts until real-world calibration work is complete and the schema, fingerprint, CLI and plugin behaviors have explicit stability commitments. Pre-1.0 migration notes will remain conservative rather than labeling experimental behavior as stable.
