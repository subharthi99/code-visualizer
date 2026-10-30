# Development

## Architecture

The app uses native JavaScript modules and CSS, with no runtime or development dependencies. This keeps the initial alpha usable without registry access or an AI service. The PRD's React/TypeScript stack was provisional; framework adoption can follow demonstrated complexity.

- `src/content.js`: three original exercises, hints, reference walkthroughs, and category prompts.
- `src/context.js`: capture normalization, selective context application, and source checks.
- `src/lessons.js`: eleven URL-matched authored lessons and attempt/focus checkpoints.
- `src/visual.js`, `src/visual-ui.js`: immutable diagram editing, graph validation, snapshot diffs, and accessible visual rendering.
- `src/domain.js`: problem identity, algorithm revisions, dry-run state transitions, case validators, review policy, and import validation.
- `src/persistence.js`: IndexedDB transactions with optimistic conflict detection for edits.
- `src/app.js`: accessible workspace UI and event handling. Imported content is rendered as text.
- `src/styles.css`, `src/theme.css`: responsive layouts, focus states, reduced motion, and design tokens.
- `extension/`: Manifest V3 toolbar capture and per-tab side-panel setup.
- `scripts/`: static preview, deterministic packaging, and syntax checks.
- `tests/`: Node's built-in test runner; no installation required.

Use two spaces and native ES modules. `.editorconfig` defines basic formatting. No formatter or linter dependency is installed; `npm run check` checks syntax, not style. Do not edit generated `dist/` files.

## Commands

```sh
npm run dev
npm run check
npm test
npm run build
```

The development server binds loopback only and serves the application entry point and public assets; it does not expose repository metadata or arbitrary workspace files. Build produces an HTTP-hostable app, a standalone preview, and an unpacked extension. The standalone artifact inlines a fixed, known list of modules without `eval` or a generic JavaScript bundler. Run syntax checks and the browser smoke test when changing module boundaries.

The standard app, standalone preview, and extension use different browser storage origins. Export/import is the explicit transfer mechanism. JSON/CSV imports only add missing identities, preserving existing records; they are not a synchronization protocol. CSV imports currently require a LeetCode link per row. JSON imports support custom and guided records.

## Learning behavior

Authored cases use explicit contracts. Tree input uses compact breadth-first JSON arrays with `null` children, such as `[1,2,null,3]`. Pair-sum requires exactly one pair of distinct indices. Subsets requires distinct input values. Eleven exact supported LeetCode URLs receive authored hint ladders. Other custom problems receive generic prompts, not inferred constraints or fabricated outcomes. Lesson guidance does not reuse the practice exercises’ narrower input validators on external questions. Captured context is previewed before selected fields are applied; the learner’s approach and algorithm are preserved. Stored attempts can select authored checkpoint questions using explicit rules and focus controls; no AI service is called.

Algorithm edits create a revision when a batch is autosaved or the editor loses focus. Saved snapshots retain their original revision and are labeled when outdated. Snapshots copy variables and frames; changing a later draft cannot mutate earlier states. The visual editor supports arrays and named pointers (including one-past-end), editable binary trees, and shared objects referenced by stable IDs. Diagrams are optional on old snapshots and are preserved in version-1 backups. Tree validation rejects cycles, dangling children, multiple parents, and disconnected nodes. Variable, pointer, object, tree, and call-state changes are shown against the preceding snapshot. This is manual state modeling, not automatic heap tracing. Active frame locals can be edited independently of suspended callers.

Recorded review attempts are stored with a rating and an assistance flag. The flag currently detects reveal without a written reconstruction; it cannot determine whether a learner relied on other hints. Review policy `fixed-v1` schedules again/hard/good/easy at 1/1/3/7 local-calendar days. It makes no mastery or retention guarantee.

## Chrome extension

Build first, then load `dist/extension` using Chrome's **Load unpacked**. The toolbar click grants temporary access to the clicked tab. Supported `https://leetcode.com/problems/<slug>/` routes and common description/editorial/solutions/submissions subpages canonicalize to the same identity. China and contest-specific routes are not supported.

