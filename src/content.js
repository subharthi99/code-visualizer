// Original teaching content. External problem links are references, not copied statements.
export const exercises = [
  {
    id: 'tree-depth', title: 'How deep is this tree?', category: 'Recursive thinking',
    description: 'A tree node has a value and up to two children. Describe an algorithm that returns the number of nodes on its longest root-to-leaf path.',
    constraints: 'The input is a finite binary tree without cycles. An empty tree is allowed and has depth 0. A single root has depth 1.',
    example: 'A root with two leaf children has depth 2. A chain of three nodes has depth 3.',
    prompt: 'What does one call promise to return to its parent?',
    hints: [
      'Start with a tree that has no nodes. What number should it contribute?',
      'Imagine someone tells you the depths of the left and right children. What can you determine without visiting those children again?',
      'Your parent needs one number, not the full path. Which child determines the longest path?',
      'Return 0 for an empty tree. For a real node, combine its own contribution with the larger child depth.',
      'depth(node): if empty, return 0; otherwise return 1 + max(depth(left), depth(right)).'
    ],
    pattern: 'Recursive decomposition', invariant: 'Each call returns the height of its own subtree, measured in nodes.',
    contrast: 'Subsets also branches recursively, but returns many choices rather than combining child heights into one number.',
    solution: 'Define depth as a return value, not a shared counter. Empty returns 0. A node returns 1 plus the larger of its two child depths. O(n) time and O(h) call-stack space, where h is the tree height.',
    cases: [
      { category: 'Empty input', prompt: 'What can the caller do when there is no node?', input: '[]', expected: '0', why: 'The base case must return a number that the parent can combine.' },
      { category: 'Smallest non-empty', prompt: 'Does your definition count nodes or edges?', input: '[7]', expected: '1', why: 'A single node distinguishes two common depth conventions.' },
      { category: 'Structural extreme', prompt: 'What happens when every node has just one child?', input: '[1,2,null,3]', expected: '3', why: 'A skewed tree checks recursion depth and the empty-child branch.' },
      { category: 'Unequal branches', prompt: 'What if the right branch is deeper than the left?', input: '[1,2,3,null,null,null,4]', expected: '3', why: 'Using only the left child, or adding both depths, gives the wrong result.' }
    ],
    reference: [
      ['1', 'Call depth(root)', '{"node":1}', 'The root is suspended while a child is explored.'],
      ['2', 'Call depth(left leaf)', '{"node":2}', 'Both empty children return 0.'],
      ['3', 'Return from left leaf', '{"leftDepth":1}', 'The root receives 1; it still needs the right result.'],
      ['4', 'Return from right leaf', '{"leftDepth":1,"rightDepth":1}', 'Each leaf returns 1 independently.'],
      ['5', 'Return from root', '{"result":2}', '1 + max(1, 1) = 2.']
    ]
  },
  {
    id: 'subsets', title: 'Every possible selection', category: 'Choices & backtracking',
    description: 'Given distinct integers, describe an algorithm that produces every subset. Each input value may be selected once or omitted. Output order does not matter.',
    constraints: 'Input values are distinct; length is 0–12. Include the empty subset. Each result must be an independent snapshot of a selection.',
    example: '[4, 9] has four subsets: [], [4], [9], [4, 9].',
    prompt: 'What are the two decisions you can make about one value?',
    hints: [
      'For one value, enumerate what you can choose before considering a second value.',
      'At an index, you can include that value or leave it out. What changes in the next call?',
      'When there are no undecided values left, you have one finished selection. Even an empty selection counts.',
      'Keep a current selection and explore both branches. If you mutate one shared list, undo the addition before exploring a different choice.',
      'visit(i, path): if i == length, save a copy of path; else explore omit and include branches, restoring path after the include branch.'
    ],
    pattern: 'Backtracking', invariant: 'At index i, the current selection contains choices only from indices before i.',
    contrast: 'Tree depth combines child answers. Here, each leaf is an answer; changing a shared path requires explicit undo.',
    solution: 'Make an include/omit decision for each value. At the end, save a copy of the path. Passing copies or mutating with explicit undo can both work. O(n × 2^n) time including output copying, O(n) auxiliary recursion space excluding output.',
    cases: [
      { category: 'Empty input', prompt: 'Is there a way to choose nothing from nothing?', input: '[]', expected: '[[]]', why: 'An empty input still has one subset; no subsets and an empty subset differ.' },
      { category: 'One decision', prompt: 'Have both include and omit branches been visited?', input: '[5]', expected: '[[],[5]] (any order)', why: 'The smallest non-empty input checks both decision branches.' },
      { category: 'Shared mutation', prompt: 'What changes if all saved selections point to the same list?', input: '[4,9]', expected: '[[],[4],[9],[4,9]] (any order)', why: 'Saving the shared path instead of a copy can corrupt earlier results.' },
      { category: 'Zero is a value', prompt: 'Could a truthiness check silently discard a choice?', input: '[0,2]', expected: '[[],[0],[2],[0,2]] (any order)', why: 'Zero is permitted and must participate just like any other value.' }
    ],
    reference: [
      ['1', 'Begin at index 0', '{"path":[]}', 'Choose whether to include 4.'],
      ['2', 'Omit 4; omit 9', '{"path":[],"saved":[[]]}', 'At the end, save a copy of the empty path.'],
      ['3', 'Omit 4; include 9', '{"path":[9],"saved":[[],[9]]}', 'Save a copy, then undo the append.'],
      ['4', 'Include 4; omit 9', '{"path":[4],"saved":[[],[9],[4]]}', 'Return to the earlier decision with its state restored.'],
      ['5', 'Include 4; include 9', '{"path":[4,9],"saved":[[],[9],[4],[4,9]]}', 'Save the final selection and undo both additions as calls finish.']
    ]
  },
  {
    id: 'pair-sum', title: 'Two values, one target', category: 'Lookup & invariants',
    description: 'Given an integer array and target, return two distinct zero-based indices whose values add to the target. Think through a simple approach before improving it.',
    constraints: 'Length is 2–100. Values and target are integers between -1000 and 1000. Exactly one unordered index pair is valid. Equal values at different indices are allowed.',
    example: 'For [2, 7, 11] and target 9, return indices [0, 1] in either order.',
    prompt: 'What would you need to know about the values you have already visited?',
    hints: [
      'Try every pair of different indices by hand. What work repeats?',
      'For a current value x, what other value would complete the target?',
      'Could you remember earlier values with their indices instead of searching for the complement again?',
      'Before remembering the current value, check whether its complement appeared at an earlier index. This prevents reusing the same index.',
      'For each (i, x): if target - x is in seen, return [seen[target - x], i]; then store seen[x] = i.'
    ],
    pattern: 'Complement lookup', invariant: 'Before processing index i, seen contains only values at indices smaller than i.',
    contrast: 'Two pointers can exploit a sorted array, but sorting changes original positions unless indices are preserved. Choose based on the actual contract.',
    solution: 'A pairwise scan takes O(n²) time and O(1) extra space. A map of previously seen values to indices finds the complement in expected O(n) total time and O(n) space. Check before insert to avoid reusing an index.',
    cases: [
      { category: 'Equal values', prompt: 'Are equal values forbidden, or only equal indices?', input: '{"nums":[3,3],"target":6}', expected: '[0,1] (either order)', why: 'Distinct indices can hold equal values.' },
      { category: 'Self-reuse trap', prompt: 'What happens if you store the current value before checking?', input: '{"nums":[2,3,4],"target":6}', expected: '[0,2] (either order)', why: 'The single 3 cannot be paired with itself.' },
      { category: 'Negative values', prompt: 'Does the complement rule depend on values being positive?', input: '{"nums":[-5,2,8],"target":3}', expected: '[0,2] (either order)', why: 'Permitted negative values challenge positive-only assumptions.' },
      { category: 'Zero at a boundary', prompt: 'Could a falsy index or value cause a valid match to be skipped?', input: '{"nums":[0,8,3],"target":8}', expected: '[0,1] (either order)', why: 'Index 0 and value 0 are both valid; existence checks must not rely on truthiness.' }
    ],
    reference: [
      ['1', 'Visit index 0', '{"x":2,"need":7,"seen":{}}', 'No earlier 7. Store 2 at index 0.'],
      ['2', 'Visit index 1', '{"x":7,"need":2,"seen":{"2":0}}', 'The complement was seen at a different index.'],
      ['3', 'Return the indices', '{"result":[0,1]}', '2 + 7 = 9, and the indices differ.']
    ]
  }
];

export const genericHints = [
  'Restate the task. What are the inputs, required output, and constraints? Work through the smallest valid example.',
  'Write a straightforward approach, even if slow. Which work repeats? Name what your algorithm must remember.',
  'What statement should remain true after each step? Try an input that challenges this assumption.',
  'For recursion, define what one call returns and the smallest input it handles. For a loop, define what changes and why it must stop.',
  'Turn your idea into numbered steps. Dry-run normal and boundary inputs before translating the steps into code.'
];

export const genericCases = [
  ['Size boundary', 'What are the smallest and largest inputs allowed by the actual constraints?'],
  ['Repeated values', 'If repetition is allowed, what changes when values repeat or all values match?'],
  ['Result boundary', 'If allowed, can there be no answer or several valid answers?'],
  ['Ordering', 'Does the approach assume sorted input? Try a permitted ordering that breaks that assumption.'],
  ['Structure', 'If valid, what would a single branch, disconnected component, or cycle expose?'],
  ['Values', 'If allowed, try zero, negative values, and permitted minimum/maximum values.']
];

export const hintLabels = ['Clarify', 'Observe', 'Ask why', 'Find a strategy', 'Pseudocode outline'];
