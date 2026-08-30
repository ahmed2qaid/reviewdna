# ReviewDNA public demo

The public demo is generated from the repository's synthetic review fixture by the real ReviewDNA engine. It is not a hand-written screenshot and it is not presented as the policy of a real project.

## Build locally

```bash
npm install
npm run demo:site
```

This produces:

```text
_site/
├── index.html
├── share-card.svg
├── reviewdna.json
├── engineering-dna.md
└── .nojekyll
```

The builder first runs the normal fixture analysis, then derives the same structured Review Hotspots and Automation Opportunities used by production reports.

## Data provenance

The source data is `fixtures/reviews.json`, a synthetic `acme/backend` example designed to demonstrate recurring architecture, API validation and testing guidance.

Public demo surfaces are explicitly labeled:

- `Synthetic fixture` in the HTML report;
- `Synthetic demo` in the share card.

A normal GitHub-repository analysis instead keeps the existing `Unofficial analysis` language and evidence links to the source reviews.

## GitHub Pages

`.github/workflows/pages.yml` builds the site from scratch on pushes to `main` and on manual dispatch, uploads `_site` as a Pages artifact, and deploys it using GitHub's Pages deployment action.

The repository's GitHub Pages deployment source must be set to **GitHub Actions**. No branch-generated HTML is committed to `main`.

Expected project-site URL after Pages is enabled:

`https://ahmed2qaid.github.io/reviewdna/`

## CI

Normal pull-request CI runs `npm run demo:site` on Node.js 20, 22 and 24. That means changes to the report renderer, fixture pipeline or site builder must pass before a Pages change can merge.

## Safety

- The demo never silently analyzes a third-party repository.
- No provider key or GitHub token is required to build the synthetic demo.
- The static site has no ReviewDNA backend, account, telemetry or write permission.
- Automation Opportunities in the demo are suggestions for human review, not automatically installed policies.
- The downloadable share card is generated from the same analysis object and carries the synthetic-demo label.
