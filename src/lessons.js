import { exercises } from './content.js';
import { canonicalLeetCode } from './domain.js';

// Original teaching material keyed to question identity, never inferred from a title.
const linkedLessons = {
  'two-sum': { ...exercises.find(x => x.id === 'pair-sum'), checkpoints:[['map|hash|seen','Which indices are already in your map before the complement check? Can the current index match itself?']], focus:{ recursion:'Does this problem need recursion, or can one pass maintain all the state you need?',implementation:'Trace index 0 and a repeated value. Distinguish a missing key from a stored index of 0.' } },
  'maximum-depth-of-binary-tree': { ...exercises.find(x => x.id === 'tree-depth') },
  subsets: { ...exercises.find(x => x.id === 'subsets') },
  'valid-parentheses': {
    pattern:'Last-opened, first-closed', invariant:'The stack contains exactly the unmatched opening brackets seen so far.',
    hints:['Trace one matched pair, then two nested pairs. What has to close first?','Which opening bracket matters when the next closing bracket arrives?','A valid prefix cannot close a bracket that was never opened, or close the wrong type.','Keep unmatched openings in a stack. At a closing bracket, inspect the most recent opening.','Process left to right: push openings; on a closer, reject an empty or mismatched top, otherwise pop. At the end require an empty stack.'],
    checkpoints:[['count|number','Equal counts do not establish nesting order. What would an interleaved mismatch do?'],['stack|pop','What happens if your stack is empty when you see a closing bracket?']],
    contrast:'A counter can track one bracket type in some contracts; several types also require remembering order.',
    solution:'A stack preserves the order of unmatched openings. Reject a closer without a matching top and reject leftover openings. O(n) time and O(n) worst-case extra space.'
  },
  'binary-search': {
    pattern:'Maintain a search interval', invariant:'If the target exists, its index remains inside the current search interval.',
    hints:['Use the sorted-order guarantee. What can comparing with one element eliminate?','Choose a middle element. Which half can still contain the target after the comparison?','Write down whether your endpoints are inclusive before updating them.','Use consistent bounds; every non-returning step must make the interval smaller.','For inclusive bounds: while left <= right, compare the middle; return on equality, otherwise move left to mid + 1 or right to mid - 1. Return not-found after the interval empties.'],
    checkpoints:[['left|right|mid','Can you show that each bounds update strictly reduces the interval, including a one-element interval?']],
    contrast:'Finding a boundary or searching an answer space changes the condition and invariant; do not reuse exact-target updates blindly.',
    solution:'Repeatedly discard a half using sorted order while retaining a consistent interval. O(log n) time and O(1) auxiliary space for an iterative implementation.'
  },
  'longest-substring-without-repeating-characters': {
    pattern:'Sliding window with a validity condition', invariant:'The current window contains no repeated character after invalid prefixes have been removed.',
    hints:['Examine a string with a repeat inside the current candidate substring. Must the whole candidate be discarded?','Keep a contiguous window. When a new character repeats, which end should move?','Move the left edge only far enough to restore uniqueness. What information tells you when it is safe?','Track window membership or last-seen positions. The left boundary must never move backwards.','Expand right one character at a time; restore a duplicate-free window, then update the best length. With last-seen indices, left = max(left, lastSeen[current] + 1).'],
    checkpoints:[['last|index','If a repeated character was last seen before the current window, should left move?'],['set|remove','After removing just one character, could the window still contain a duplicate?']],
    contrast:'Subsequence choices need not be contiguous; this problem requires a contiguous window.',
    solution:'A sliding window avoids rebuilding every substring. Each boundary moves forward; O(n) time with suitable character lookup, and space proportional to the distinct characters tracked.'
  },
  'construct-binary-tree-from-preorder-and-inorder-traversal': {
    pattern:'Recursive reconstruction by traversal boundaries', invariant:'Each call reconstructs exactly the subtree represented by its matching traversal ranges.',
    hints:['What is the first value visited in preorder? Locate that value in inorder.','The inorder split gives the left and right subtree sizes. How do those sizes divide the remaining preorder values?','Define what one call receives and returns. Empty ranges should produce an empty subtree.','Construct a root, then assign independently reconstructed left and right children using consistent ranges.','For a range-based approach, consume the next preorder root, split its inorder range at the root index, recurse left then right, and return the constructed root. A lookup map can avoid repeated index searches.'],
    checkpoints:[['slice|mid|index','Does your left preorder range contain exactly as many values as the left inorder range?'],['root|left|right','After a child returns a subtree, where is that returned node assigned?']],
    focus:{ recursion:'What subtree does one call return? Trace the empty-range base case, then show the caller assigning its returned left and right children.',implementation:'Write down each range endpoint. Check whether it is inclusive or exclusive and verify slice lengths on a three-node tree.' },
    contrast:'Tree traversal reads an existing tree; reconstruction must return new roots and attach the returned subtrees.',
    solution:'Use preorder to choose roots and inorder to delimit subtrees under the question’s unique-value contract. With an index map and ranges, visit each node once: O(n) time, O(n) lookup space and O(h) recursion space. Repeated slicing or searching can increase cost.'
  },
  'path-sum': {
    pattern:'Carry a remaining target through DFS', invariant:'A call tests whether its subtree contains a root-to-leaf path completing the remaining sum.',
    hints:['The path must end at a leaf. Does reaching the target at an internal node count?','After visiting a node, what sum remains for a child path?','Distinguish an empty child from a real leaf. What should each case return?','Pass the remaining target to each child; success in either eligible subtree is enough.','For an empty node return false. At a leaf compare its value with the remaining target. Otherwise recurse with remaining minus the current value and combine child answers with OR.'],
    checkpoints:[['sum|target','Where do you verify that a matching sum occurs at a leaf rather than at an internal node?']],
    contrast:'Counting all matching paths or allowing a path to start anywhere requires a different state definition.',
    solution:'DFS carries the remaining sum and checks only complete root-to-leaf paths. O(n) worst-case time and O(h) recursion space.'
  },
  'invert-binary-tree': {
    pattern:'Transform a subtree and return its root', invariant:'A completed call returns a subtree with the left and right descendants exchanged at every node.',
    hints:['Draw a root with unequal left and right branches. Which references change?','Swapping just the root children does not transform the rest of the tree. What smaller work remains?','Define what an empty-node call returns. What does a completed non-empty call return?','Preserve references while recursively swapping children; avoid overwriting a child you still need.','Return empty for an empty node. Save the original children, recursively invert them, assign the inverted right to left and inverted left to right, then return the root.'],
    checkpoints:[['left|right','After your first assignment, do you still have a reference to the original left child?']],
    contrast:'Reversing a traversal sequence does not necessarily change the tree’s child pointers.',
    solution:'Transform each subtree once and swap child references without losing either original child. O(n) time and O(h) recursive auxiliary space.'
  },
  'diameter-of-binary-tree': {
    pattern:'Return height while aggregating a different answer', invariant:'Each call returns subtree height; a separate best value tracks the largest path found so far in edges.',
    hints:['A longest path can lie entirely below the root. Which nodes might be its highest point?','At one node, what can the two child heights tell you about a path passing through it?','The value a parent needs and the global best path are different quantities. Define both.','Return height to the parent; update the best diameter using the combined child heights at every node.','Use an empty height of 0 measured in nodes. At each node update best with leftHeight + rightHeight (edges), then return 1 + max(leftHeight, rightHeight).'],
    checkpoints:[['return|height|diameter','Does your return value represent a one-branch height or a path that could use two branches?']],
    contrast:'Maximum depth must start at the root. A diameter may pass through any node and need not include the root.',
    solution:'A postorder traversal computes heights and aggregates diameter candidates. O(n) time and O(h) recursion space; state the node-height/edge-diameter convention explicitly.'
  },
  'merge-two-sorted-lists': {
    pattern:'Merge by maintaining an output tail', invariant:'The output prefix is sorted and contains exactly the input nodes already consumed.',
    hints:['Compare the two current heads. Which one can safely come next in the merged order?','After choosing one head, which input pointer advances?','If one list runs out, what do the sorted-order guarantees tell you about the remaining suffix?','Track the output tail or define a recursive call that returns the merged suffix. Preserve unconsumed next pointers.','Iteratively append the smaller head and advance that input; append the remaining suffix at exhaustion. Or recursively choose a head, set its next to a merged remainder, and return it.'],
    checkpoints:[['next|tail','After linking a chosen node, which pointers must advance so you cannot append it repeatedly?']],
    contrast:'Arrays and linked lists expose different operations; moving references avoids copying node values unnecessarily.',
    solution:'Advance through each list once, maintaining a sorted output prefix. O(n + m) time. Iterative pointer merging uses O(1) auxiliary space; recursive merging can use O(n + m) stack space.'
  }
};

export function lookupLesson(record) {
  if (!record) return null;
  if (record.exerciseId) return exercises.find(x => x.id === record.exerciseId) || null;
  if (!record.url) return null;
  try { const slug = canonicalLeetCode(record.url).slug; return Object.hasOwn(linkedLessons,slug) ? linkedLessons[slug] : null; } catch { return null; }
}

export function attemptCheckpoint(record, focus = 'approach') {
  const lesson = lookupLesson(record);
  if (focus === 'recursion') return lesson?.focus?.recursion || 'Define the subtree or state one call handles, its base case, and what it returns to its caller.';
  if (focus === 'implementation') return lesson?.focus?.implementation || 'Trace the smallest valid input. Check index bounds, mutation order, and which references must be preserved.';
  const attempt = [record.approach,record.algorithm].filter(Boolean).join('\n');
  const checkpoint = lesson?.checkpoints?.find(([pattern]) => new RegExp(pattern,'i').test(attempt));
  return checkpoint?.[1] || lesson?.invariant && `Test this promise against your saved attempt: ${lesson.invariant}` || 'State what remains true after each step, then try to break that assumption with a small valid input.';
}
