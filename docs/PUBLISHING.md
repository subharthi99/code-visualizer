# Repository and distribution

Public repository: [subharthi99/code-visualizer](https://github.com/subharthi99/code-visualizer).

The initial planning documents were pushed by the repository owner. Implementation changes are prepared locally; check Git status before committing or pushing. The current agent environment may restrict network connections and writes to `.git` even when the owner's terminal works normally.

## Validate and publish source

```sh
npm run check
npm test
npm run build
git status --short
git diff
# Stage only reviewed source, tests, documentation, and configuration.
git add README.md CONTRIBUTING.md package.json package-lock.json .editorconfig index.html src assets extension scripts tests docs
git commit -m "Implement pre-code learning workspace and LeetCode companion"
git push origin main
```

Do not commit generated `dist/` files, browser data, personal tracker exports, or credentials. Inspect remote history before pushing; never force-push to resolve an unexpected divergence.

## Distribute the alpha

`npm run build` produces `dist/web` for static HTTP hosting and `dist/extension` for Chrome's unpacked-extension workflow. No hosted deployment or browser-store publication is configured. Follow the [manual validation checklist](DEVELOPMENT.md) before sharing a release. The app is an early alpha, not an executed-code debugger.
