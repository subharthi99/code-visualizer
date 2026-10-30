# Code Visualizer

An open-source learning workbench proposal for reasoning through DSA problems before coding, writing algorithms, dry-running them, and retaining the approach.

**Status: planning only. No application, demo, build system, or test suite exists yet.**

## Start here

- [Market study and existing-tool recommendations](docs/MARKET_STUDY.md)
- [Product requirements and acceptance criteria](docs/PRD.md)
- [Contributor guide](AGENTS.md)
- [Contributing](CONTRIBUTING.md)

## Proposed learning loop

Understand the problem → attempt → request a hint → write an algorithm → generate edge cases → dry-run → code → compare → recall.

The first proposed focus is a pre-code workspace: progressive hints, editable algorithms/pseudocode, guided edge-case generation, and learner-controlled dry runs with variables and call frames. A Chrome-first LeetCode extension will capture the current question link and keep this workspace beside the problem. Code execution tracing comes later. This approach still needs validation.

## Before implementation

Try Python Tutor for execution, Hello Interview for visual patterns, and Anki for recall. The market study explains the tradeoffs. These cover parts of the workflow. The first milestone is a pre-code learning session with authored hints and manual dry runs; it requires no execution engine.

## Open-source participation

Contribute feedback on the PRD, original examples, or reproducible descriptions of confusing execution behavior. Do not include private study notes, credentials, or copied paid problem statements. Development commands will be documented when the toolchain is selected.

## License

[MIT](LICENSE). Third-party code and content retain their respective licenses.
