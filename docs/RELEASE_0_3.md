# v0.3: connect patterns, challenge assumptions, and reconstruct from memory

## Implemented

- **Pattern discovery:** a Patterns tab for eleven authored LeetCode identities and their guided equivalents. Each comparison explains a signal, invariant, failed assumption, and related questions with different contracts. Opening a related question preserves existing notes. Unknown questions receive manual comparison prompts. Optional pattern notes transfer in version-1 backups.
- **Edge-case practice:** predictions are required before suggested outcomes are revealed, and copying a suggestion preserves the prediction. Three additional bounded local reference contracts cover Valid Parentheses, Binary Search, and Longest Substring Without Repeating Characters. The UI states their small-input limits. Other linked questions remain learner-checked; the narrower guided validators are never silently reused for external questions.
- **Smaller failures:** attach a learner-observed input/result mismatch and lesson to an original case without replacing it. Supported input contracts are checked; manual observations do not prove algorithm failure or minimality. Histories survive export/import and malformed histories are rejected.
- **Recall:** reconstruct an approach, one transition, and a fresh case before revealing saved reasoning or past failure lessons. Evidence is latched at reveal. Explicit help or missing evidence produces a one-day retry; complete independent self-ratings grow intervals under documented bounded rules. Historical events remain unchanged. The queue separates due, upcoming, and unscheduled questions and summarizes self-rated history. Tomorrow scheduling follows local calendar days, including daylight saving changes.

## Test-first evidence

Feature modules began with empty behavior. Tests first failed on absent pattern connections, missing references and challenges, missing failure records, unchanged recall intervals, absent prompts, and absent queue grouping. Application-handler tests then reproduced missing navigation, ungated reveals, early mistake disclosure, and post-reveal evidence replacement before implementation.

Regression tests also reproduced optional-note backup incompatibility, malformed histories, help acknowledgement not updating intervals, lost checkbox drafts, and a 24-hour “tomorrow” calculation landing on the wrong local date across the November daylight saving transition. These were repaired before final validation.

Validation: `npm run check`, `npm test` (**72 tests**), and `git diff --check`. The test command builds both distributions and syntax-checks the standalone bundle. Native Chrome checks cover the standalone app; see [browser evidence](browser-testing/0.3.0.json). No dependencies or external services were added. AGENTS.md was preserved.

## Remaining verification

The user approved reloading with `activeTab`, `sidePanel`, and `scripting`. Core live extraction passed on Two Sum and Valid Parentheses: statement/examples/constraints preview, selected-field application, preservation of saved notes, source-question mismatch rejection, and reopening saved context. Live testing exposed flattened superscript bounds; a failing regression drove a read-only subtree serializer, and the corrected exponents were verified on both pages. See [live extraction evidence](browser-testing/2026-11-01-live-extraction.json).

Solutions import failed safely, but its generic URL error was misleading. New red → green regressions drove Description-only checks before injection, explicit expired-access and missing-result messages, and a second source-identity check after extraction. These final background-handler changes pass automated tests; native rechecking was blocked by repeated computer-use failures and a stale accessibility menu. The last reload attempt was not confirmed. This is an automation blocker, not pending user permission. Whole-browser restart and forced permission revocation remain outside the live run.

`npm run dev` remains blocked in this environment by `listen EPERM` on 127.0.0.1:5173; browser checks used the standalone build. Whole-browser restart, additional browser versions, screen-reader testing, and a retention pilot remain outstanding. Actual line-by-line code execution is the next separate milestone; this release still uses manual dry runs.
