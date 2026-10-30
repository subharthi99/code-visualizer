# Code Visualizer

A local-first workspace for reasoning through data structures and algorithms **before writing code**. Build an approach, challenge it with edge cases, dry-run it by hand, and revisit the reasoning later.

**Status: working early alpha (v0.2.0).** Includes a browser app and a buildable Chrome companion extension. No accounts, external AI calls, runtime dependencies, or paid services are required.

## Run locally

Requires Node.js 22 or newer. There are no packages to install.

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. Set `PORT` to use a different port.

```sh
npm test        # Build and run semantic, import/export, and extension-handler tests
npm run check   # Check JavaScript syntax and the extension manifest
npm run build   # Package dist/web and dist/extension
```

If a local server is unavailable, build and open `dist/web/standalone.html` in Chrome. Its notebook is separate from localhost and the extension; use JSON export/import to transfer work. The standard modular `index.html` must be served over HTTP.

## What you can do

- Start with three original exercises: tree depth, subsets, and pair-sum search—or add your own question or LeetCode link.
- Import the rendered LeetCode description, examples, and constraints on request. Review/edit the capture and choose which fields replace saved data. Manual paste works in the web app.
- Restate the problem, record constraints, and write an initial approach.
- Reveal progressive hints without immediately showing the solution. Eleven supported LeetCode questions receive authored five-level lessons and rule-based checkpoints tied to the saved attempt; unsupported questions receive general reasoning prompts.
- Write algorithms/pseudocode with saved revisions.
- Discover edge-case categories, request concrete inputs, predict outcomes, and check inputs against reference validators for the three guided exercises.
- Build editable arrays with named pointers, binary trees with selectable nodes, and objects with shared references. Record diagrams alongside variables, recursive frames, and return values. Replay snapshots and inspect what changed.
- Save memory cues and mistakes; reconstruct your reasoning and schedule a review.
- Import a Notion-style CSV with column mapping and row-error preview, or transfer a versioned JSON backup. Existing problems are preserved.

## LeetCode extension

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome 116 or newer.
3. Enable **Developer mode**, choose **Load unpacked**, and select `dist/extension`.
4. Open a LeetCode problem and click the extension's **Study this problem** toolbar action.
5. In **Understand**, choose **Import / edit question context** while the source tab is on Description. Review the capture and apply only selected fields.
6. Use the companion workspace beside the question. Click the toolbar action again to capture a different question.

Supported problem subpages resolve to one canonical URL, so revisiting a question reopens its notes. The extension requests only `activeTab`, `sidePanel`, and `scripting`; it does not inspect cookies, collect submission history, or modify the LeetCode editor. The v0.1 extension passed 17 installed-extension assertions on Chrome 156; see [browser results](docs/browser-testing/2026-10-30.json). The v0.2 context-import path adds `scripting` for explicit, read-only extraction; permission approval and live extraction verification are pending. See [v0.2 scope and test evidence](docs/RELEASE_0_2.md). See [development notes](docs/DEVELOPMENT.md) for limitations and the repeatable validation checklist. The extension is not published to the Chrome Web Store.

## Data and limitations

Data is saved in this browser's IndexedDB. Export backups; clearing site data or uninstalling the extension can remove your notebook. Web and extension notebooks do not automatically sync. Concurrent writes to the same record are rejected rather than silently overwriting newer work.

Dry runs are **learner-authored reasoning, not executed code**. Reference checks validate supported inputs and reveal expected outcomes; they do not execute or prove your algorithm correct. A LeetCode link alone does not supply its constraints: import or enter the specification. Authored lessons match exact supported question URLs; rule-based checkpoints are prompts, not algorithm correctness checks. Unsupported problems require self-checking.

Review intervals are transparent prototype rules, not an adaptive memory model. Python tracing, arbitrary pseudocode execution, Notion API sync, and additional languages remain future work.

## Project documents

- [Product requirements and implementation scope](docs/PRD.md)
- [Market study](docs/MARKET_STUDY.md)
- [Development, architecture, and validation](docs/DEVELOPMENT.md)
- [Test-first audit and coverage limits](docs/TDD_AUDIT.md)
- [Contributing](CONTRIBUTING.md)
- [Repository guidelines](AGENTS.md)

## License

[MIT](LICENSE). Examples are original; external practice questions are linked, not copied.
