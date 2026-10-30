# Code Visualizer — Product Requirements Document

Status: proposed; no application implemented. Version 0.4, October 30, 2026.

## 1. Product outcome

Help a learner move from a problem statement to an independently reasoned algorithm, dry-run it before writing code, implement it, and reconstruct the reasoning later.

The core session is **understand → attempt → request a hint → write an algorithm → generate edge cases → dry-run → code → compare → recall**. See the [market study](MARKET_STUDY.md) for alternatives and evidence. This is a personal-first, open-source learning workbench, with broader adoption contingent on validation.

## 2. User and problem

Primary user: an independent learner practicing interview-style DSA and tracking progress in Notion. They need more detail than an animation, particularly when recursive execution returns to a suspended caller. They also struggle to connect related questions and retain reasoning after solving one.

Jobs to be done:

- Before code exists, break the problem into inputs, outputs, constraints, examples, and a first approach.
- When stuck, request the smallest useful hint without revealing the entire solution.
- Write a plain-language algorithm or pseudocode and manually dry-run it with visible state.
- Learn to generate valid edge cases, explain which assumption each challenges, and find small counterexamples to an approach.

- When a recursive call finishes, understand which frame resumes, what it receives, and what remains to execute.
- When encountering a question, identify useful constraints and invariants rather than match keywords blindly.
- When reviewing a solved problem, recover the idea quickly without immediately reading the full solution.
- Capture the current LeetCode question in one action and keep its hints, algorithm, edge cases, dry runs, and reviews together.
- Keep existing tracking data and avoid rebuilding a study history by hand.

## 3. Assumptions and decisions

- Desktop web plus a Chrome-first LeetCode companion extension. Python is a provisional first execution language, pending user preference.
- Local storage and user-controlled export first; no mandatory account, telemetry, or AI subscription.
- Small supported programs and examples first. Arbitrary production Python is outside the initial contract.
- Existing Notion schema has not been established; start with import mapping rather than assume column names or alter a workspace.
- MIT is the initial project license. Third-party dependencies and educational content retain their own licenses.

## 4. Scope and release gates

### Phase 0: validate reasoning before code

Prototype a problem workspace using authored exercises, hint ladders, pseudocode notes, and manually controlled state tables. Test whether a learner can devise and dry-run an approach without being handed code. No execution engine is needed for this phase.

Exit: learners can record a first attempt, request a targeted hint, revise their algorithm, and explain a completed dry run. Capture where hints helped or revealed too much.

### MVP: one complete pre-code learning loop

1. Problem workspace: restatement, inputs/outputs, constraints, examples, and a brute-force first attempt.
2. On-demand hint ladder: clarification → observation → guiding question → strategy → pseudocode outline. Full solution is a separate explicit reveal. Save attempts and hint usage.
3. Editable plain-language algorithm/pseudocode with numbered steps, branches, loop conditions, and recursion contracts.
4. Manual dry-run workspace: input, variables, array/tree sketch, call frames, return values, and a table of steps. The learner chooses and records each state transition; undo and replay preserve reasoning.
5. Three original exercises: tree depth, subsets, and pair-sum search. Include normal, boundary, and counterexample inputs plus authored hint ladders and reference dry runs.
6. Guided edge-case discovery: propose a case, request a category prompt or concrete example, predict the outcome, and attach it to an algorithm revision.
7. Chrome extension: capture the active LeetCode problem link, create or reopen its record, and use the learning workspace beside the question.
8. A small notebook, related-pattern comparisons, recall cards, a daily review queue, CSV import, and JSON backup/restore.

Manual dry runs must be labeled as learner-authored, not verified program execution. Free-form pseudocode is not automatically executable. Authored exercises may offer reference feedback after an attempt; custom problems initially support self-checking. Unsupported or ambiguous steps require clarification rather than invented execution.

### Next: connect reasoning to implementation

Add a Python editor and bounded trace playback only after the pre-code workflow is useful. Prove Python tracing in isolation against native results for calls, lines, returns, exceptions, and shared mutation. Keep authored model steps distinct from observed code events; mappings between them are learner-confirmed. If reliable tracing is infeasible, retain the pre-code MVP without claiming executable pseudocode support.

