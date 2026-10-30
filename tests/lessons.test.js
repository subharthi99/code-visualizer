import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupLesson, attemptCheckpoint } from '../src/lessons.js';
import { makeRecord } from '../src/domain.js';

test('supported LeetCode questions receive authored five-level lessons by exact URL identity', () => {
  for (const slug of ['two-sum','maximum-depth-of-binary-tree','subsets','valid-parentheses','binary-search','longest-substring-without-repeating-characters','construct-binary-tree-from-preorder-and-inorder-traversal','path-sum','invert-binary-tree','diameter-of-binary-tree','merge-two-sorted-lists']) {
    const lesson = lookupLesson(makeRecord({ url:`https://leetcode.com/problems/${slug}/` }));
    assert.equal(lesson.hints.length,5,slug);
    assert.ok(lesson.pattern && lesson.invariant && lesson.solution);
  }
});

test('titles cannot accidentally select an unrelated lesson', () => {
  assert.equal(lookupLesson(makeRecord({ title:'Two Sum' })),null);
  assert.equal(lookupLesson(makeRecord({ url:'https://leetcode.com/problems/unknown-question/' })),null);
  assert.equal(lookupLesson(makeRecord({ url:'https://leetcode.com/problems/constructor/' })),null);
});

test('attempt checkpoints respond to the saved approach and selected area of difficulty', () => {
  const record = makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  record.approach = 'I use a hash map and insert before checking.';
  assert.match(attemptCheckpoint(record,'approach'),/index|earlier|before/i);
  const recursive = makeRecord({ url:'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/' });
  recursive.approach = 'Find a root and recurse on left and right.';
  assert.match(attemptCheckpoint(recursive,'recursion'),/return|subtree|base/i);
  assert.notEqual(attemptCheckpoint(recursive,'recursion'),attemptCheckpoint(recursive,'implementation'));
});
