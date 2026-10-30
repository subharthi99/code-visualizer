# v0.2: context, authored guidance, and visual dry runs

## Implemented

1. **Question context:** explicit extension capture from a rendered Description container, separated statement/examples/constraints, editable preview, and per-field replacement checkboxes. Existing reasoning is preserved. The web app offers the same preview with manual paste. Captures are source-checked; delayed responses cannot attach to a different question.
2. **Question-specific hints:** original five-level lessons for eleven exact LeetCode URLs. Checkpoints respond to saved attempt keywords and the selected focus (approach, recursion, implementation). They are transparent authored rules, not AI grading. Unknown questions retain general prompts. The original three practice validators are not applied to broader LeetCode contracts.
3. **Visual dry runs:** editable arrays/cells and named pointers, binary-tree node editing and selection, shared-object identities with several references, active-call local editing, immutable diagram snapshots, and before/after changes for values, pointers, objects, trees, and call state. Older snapshots and backups remain supported.

Supported lessons: Two Sum, Maximum Depth of Binary Tree, Subsets, Valid Parentheses, Binary Search, Longest Substring Without Repeating Characters, Construct Binary Tree from Preorder and Inorder Traversal, Path Sum, Invert Binary Tree, Diameter of Binary Tree, and Merge Two Sorted Lists.

## Test-first evidence

Each feature boundary was scaffolded without behavior, then tested before implementation. The observed red results included missing parsed fields and selected-field application, absent explicit-capture message handling, missing authored lessons/checkpoints, unchanged pointer/tree/object states, missing visual snapshots, and unchanged active-frame locals. Implementations were added only after reproducing the intended failures, then checked alongside the existing regressions.

Additional red → green repairs:

- Exact lesson lookup rejects inherited object keys such as `constructor`.
- Browser inspection showed that an atomic SVG image hid interactive tree nodes. A failing render test drove a group role for editable trees while recorded trees remain images; real-browser node selection was rechecked.
- A delayed-capture test reproduced wrong-question preview after switching records. The response is now discarded when the active question changes.
- A packaging test caught differing app/extension versions; both now use 0.2.0.

Final verification: **53 Node tests pass**, syntax and packaging checks pass, and `git diff --check` is clean. Run `npm run check` and `npm test`. The Node suite tests parsing, source isolation, selective application, lesson matching, checkpoint selection, immutable visual edits, shared identity, invalid diagrams, backup compatibility, UI handlers, and packaging. These are separate from native browser checks.

## Native browser checks

Eleven CUA-driven Chrome assertions passed for authored lesson selection, editable context preview and field preservation, attempt checkpoints, visual array/pointer persistence and diffs, replay, accessible tree-node editing, shared-object mutation, and persistence after reload. Results are recorded in [0.2.0.json](browser-testing/0.2.0.json). These used the standalone app and labeled QA data; existing learner notes were preserved.

## Extension verification gate

The v0.2 build requests `activeTab`, `sidePanel`, and the newly added `scripting` permission. It still requests no persistent host access. The user must explicitly request an import; extraction reads only the rendered problem description and sends no content to an external service.

The previously installed v0.1 extension passed live LeetCode tests. Reloading v0.2 with its new permission and testing live description extraction is pending the installation-time approval requested in this conversation. The source and packaged extension are ready; this document does not claim that new extraction path has been live-verified.