Execution examples can later expand to factorial, Fibonacci, binary search, tree path sum, grid DFS, and memoization. Execution requirements F1–F5 and F11 below apply to this later milestone, not the pre-code MVP release gate.

### Later

Automated execution of a clearly defined pseudocode subset; richer diagrams; more patterns; recursive/iterative and naive/memoized comparisons; optional Notion API sync; a validated adaptive scheduler; additional execution languages; optional AI hints grounded in the learner's attempt.

### Non-goals

A full LeetCode clone, automatic ingestion of paid editorials, real-time collaboration, public execution servers, mobile-first diagram editing, guaranteed memory retention, or automatic mastery claims from completion alone.

## 5. Primary experience

On a LeetCode problem page, the learner clicks the extension action. It captures the canonical question link and opens a companion workspace beside the question, creating or resuming the existing record. The same workspace can also start from a manually pasted URL or an original exercise. No code or full problem text is required for link capture.

The learner opens a problem without an editor or solution in the companion view. They restate the task, add an example, and describe an initial approach. When stuck, they choose a hint for understanding, strategy, recursion, dry-run state, or implementation. Hints reveal one level at a time, never automatically advancing to code.

For tree depth, the learner defines “what does one call return?”, writes the empty-tree base case, and describes how child results combine. They manually create frames for a three-node tree, record each child's return, and calculate the parent's result. They can revise a wrong step, inspect the earlier branch, and try an empty tree before coding.

The workspace saves algorithm revisions and dry-run snapshots. Later, code tracing can check implementation behavior against the learner's intended steps. Review starts from the problem and the learner's own memory cue, hiding hints, pattern labels, dry runs, and code until attempted or deliberately revealed.

