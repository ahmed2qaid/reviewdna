# ReviewDNA GitHub launch checklist

This file keeps the discovery/launch surface explicit and reproducible. It separates repository content from GitHub settings that require an administrator to change them in the UI.

## Repository About

Recommended description:

> Mine code-review history into evidence-backed engineering rules for humans and AI coding agents.

Recommended website after Pages is enabled:

`https://ahmed2qaid.github.io/reviewdna/`

## Recommended GitHub topics

Use a focused set rather than keyword stuffing:

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

Use `docs/assets/reviewdna-showcase.svg` as the source artwork for a repository social-preview image. GitHub currently requires the social preview to be uploaded through repository settings; ReviewDNA does not pretend this can be changed by repository code alone.

The asset is deliberately labeled as a synthetic demo preview and does not claim production metrics from another repository.

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

Administrative launch items still pending:

- ⏳ Enable GitHub Pages once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. The build/artifact workflow already succeeds without this setting.
- ⏳ If anonymous Docker pulls are desired, change the GHCR `reviewdna` package visibility to **Public**. Authenticated release publication/pull is already verified.
- ⏳ Set the repository About description and recommended Topics from this file.
- ⏳ Upload the repository social preview from `docs/assets/reviewdna-showcase.svg` (or an exported PNG of the same artwork).
- ⏳ After Pages is enabled, capture real generated dashboard screenshots from the deployed synthetic demo and add them to the README. Do not use hand-drawn fake dashboard screenshots.

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
