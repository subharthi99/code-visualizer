# Python tracing preview

The next milestone in the PRD is connecting reasoning to implementation. This development slice implements local CPython tracing and browser playback. The existing pre-code learning loop remains available without a Python installation. Package and extension versions remain at the released 0.3.0 version until a release is prepared.

## Try it

Requires Node.js 22+ and CPython 3.9+ on macOS or Linux. No packages or external services are installed. From the repository root:

```sh
node scripts/trace.mjs assets/examples/factorial.py > /tmp/factorial-trace.json
npm run dev
```

Open a problem, select **Code**, and import `/tmp/factorial-trace.json`. Alternatively expand **Paste trace JSON instead** and paste the file's contents. The initial import fills an empty source editor; an existing source draft is preserved. The editor can download `program.py`, which you trace with the same command before importing a replacement result.

You can also use `npm run --silent trace -- program.py > trace.json`. The `--silent` flag prevents npm's command headers from corrupting the redirected JSON. Set `PYTHON=/path/to/python3` for the CLI if Python is installed under another name. The automated tests use `python3`.

Both `dist/web/standalone.html` and the extension can replay traces after `npm run build`. Their storage origins remain separate. JSON notebook export/import includes Python source and the current trace, with the existing add-only import behavior. A trace can make a notebook large; the existing 5 MB notebook import ceiling still applies.

## Execution contract

Run your own trusted study programs only. This is an explicit local process with restricted language features and resource limits, **not a security sandbox**. `-I` isolates Python's environment and import path; it is not an OS security boundary. No execution endpoint or new extension permission is added.

Supported syntax includes normal functions and recursion, assignment, conditionals, for/while loops, indexing and slicing, arithmetic/comparisons, scalar values, lists/tuples/dictionaries/sets, and try/except/finally. Programs include their own small input and top-level call. There is no separate input-field or LeetCode harness yet.

The allowed builtins and collection methods are enumerated in `scripts/trace_python.py`. They include `range`, `len`, `min`, `max`, `sum`, `enumerate`, `sorted`, and append/pop/copy/get/items. Imports, classes, generators, comprehensions, async, decorators, double-underscore names, arbitrary attributes, and dynamic code generation are rejected. Unsupported runtime values stop capture explicitly; functions defined by the program are omitted from locals rather than serialized. A builtin operation has no internal Python line events.

Current limits are deliberately below the PRD's eventual targets:

| Resource | Preview bound |
| --- | --- |
| Source | 20,000 characters |
| Trace | 1,000 events, 3 MB serialized events |
| Active calls | 50, including the module frame |
| Local variables | 200 per frame |
| Collections | 50 entries each, 256 identities per run |
| Strings / stdout | 1,000 / 8,000 characters |
| Time | 3-second Python alarm, 4-second CPU limit, 5-second host deadline |
| Memory | 512 MB address-space limit on Linux; no hard memory cap claimed on macOS |

Event, depth, value, and Python-alarm limits preserve already captured events and label the trace `limited`. Syntax/runtime errors are `error`; failed runs are never marked complete. If a native operation exceeds the host deadline or the OS kills Python, the CLI emits a failure to stderr and exits nonzero; it does not emit a purported complete trace. Ctrl-C cancels the local foreground command. The notebook is unaffected because execution happens outside it.

## Trace semantics

The runner uses [CPython's tracing API](https://docs.python.org/3/library/sys.html#sys.settrace). Each event includes a sequential stable ID, event kind, source line, invocation ID, parent ID, stack snapshot, and reachable object table. The trace carries the exact source, its SHA-256 digest, engine/schema version, Python version, and run output/status.

- A line event means **about to execute**, not “this statement has completed.” Nested calls and expressions are not invented as separate statement events.
- Calls receive distinct frame IDs, including repeated calls with identical arguments. Suspended callers retain their own locals. A return includes its value and caller; the next recorded caller event shows resumed state. Exceptional exits use `unwind`, not a successful `None` return. CPython's terminating opcode distinguishes a return from re-raising after `finally` cleanup.
- Lists, tuples, dictionaries, and sets use stable object IDs. Repeated references and cycles share the same ID. Each event has an independent serialized object snapshot; append/pop effects remain visible when navigating backward. Large integers use a decimal-string tag to avoid JavaScript precision loss. Set order is Python iteration order and is not a sorted-order promise.
- Previous/next/first/last, step into/over/out, and event selection navigate recorded observations. Source edits retain a visible mismatch warning. Re-import explicitly replaces the current trace; there is no multi-run archive yet.
- The algorithm revision displayed is the saved revision at import time. It records association, not proof that the program implements that algorithm. Imported JSON is validated data, not authenticated execution evidence. The source digest is provenance metadata, not a signature.

The importer bounds payloads and validates event order, live stacks, invocation consistency, statuses, source locations, object references, and values. Imported text is escaped for rendering. Old backups need no Python fields. Trace data never becomes a manual dry-run snapshot or automatically checks a learner's algorithm.

## Validation and remaining work

New runner, import/navigation, and application-handler tests were written failing before their implementations. Later regressions reproduced `finally` unwinding being mislabeled as return and caught resource-limit exceptions allowing a false completion claim; both were repaired before validation. Limit state is latched even when learner code catches the internal exception. Shipped examples in `assets/examples/` cover factorial, branching Fibonacci, tree depth, and shared-path subsets; their output is compared against untraced native Python. Tests also cover unique invocation IDs, caller resumption, shared/cyclic collections, immutable history, caught/uncaught exceptions, malformed imports, backup transfer, source preservation, and question switches during file reads.

Run `npm run check`, `npm test`, and `git diff --check`. Local execution was tested with CPython 3.9.6 and Node 25.8.1 on macOS; CI is configured for Python 3.12 and Node 22 on Ubuntu. CI configuration is not a claim that the remote workflow has run.

Native Chrome smoke testing opened the built standalone app, saved a separate QA problem and Python draft, imported the factorial trace through the native picker, and exposed recorded source, line semantics, frame/caller labels, and playback controls. The source/stack layout was visually inspected. The automation returned stale accessibility states during subsequent interactions and eventually `noWindowsAvailable`; do not infer a complete keyboard, reload-persistence, or extension validation from that run. Handler tests cover those state transitions independently. The paste fallback needs its native follow-up check.

The next unfinished slices are an isolated browser runtime with cancel/restart, learner-confirmed algorithm-step mappings and bookmarks, call-tree diagrams linked to invocations, event-by-event change highlighting, a multi-run comparison/archive, broader Python/version verification, and learner evaluation. Arbitrary pseudocode evaluation, additional languages, Notion API sync, and validated memory scheduling remain later roadmap work.