## 6. Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| P1 | Start without code | A learner can save a problem, attempt, hints, algorithm, dry run, and recall card with no source code and no runtime initialized. |
| P2 | Progressive hints | For authored exercises, each level is independently revealed and recorded. Early levels do not name the final strategy or show solution code. Implementation hints stay optional. Custom-problem hints are limited to generic prompts unless explicitly supported; do not promise expert feedback on arbitrary problems. |
| P3 | Algorithm authoring | Persist numbered pseudocode/plain-language steps and revisions. Support notes for branches, loops, base cases, recursive contracts, and expected complexity without enforcing language syntax. |
| P4 | Manual dry run | Each snapshot stores algorithm revision, step ID, input, variables, frame IDs, object references, and learner explanation. A tree-depth run shows child returns combining into the parent result. A subsets run shows shared-list mutation and undo. Undo/replay restores snapshots exactly. |
| P5 | Self-check and counterexamples | Learners can record expected vs observed-by-hand output for normal and edge inputs, compare with authored references after attempting, and attach a counterexample to a revision. Self-checked outcomes are never labeled automatically verified. |
| P7 | Edge-case discovery | For each authored exercise, provide constraint-valid suggestions across applicable boundary and structural categories. Reveal category prompts before concrete cases on request. Record input, expected result or property, rationale, provenance, and algorithm revision. Learners can edit, deduplicate, dry-run, and save cases. Reference outcomes are distinguished from learner predictions; random inputs alone do not establish edge coverage. |
| P6 | Recall the approach | Reviews ask the learner to reconstruct an algorithm and one dry-run transition before revealing saved material; hint-assisted and independent attempts remain distinct. |
| P8 | LeetCode capture | One explicit extension action on a supported question page creates or reopens a record keyed by source and problem slug. Description, editorial, solutions, and submission routes for the same slug resolve to the same canonical question URL; query parameters and fragments do not create duplicates. Unsupported pages show a clear message and allow manual URL entry. |
| P9 | In-context workspace | The companion panel provides notes, progressive hint prompts, algorithm steps, edge cases, and dry-run access tied to the captured question. Existing records resume without resetting work. Question navigation must never attach edits to another problem silently. Reopening the panel or explicit Refresh recaptures the current URL; the captured question remains visibly labeled. |
| F1 | Accurate execution timeline | Every event has a stable ID, event kind, source location, and active frame. Labels distinguish “about to execute line” from completed effects. Nested expressions are not presented as separate executed statements unless instrumented. |
| F2 | Playback | Next, previous, first, last, step into/over/out, and a timeline are keyboard accessible. Step over/out navigates recorded events. An edit invalidates the old trace or retains it visibly as a separate version. |
| F3 | Recursion model | Each invocation has a unique frame ID and parent ID. Active, suspended, and returned frames have text labels as well as colors. Selecting a tree node selects its invocation. |
| F4 | Return handoff | Tree depth and branching Fibonacci correctly show the child result, caller, and resume location. Factorial `f(3)` returns 6 through distinct frames; repeated `f(1)` calls remain distinct invocations. Exceptions are not mistaken for successful returns. |
| F5 | Shared mutation | In subsets, frames referencing the same list point to the same object ID. Snapshots preserve historical values; append/pop effects are visible and backward navigation does not rewrite history. |
| F6 | Prediction | Authored checkpoints support next event, return value, caller, and mutation questions. Learners may skip; assisted/skipped attempts are distinguished from unassisted success. Free-text explanations use a visible rubric and self-assessment initially. |
| F7 | Pattern relationships | Each pattern stores applicability, invariant, pitfalls, and a counterexample. Related exercises explain a shared mechanism and a relevant difference; no opaque similarity score. Review mode hides labels initially. |
| F8 | Recall record | Store a learner-written cue, algorithm revisions, hint history, dry-run snapshots, invariant/base case, complexity rationale, mistake, and optional later trace bookmark. Revealing an answer never automatically marks mastery. |
| F9 | Review queue | Show due items and allow again/hard/good/easy ratings. Initial configurable intervals: again tomorrow, hard in 1 day, good in 3 days, easy in 7 days; these are transparent prototype rules, not an optimized memory model. Persist review history and a versioned scheduler policy. |
| F10 | Import/export | Preview CSV mapping for title, URL, topic, status, and notes; accept missing optional fields. Show invalid rows and duplicates before confirming. Repeat imports are idempotent by external ID or normalized URL. JSON export/import round-trips records, relationships, and review history. |
| F11 | Failure recovery | Infinite loops, excessive depth, unsupported values, syntax errors, and resource limits produce explicit messages. Cancel terminates execution while preserving saved notebook data. Truncation is clearly labeled and never presented as a complete trace. |

### LeetCode companion extension

**Primary journey:** open a question → click “Study this problem” → capture its link → work in a companion panel → resume the same notes on the next visit. Hints remain learner-triggered. A link by itself is insufficient to derive problem-specific constraints, hints, or valid edge cases: use generic prompts until the learner supplies the relevant specification or the question has explicitly supported educational content. Do not imply that importing a link provides expert guidance for every LeetCode problem.

Initial capture stores source, problem slug, canonical URL, optional display title, and capture time. For example, `https://leetcode.com/problems/two-sum/description/?envType=study-plan` becomes `https://leetcode.com/problems/two-sum/`. Use exact hostname and route validation rather than string matching. Title extraction is best-effort; fall back to an editable slug-derived label. LeetCode China and contest-only routes are deferred until explicitly supported. Capture links only; no bulk account-history import, automatic submission capture, cookie access, or code-editor mutation in the MVP.

Use a Chrome Manifest V3 extension with a side panel, validating the chosen browser APIs during the extension spike. Prefer user-gesture `activeTab` access and request only permissions needed for the enabled behavior. If extracting a visible title requires scripting, keep it narrowly scoped; URL-only capture must still work if extraction fails. Chrome documents [user-initiated content-script injection](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts). Side-panel availability and minimum supported Chrome version must be confirmed before implementation; provide an extension-owned workspace tab fallback.

Keep per-question work durable across panel closure and browser restart. Separate active tab context from the saved record; multiple LeetCode tabs must not overwrite each other's context. Save before switching questions, show the new title/URL, and let the learner stay on the prior record. Never collect a list of all open tabs merely to capture the active question.

