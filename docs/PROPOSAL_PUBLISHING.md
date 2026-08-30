# Publishing ReviewDNA Knowledge Proposals

ReviewDNA separates **discovering engineering conventions** from **writing anything to GitHub**.

The workflow is intentionally two-step:

1. `reviewdna proposal` builds a local, evidence-backed review bundle.
2. `reviewdna publish-proposal` can publish that bundle as a Pull Request, but only when `--apply` is explicitly supplied.

## 1. Build the local proposal

```bash
node apps/cli/dist/index.js proposal reviewdna-output/reviewdna.json --out reviewdna-proposal
```

The bundle must contain exactly these files:

- `reviewdna-proposal.json`
- `REVIEWDNA_PROPOSAL.md`
- `AGENTS.proposed.md`
- `CONTRIBUTING.proposed.md`
- `CLAUDE.proposed.md`
- `cursor.proposed.mdc`

## 2. Dry-run publishing

Dry-run is the default:

```bash
node apps/cli/dist/index.js publish-proposal owner/repo reviewdna-proposal \
  --branch reviewdna/proposal-architecture-rules
```

This validates the repository name, branch namespace, proposal id, and complete six-file bundle. The publisher returns a plan and performs **no GitHub network or write calls** in dry-run mode.

## 3. Explicitly publish

Set a token with permission to create a branch and Pull Request in the target repository, then add `--apply`:

```bash
GITHUB_TOKEN=github_pat_xxx \
node apps/cli/dist/index.js publish-proposal owner/repo reviewdna-proposal \
  --branch reviewdna/proposal-architecture-rules \
  --apply
```

Optional flags:

```text
--base <branch>          Base branch; otherwise the repository default is used.
--branch <reviewdna/*>  Required namespace for proposal branches.
--proposal-id <id>      Folder id under .reviewdna/proposals/.
--title <text>          Pull Request title.
--apply                 Explicitly permit GitHub writes.
```

## Safety guarantees

The publisher is deliberately constrained:

- it refuses branches outside `reviewdna/*`;
- it rejects duplicate, missing, or unexpected proposal files before writes;
- it rejects unsafe proposal ids;
- it refuses to overwrite an existing proposal branch;
- it writes only below `.reviewdna/proposals/<id>/`;
- it creates one proposal tree and one proposal commit;
- it opens one review Pull Request;
- it never overwrites `AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, Cursor rules, or other policy files;
- adopting any proposed policy remains a separate human decision.

## Why proposals are stored under `.reviewdna/proposals/`

ReviewDNA does not assume that a mined convention should immediately become repository policy. Keeping the proposal bundle separate lets maintainers inspect rule fingerprints, confidence, human decisions, and source evidence links before copying or adapting any guidance into official policy files.

## Failure behavior

Validation occurs before write operations. If the requested proposal branch already exists, publishing stops rather than force-updating it. If GitHub rejects the operation, ReviewDNA reports the API error; it does not force-push or overwrite existing refs.

For security-sensitive automation, pin ReviewDNA to a reviewed commit or stable tag once tagged releases are available.
