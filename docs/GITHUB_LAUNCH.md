# ReviewDNA GitHub launch checklist

This file keeps the discovery/launch surface explicit and reproducible. It separates repository content from GitHub settings that require an administrator to change them in the UI.

## Repository About

Current repository description:

> Mine your team's code-review history into evidence-backed engineering rules for AI coding agents.

Recommended website after Pages is enabled:

`https://ahmed2qaid.github.io/reviewdna/`

## Recommended GitHub topics

The repository currently has no Topics configured. Use a focused set rather than keyword stuffing:

- `code-review`
- `developer-tools`
- `devtools`
- `ai-agents`
- `coding-agents`
- `agents-md`
- `github-actions`
- `static-analysis`
- `code-quality`
- `engineering-productivity`
- `typescript`
- `gitlab`
- `llm`
- `local-first`
- `open-source`

## Social preview

Ready-to-upload repository preview:

`docs/assets/reviewdna-social-preview.png` — **1200×630 PNG**

Source artwork:

`docs/assets/reviewdna-showcase.svg`

GitHub currently requires the social preview to be uploaded through repository settings; ReviewDNA does not pretend this can be changed by repository code alone. The artwork is deliberately labeled as a synthetic demo preview and does not claim production metrics from another repository.

## First-visit story

A new visitor should understand the project in this order:

1. What ReviewDNA does.
2. Why review history contains valuable hidden engineering knowledge.
3. A 60-second local demo.
4. A concrete example rule with evidence/confidence/scope.
5. Architecture and trust boundaries.
6. GitHub Action / Watch mode.
7. Plugin/API ecosystem.
8. Security and human-decision model.
9. Contribution path.

The top README is intentionally optimized for this sequence; detailed implementation material stays under `docs/`.

## Launch demo scenario

```text
A repository has years of review comments.
        ↓
ReviewDNA groups recurring guidance.
        ↓
Rules retain PR evidence and explainable confidence.
        ↓
ReviewDNA compares those rules with AGENTS/CONTRIBUTING/Copilot/Cursor docs.
        ↓
Maintainers review/promote/override discoveries.
        ↓
Approved knowledge becomes agent guidance or a reviewable Knowledge Proposal PR.
```

For screenshots, capture the generated `_site/index.html` / `demo-output/reviewdna-report.html` after a successful build. Use real generated output rather than a hand-drawn dashboard mockup.

## v0.2.0 launch status

Completed:

- ✅ CI green on the release head.
- ✅ CodeQL green on the release head.
- ✅ release metadata verified across root, CLI and all workspace package manifests.
- ✅ GitHub Release `v0.2.0` created from the tested release commit.
- ✅ README points to `ahmed2qaid/reviewdna/action@v0.2.0`.
- ✅ detailed release notes and Changelog explain the changes since `v0.1.0`.
- ✅ GHCR release image built from the release commit, pushed, pulled back from GHCR, and smoke-tested before the GitHub Release was created.
- ✅ repository README/showcase, Mermaid architecture, Quick Start, badges, demo scenario, launch copy and portfolio copy are committed.
- ✅ a real dashboard screenshot generated from ReviewDNA's reproducible synthetic public-demo output is committed at `docs/assets/reviewdna-dashboard.jpg` and displayed in the README.
- ✅ a ready-to-upload 1200×630 social-preview PNG is committed at `docs/assets/reviewdna-social-preview.png`.
- ✅ the public-demo workflow builds successfully on `main` and falls back to a downloadable workflow artifact while Pages is disabled.
- ✅ the immutable release workflow now auto-runs only when `VERSION` changes, so ordinary documentation/maintenance commits cannot attempt to move an existing release tag.
- ✅ Issue #5 reflects the current tagged-Action, demo-artifact and Pages status.

Administrative launch items still pending:

- ⏳ **GitHub Pages is currently disabled for the repository.** Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The build/artifact workflow already succeeds without this setting.
- ⏳ If anonymous Docker pulls are desired, change the GHCR `reviewdna` package visibility to **Public**. Authenticated release publication/pull is already verified.
- ⏳ **Repository Topics are currently empty.** Add the recommended Topics from this file in the repository About settings.
- ⏳ The repository description is already populated; set the Website field to the Pages URL after Pages activation.
- ⏳ Upload `docs/assets/reviewdna-social-preview.png` in **Settings → General → Social preview**.
- ⏳ After Pages activation, verify the live public-demo URL and then mark the remaining Pages item in Issue #5 complete.

## Suggested launch post

> Code reviews contain years of engineering decisions that rarely make it into documentation. ReviewDNA mines that history into evidence-backed conventions, keeps every rule traceable to real review evidence, detects documentation drift and rule evolution, and can export reviewed knowledge for coding agents. It is local-first, deterministic by default, and keeps humans in control of policy.

## Portfolio / personal site card

**ReviewDNA — Engineering Knowledge Mining**

Open-source developer tool that turns Pull Request and code-review history into evidence-backed engineering conventions. It includes explainable confidence, documentation drift, rule evolution, human decisions, GitHub/GitLab collectors, a static dashboard, agent exports, GitHub Actions, a Plugin SDK, and local-first privacy controls.

Suggested highlights:

- TypeScript / Node.js
- GitHub + GitLab review mining
- Evidence/provenance engine
- Static interactive dashboard
- AGENTS / Claude / Cursor exports
- GitHub Action and Watch mode
- Plugin SDK and public JSON Schema
- Windows/macOS/Linux CI
- Security fuzzing and CodeQL

Suggested links:

- GitHub: `https://github.com/ahmed2qaid/reviewdna`
- Release: `https://github.com/ahmed2qaid/reviewdna/releases/tag/v0.2.0`
- Live demo/docs: `https://ahmed2qaid.github.io/reviewdna/` after Pages activation
