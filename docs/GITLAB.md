# GitLab collector prototype

ReviewDNA includes an early GitLab REST collector in `@reviewdna/gitlab`. It proves that the collector layer can work outside GitHub and is also exposed through the versioned `CollectorPlugin` contract.

## Supported now

- GitLab.com and self-hosted GitLab through a configurable API `baseUrl`.
- Optional `PRIVATE-TOKEN` authentication.
- Merged Merge Request discovery ordered by recent update time.
- Merge Request discussion pagination.
- Normalization into ReviewDNA `ReviewRecord` values.
- Inline file paths from GitLab discussion positions.
- Resolvable/resolved discussion state.
- General Merge Request notes as `issue-comment` evidence.
- System-note filtering by default, with explicit opt-in.
- Plugin adapter through `createGitLabCollectorPlugin()`.
- Injected `fetch` implementation for deterministic offline tests.

## Programmatic use

```ts
import { GitLabCollector } from '@reviewdna/gitlab';

const collector = new GitLabCollector({
  token: process.env.GITLAB_TOKEN,
  baseUrl: 'https://gitlab.com/api/v4',
  maxMergeRequests: 100
});

const records = await collector.collect('group/project');
```

Self-hosted example:

```ts
const collector = new GitLabCollector({
  token: process.env.GITLAB_TOKEN,
  baseUrl: 'https://gitlab.example.com/api/v4'
});
```

## Plugin use

```ts
import { PluginRegistry } from '@reviewdna/plugin-sdk';
import { createGitLabCollectorPlugin } from '@reviewdna/gitlab';

const registry = new PluginRegistry();
registry.register(createGitLabCollectorPlugin({
  token: process.env.GITLAB_TOKEN
}));

const result = await registry.get('collector', 'gitlab').collect(
  { repository: 'group/project', maxItems: 100 },
  { repository: 'group/project', generatedAt: new Date().toISOString() }
);
```

## Prototype limitations

This is intentionally not yet feature-equivalent with the GitHub collector. It currently does not infer explicit author accept/reject responses, perform reviewed-commit-to-merged-head deep comparisons, collect CODEOWNERS, or cache Merge Request state incrementally. Those features require GitLab-specific evidence semantics rather than pretending GitHub signals map one-to-one.

The collector also uses the existing ReviewDNA `prNumber` field for a GitLab Merge Request `iid`. This is a cross-provider compatibility bridge in the current schema, not a claim that GitLab uses Pull Request terminology.

## Testing

`tests/gitlab-collector.test.mjs` uses a fully injected fetch implementation. CI therefore verifies URL encoding, token headers, filtering, resolution state, path normalization, and plugin behavior without making requests to GitLab.com.