Reuse workspace UI and data schemas across the web app and extension. Extension-origin storage and web-origin storage are separate: the MVP uses an extension-local notebook and explicit versioned JSON export/import to transfer records. Do not claim automatic synchronization. Later authenticated or local-device bridging needs a separately specified conflict-resolution and permission model.

Release checks: canonicalization and duplicate handling; supported URL variants; invalid hosts/routes; missing title; permission denial; same-tab question navigation; simultaneous tabs; restart recovery; offline notes; and JSON transfer preserving attempts, edge cases, dry runs, and review history. Store packaging and installation instructions belong to the extension milestone. No extension has been built or submitted to a browser store yet.

### Edge-case intuition workflow

The goal is to teach case generation, not merely supply a larger test list. First ask the learner to propose a case and name the assumption it challenges. Offer increasing help on request: category cue → guiding question → concrete valid input → reference outcome. Learners may request a concrete example immediately; record the assistance level without blocking progress.

Use the problem's actual constraints to select applicable categories: minimum/maximum size, repeated values, permitted zero/negative values, ordering, answer absence or multiplicity, boundary positions, and structural extremes. Empty inputs, duplicates, disconnected graphs, or cycles are useful only when allowed by the problem contract. Separate invalid-input robustness tests from valid edge cases. Let the learner correct inferred constraints before generating suggestions.

Each case stores an expected output **or property**, why it matters, and the assumption under test. For problems with several valid outputs, compare against a validity rule instead of one arbitrary output. Custom problems support generic category prompts and user-authored cases initially; authoritative generation and reference answers require an explicit problem specification and validator. Never claim a generated case disproves an algorithm without a demonstrated mismatch.

Examples:

| Exercise / contract | Prompt or case | Intuition to develop |
| --- | --- | --- |
| Pair-sum: distinct indices, exactly one valid index pair | `[3, 3]`, target `6` | Equal values can be valid when indices differ; a set-based assumption may lose useful multiplicity. |
| Same pair-sum contract | `[2, 3, 4]`, target `6` | Expected pair is indices 0 and 2 (zero-based). Reusing the single `3` is invalid. |
| Tree depth: empty tree permitted, root depth counted as 1 | Empty tree, single root, then a three-node chain | Clarify the base case, node-vs-edge convention, and skewed recursion depth. |
| Subsets: distinct input values, order irrelevant | `[]` gives `[[]]` | The empty input still has one subset; distinguish no results from the empty subset. |

When a proposed algorithm fails during a manual dry run, help the learner simplify the input while preserving the failure. In the MVP, this is guided manual reduction, not automatic counterexample minimization. Save the smallest demonstrated example with “what I assumed / why it failed / what changed.” Later executable checks can automate validation and shrinking for supported contracts.

For retention, ask the learner on a later visit to invent a fresh case for the same failure category before revealing saved cases. Track whether they can explain the challenged assumption, not just reproduce a remembered input.

## 7. Recursion teaching details

Use progressive disclosure: begin with a single call and its locals; expand the stack, then the tree. Keep code, events, and values synchronized. Explain five concepts separately: frame-local variables, suspended callers, base cases, returned results, and shared objects.

For backtracking, distinguish “returning from a call” from “undoing a mutation.” For memoization, distinguish a call tree from a merged dependency graph; identical arguments alone do not justify merging execution frames. Expandable text should explain state changes without requiring animation.

## 8. Technical direction to validate

The pre-code MVP needs a structured document/state editor and local persistence, not a Python runtime. Store Problem, Attempt, HintReveal, AlgorithmRevision, DryRunSnapshot, PatternLink, EdgeCase, SourceLink, and ReviewEvent records. A dry-run snapshot references a particular algorithm revision; editing the algorithm forks a run or marks earlier steps outdated. Free-form text is learner-authored reasoning, not an executable specification. The execution proposal below belongs to the later implementation milestone.

Proposed stack: TypeScript/React interface, an editor component, SVG diagrams, IndexedDB, and a Python runtime in a disposable Web Worker on a separate origin. This is a proposal, not an installed stack.

