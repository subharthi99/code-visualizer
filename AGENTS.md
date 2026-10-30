# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty project directory. No source code, tests, assets, dependency manifests, or build configuration exist yet. As the project grows, organize application code in `src/`, automated tests in `tests/`, and static resources in `assets/` where appropriate. Keep related modules together and document the chosen structure in `README.md`.

## Build, Test, and Development Commands

No build, test, or local development commands are configured. When introducing a toolchain, add reproducible commands to the project manifest and document them in `README.md`. Include dependency installation, local startup, production builds, and test execution. Do not assume commands such as `npm test` work until the corresponding configuration exists.

## Coding Style & Naming Conventions

Follow the conventions of the language and framework selected for the project. Use consistent indentation within each file, descriptive names, and small modules with clear responsibilities. Configure a formatter and linter alongside the first implementation, and commit their configuration so contributors use the same rules. Avoid introducing competing formatting tools.

## Testing Guidelines

No testing framework or coverage threshold is established. Add tests with new behavior and regression tests with bug fixes. Use descriptive test names that identify the behavior and expected result. Document the selected framework, test file naming pattern, and exact execution command when tests are introduced.

## Commit & Pull Request Guidelines

No Git repository or commit history is available to establish existing conventions. Use concise, imperative commit subjects, such as `Add code parsing module`, and keep commits focused. Pull requests should explain the change, reference relevant issues, and describe validation performed. Include screenshots for visible interface changes and identify any setup steps or known limitations.

## Security & Configuration

Keep credentials and local environment files out of version control. Provide placeholder configuration examples when configuration becomes necessary, and document required environment variables without including secret values.
