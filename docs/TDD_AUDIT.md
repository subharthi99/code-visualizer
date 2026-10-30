# Test-first audit of the existing alpha

## Scope and provenance

The original alpha was implemented before its tests. This audit does **not** retroactively label that work TDD. It adds characterization coverage for existing behavior and uses failing tests to drive repairs. No production code was deliberately broken to manufacture a red result.

Baseline: 13 passing tests. After the audit: **32 passing tests**, with JavaScript syntax checks, build packaging, and `git diff --check` also passing. Counts describe tests, not line coverage or proof of correctness.

## Defects reproduced before repair

| Behavior | Observed red result | Repair and green verification |
| --- | --- | --- |
| Backup source identity | A custom record claiming `exercise:tree-depth` without an exercise source was accepted; test reported `Missing expected exception`. | Reject reserved exercise/LeetCode identities without the matching source. `node --test --test-name-pattern='backup identities' tests/audit.test.js` passes. |
| Recursive call-state consistency | A snapshot with two active calls was accepted; test reported `Missing expected exception`. | Require live frames to form a single suspended-ancestor chain ending in one active frame. Also cover orphan suspended frames and live children of returned parents. `node --test --test-name-pattern='dry-run snapshots reject' tests/audit.test.js` passes. |
| Malformed CSV quotes | A field like `"A title"garbage` was silently accepted; test reported `Missing expected exception`. | Track closing quotes and reject trailing characters before delimiters. `node --test tests/audit.test.js tests/domain.test.js` passes, retaining multiline/escaped-quote behavior. |
| Extension fallback | A synchronous side-panel error escaped the toolbar handler; test reported `Got unwanted exception: Panel unavailable synchronously`. | Catch synchronous errors, handle the outstanding configuration promise, and open the workspace fallback. `npm run build` followed by `node --test tests/extension.test.js` passes. |
| Duplicate edge inputs | Adding `[]` and `[ ]` produced two saved cases; test reported `2 !== 1`. | Compare normalized JSON while preserving original input text; object key order is irrelevant, array order remains meaningful. `node --test --test-name-pattern='case collection deduplicates' tests/workspace.test.js` passes. Simplified normalization after reaching green, then reran the suite. |

## Coverage map

| Area | Automated checks | Boundary / limitation |
| --- | --- | --- |
| Question capture | Canonical routes, source identity, unrelated or misleading URLs, duplicate identity | Does not exercise a live LeetCode page. |
| Hints and notes | One-level reveal, hidden later hints, custom generic prompts, note preservation on problem switch | Actual application handlers with controlled DOM and storage boundaries. |
| Algorithm authoring | Autosave before blur, revision history, cases attached to the saved revision | No real-browser keyboard or focus event automation. |
| Edge cases | Original contracts, invalid inputs, subset completeness for small inputs, duplicate JSON detection | Reference outcomes do not prove the learner's algorithm correct. |
| Dry runs | Snapshot immutability, child return/caller resumption, frame-chain validation, older-state replay | No visual-layout or real-browser rendering assertions. |
| Recall | Hidden saved reasoning, reconstruction preservation, rating/attempt history, all four intervals | Assistance remains a limited self-report heuristic. |
| CSV / JSON | Quoting, mapping, row errors, duplicate identities, backup round-trips and malformed records | Browser file-picker behavior remains manual. |
| Persistence | Commit vs request success, abort/error propagation, stale-write rejection, add-only imports, clearing, opening errors | IndexedDB event-contract doubles; not an IndexedDB engine or cross-tab browser test. |
| Extension | Minimal permissions, clicked-tab capture, unsupported pages, async and sync panel failure | Mocked Chrome APIs in the Node suite; a later native Chrome run added 17 passing live installed-extension assertions. |
| Packaging | Build both distributions; check standalone module syntax and inline styles | HTTP-server binding was previously blocked in this environment. |

## Workflow for subsequent changes

1. State the expected behavior and write the smallest relevant test.
2. Run it against unchanged production code. Confirm that it fails for the intended behavioral reason, not a broken fixture, syntax error, or missing build.
3. Make the smallest repair and rerun that test plus directly affected regressions.
4. Refactor only while green. Run `npm run check` and `npm test` before completion. Tests rebuild the packaged app and extension automatically.
5. Report red evidence, the repair, final results, and any manual-validation limits. Tests that pass on first addition are characterization tests, not evidence of a red–green cycle.

Use the [development checklist](DEVELOPMENT.md) for real-browser, accessibility, file import, and installed-extension validation. The added Node coverage does not imply browser checks. A subsequent [CUA browser run](browser-testing/2026-10-30.json) separately records 20 app and 17 live installed-extension assertions, with its remaining limits.
