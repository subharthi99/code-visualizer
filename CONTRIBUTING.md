# Contributing

This project has an early alpha implementation. Read the [PRD](docs/PRD.md), [market study](docs/MARKET_STUDY.md), and [repository guidelines](AGENTS.md) before proposing work.

## Useful contributions

- Identify a confusing call, return, shared mutation, or pattern distinction using a small original code example.
- Challenge a requirement with a concrete learner scenario or an existing tool that already addresses it.
- Suggest original recall questions and state the expected answer and misconception being tested.
- Correct research with a direct source link and the date checked.

## Changes and pull requests

Follow strict test-driven development for behavior changes and bug fixes: write a behavioral test, run it and confirm the intended failure, implement the smallest passing change, then refactor while green. Record the red and green results in the pull request. Tests added to already-working behavior are characterization coverage; do not describe them as retroactive TDD. See the [test-first audit](docs/TDD_AUDIT.md) for examples and coverage limits.

Keep changes focused. Explain the problem, resulting behavior, validation, and limitations. Link related issues where available; include screenshots when a visual interface exists. Use concise imperative commit subjects, for example `Clarify recursive return requirements`.

Run `npm run check`, `npm test`, and `npm run build` before proposing implementation changes. Node 22+ is required; no package installation is needed. See [development notes](docs/DEVELOPMENT.md) for architecture and the manual browser checklist. Documentation changes should have working relative links and accurately state implementation status. Trace-engine changes require semantic regression tests; visual changes require keyboard and reduced-motion checks.

## Content and privacy

Submit only material you are entitled to share. Attribute third-party dependencies and content, and preserve applicable license notices. Link to external practice questions instead of copying restricted statements or editorials. Exclude personal tracker exports and credentials. Contributions are provided under the project's MIT license.
