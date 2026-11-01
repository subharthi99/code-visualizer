import { canonicalLeetCode } from './domain.js';
import { lookupLesson } from './lessons.js';

// Original comparisons. Membership is authored, not inferred from problem wording.
const patternCatalog = {
  'maximum-depth-of-binary-tree':['Maximum Depth of Binary Tree','Tree recursion','One subtree can be summarized for its parent.','Adding child heights counts branches together; depth follows one longest branch.',['diameter-of-binary-tree','path-sum','subsets']],
  'diameter-of-binary-tree':['Diameter of Binary Tree','Tree recursion','Compute a subtree summary while collecting a different answer.','Returning the diameter to a parent loses the one-branch height that parent needs.',['maximum-depth-of-binary-tree','path-sum']],
  'path-sum':['Path Sum','Tree recursion','The contract asks about complete root-to-leaf paths.','A matching sum at an internal node is not a complete root-to-leaf path.',['maximum-depth-of-binary-tree','diameter-of-binary-tree']],
  'invert-binary-tree':['Invert Binary Tree','Tree recursion','The task transforms each subtree independently.','Reversing traversal output does not swap child references.',['construct-binary-tree-from-preorder-and-inorder-traversal','maximum-depth-of-binary-tree']],
  'construct-binary-tree-from-preorder-and-inorder-traversal':['Construct Binary Tree','Tree recursion','Traversal ranges describe smaller subtrees.','Reading traversal values alone does not attach the returned child roots.',['invert-binary-tree','maximum-depth-of-binary-tree']],
  subsets:['Subsets','Backtracking','Enumerate independent include/omit choices.','Combining counts cannot enumerate selections; saving a shared path without copying corrupts answers.',['maximum-depth-of-binary-tree','valid-parentheses']],
  'two-sum':['Two Sum','Lookup and invariants','A required partner can be computed from the current value.','Sorting without retaining original indices changes the required output identity.',['binary-search','longest-substring-without-repeating-characters']],
  'binary-search':['Binary Search','Search intervals','Sorted order lets one comparison eliminate an interval.','Exact-target search bounds cannot be copied blindly into first-boundary searches.',['two-sum','longest-substring-without-repeating-characters']],
  'longest-substring-without-repeating-characters':['Longest Substring Without Repeating Characters','Sliding windows','A contiguous range has a validity condition that can be restored by moving its left edge.','A subsequence need not be contiguous; using its reasoning here changes the problem.',['binary-search','two-sum']],
  'valid-parentheses':['Valid Parentheses','Stacks','The most recently unmatched opening must close first.','Equal opening and closing counts do not prove the nesting order is valid.',['subsets','merge-two-sorted-lists']],
  'merge-two-sorted-lists':['Merge Two Sorted Lists','Pointer invariants','Two sorted frontiers determine the next safe output node.','Advancing both input pointers after one choice can skip an unconsumed node.',['two-sum','invert-binary-tree']]
};

export function patternConnections(record) {
  let slug = { 'tree-depth':'maximum-depth-of-binary-tree','pair-sum':'two-sum',subsets:'subsets' }[record?.exerciseId];
  if (!slug) { try { slug = canonicalLeetCode(record?.url).slug; } catch { return null; } }
  if (!Object.hasOwn(patternCatalog,slug)) return null;
  const [title,family,signal,trap,related] = patternCatalog[slug];
  const lesson = lookupLesson(record);
  return { title,family,signal,trap,invariant:lesson.invariant,related:related.map(other => {
    const [name,otherFamily] = patternCatalog[other];
    const url = `https://leetcode.com/problems/${other}/`;
    const otherLesson = lookupLesson({ url });
    return { title:name,url,family:otherFamily,difference:`This question: ${lesson.invariant} Compare: ${otherLesson.invariant}`,contrast:otherLesson.contrast };
  }) };
}
