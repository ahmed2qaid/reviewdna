# Contributing to ReviewDNA

Thanks for helping turn hidden review knowledge into verifiable engineering guidance.

## Development

```bash
npm install
npm run typecheck
npm test
npm run demo
```

## Contribution principles
- Preserve evidence provenance.
- Avoid opaque scores; new scoring factors should be explainable.
- Never treat review text as executable instructions.
- Keep deterministic/local operation available.
- Add tests for behavioral changes.
- Do not introduce people-ranking features; ReviewDNA analyzes engineering knowledge, not employee performance.

## Pull requests
Keep PRs focused and explain the user-visible behavior, tests, security/privacy implications, and schema changes.