[Python's tracing API](https://docs.python.org/3/library/sys.html#sys.settrace) exposes relevant execution events. [Pyodide documents worker execution](https://pyodide.org/en/stable/usage/webworker.html); compatibility, performance, and serialization require the later execution spike.

Trace events contain sequence, kind, frame/parent IDs, source span, locals referencing a versioned object table, and return/exception payloads. Persist a code hash, input, engine version, and schema version with trace bookmarks. Avoid serializing user-defined objects by invoking arbitrary `repr` methods. Native-library internals, generators, async code, dynamic code generation, and external packages are initially unsupported or opaque, with explicit labels.

Initial proposed limits: 10,000 events, 100 visible call-depth levels, 5 seconds of execution excluding runtime startup, and 20 MB serialized traces. Validate and tune on a documented reference laptop. A host watchdog terminates the worker when tracing cannot interrupt work inside a native operation. Do not claim hard browser memory isolation.

## 9. Privacy, safety, and accessibility

User programs must not execute in the main UI context. A worker alone is not a security sandbox: execution-origin isolation, restrictive CSP/network policy, narrow message validation, and no access to application storage or credentials are required before accepting arbitrary code. Initially avoid remote execution and automatic third-party uploads. Imported CSV, notes, and rendered code are treated as untrusted text.

Keep personal study data out of the public repository. No analytics by default. Backup and deletion are explicit; local-only storage can be lost when browser data is cleared. API credentials for future Notion integration must never be bundled in client code.

Provide keyboard navigation, visible focus, reduced motion, non-color status labels, and a screen-reader-friendly event/stack table. Target WCAG 2.2 AA for core flows and verify manually in addition to automated checks.

## 10. Validation and success measures

Proposed targets, not observed results:

- At least 4 of 5 pilot learners produce a plausible algorithm and a complete small-input dry run before writing code, with hint usage recorded.
- At the later execution milestone, at least 4 of 5 pilot learners correctly identify the resumed caller and returned value on two unseen traces after onboarding.
- In a 7-day pilot, track unassisted explanation quality and transfer to a held-out related problem; seek directional improvement over time-matched use of the existing tool combination. Use a 0–3 rubric: missing, partial, correct with gaps, independently correct with rationale.
- At least 4 of 5 pilot learners independently propose two distinct valid edge-case categories for a held-out exercise and explain the challenged assumptions; compare against their baseline.
- At least 4 of 5 pilot learners capture a LeetCode question, create a note beside it, and reopen the same record without assistance.
- At least 4 of 5 learners complete one problem-to-algorithm-to-dry-run-to-review loop without facilitation.
- Warm trace generation for representative small examples under 2 seconds; timeline navigation under 100 ms at the 95th percentile on the reference machine. Report runtime startup separately.
- Golden trace tests pass for calls, returns, shared mutation, exceptions, and truncation. Export/import preserves all notebook and review records.

A small pilot cannot establish broad causal efficacy. Do not market retention gains until a stronger evaluation supports them. Stop expanding scope if the workflow adds friction without improving explanation or recall.

## 11. Delivery sequence

1. Baseline how the learner currently approaches a new problem and where they get stuck before coding.
2. Prototype authored hints, algorithm writing, guided edge-case discovery, and manual dry runs for three exercises.
3. Add notebook, review, CSV/JSON portability, and the LeetCode capture/companion extension; run the delayed-recall pilot.
4. Publish the pre-code alpha with clear self-checking limits and original educational content.
5. Validate the isolated trace engine and language contract as a separate milestone.
6. Connect intended algorithm steps to implementation traces and evaluate whether this adds learning value.

No implementation schedule is committed. The first release must be useful with no code pasted or written.

## 12. Open decisions

- Confirm the learner's primary coding language and adjust the execution spike accordingly.
- Inspect a deliberately shared tracker export to settle field mapping; do not publish personal tracker contents.
- Confirm the public GitHub repository destination; current CLI authentication must be repaired or another publishing route used.
- Choose hosting and pin runtime/dependency versions after the spike, not during market research.