The background handler configures a tab-specific side-panel path and opens it during the user gesture. It falls back to an extension-owned tab if opening the panel fails. Clicking on an unsupported page shows a message and leaves manual link entry available. Each explicit capture includes a nonce so repeating capture can reopen the current question. Browser navigation does not silently switch a saved record. Reclick the toolbar action after changing questions.

No persistent host permissions, automatic content scripts, cookies, or submission APIs are requested. v0.2 adds `scripting` for explicit description import through the temporary `activeTab` grant. `extension/extract.js` reads a rendered description container, never the whole page or editor. Message handling checks the sender, source tab, expected question identity, and post-extraction URL. Navigating to another question while capture is pending discards the response. Failed capture leaves manual paste available. Notebooks persist in extension-origin IndexedDB across panel closure. Installed-extension behavior was validated on Chrome 156.0.8078.48 on macOS arm64; browser-store publication remains separate. Neither mocked API tests nor one browser run establish compatibility with every supported Chrome version.

## Validation

See the [test-first audit](TDD_AUDIT.md) for the 32-test suite, reproduced failures, repairs, and explicit automation boundaries. New behavior and bug fixes must follow red → green → refactor; characterization tests added after implementation are identified separately.

Automated checks cover canonical identity and hostile URLs, immutable revisions and snapshots, caller resumption, authored edge-case contracts, CSV quoting/mapping/errors, backup round-trips and malformed data, calendar scheduling, extension permissions, and mocked capture/fallback behavior.

Browser walkthrough performed in Chrome using the standalone preview: open tree-depth exercise; save a restatement; reveal a hint; save algorithm revision; preserve a partially filled case while revealing a suggestion; save and reference-check an edge case; record a recursive return snapshot; schedule review; reload and verify saved notes, hint history, and revision.

A local HTTP smoke test was blocked in the implementation session because binding `127.0.0.1:5173` returned `EPERM`. A subsequent CUA-driven Chrome run passed 20 browser assertions using real IndexedDB, including native JSON/CSV file imports and two-tab conflict handling; see [browser results](browser-testing/2026-10-30.json). After explicit installation approval, 17 further assertions passed in the installed extension on live LeetCode pages: toolbar capture, canonical URL reuse, same-tab recapture, two-tab isolation, close/reopen and reload persistence, side-panel keyboard navigation, JSON transfer, unsupported-page guidance, and no runtime errors shown in the extension manager. The panel layout was visually inspected. Full screen-reader, multi-window, whole-browser restart, and cross-version validation remain outside this run. Do not claim accessibility conformance from markup alone.

For future releases, repeat the checks below. The current run covers core flows, imports, two-tab conflicts, and installed-extension operation; it does not certify every accessibility or failure-injection scenario:

1. Fresh browser: guided and custom problem creation, URL duplicates, reopen after restart.
2. Keyboard-only tabs, dialogs, form errors, reduced motion, and 360px layouts.
3. Two snapshots with different call states; previous/next preserves values and identifies old algorithm revisions.
4. JSON transfer between web and extension, malformed imports, repeat CSV import, and two-tab edit conflicts.
5. Real extension: toolbar capture, two LeetCode tabs, same-tab navigation, unsupported pages, panel close/reopen, permission denial, and fallback behavior.
6. A complete recall attempt, reveal, rating, due-date display, and fresh edge-case explanation.

## Still planned

Live code execution, automatic checking of learner pseudocode, adaptive scheduling, arbitrary-problem AI tutoring, richer editable tree diagrams, Notion API integration, and automatic cross-device synchronization. The current app supports a useful pre-code loop but does not fulfill every future requirement in the PRD.

## v0.2 verification

See [release evidence](RELEASE_0_2.md) and [v0.2 browser checks](browser-testing/0.2.0.json). The v0.1 installed-extension run is historical; the newly added scripting permission requires approval before v0.2 live extraction can be checked.
