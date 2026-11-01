import test from 'node:test';
import assert from 'node:assert/strict';
import { patternConnections } from '../src/patterns.js';
import { makeRecord, validateBackup } from '../src/domain.js';

test('tree questions connect by return contract with explicit differences', () => {
  const result = patternConnections({ url:'https://leetcode.com/problems/maximum-depth-of-binary-tree/description/' });
  assert.equal(result.family,'Tree recursion');
  assert.match(result.signal,/subtree/i);
  assert.match(result.invariant,/height/);
  assert.ok(result.related.some(r => r.url.endsWith('/diameter-of-binary-tree/') && /height|diameter/.test(r.difference)));
  assert.ok(!result.related.some(r => r.url.endsWith('/maximum-depth-of-binary-tree/')));
  assert.match(result.trap,/sum|add/i);
});

test('pattern notes survive transfer without altering older records or accepting invalid notes', () => {
  const record = makeRecord({ exerciseId:'pair-sum' }); record.patternNote = 'Preserve indices when sorting.';
  assert.equal(validateBackup({ version:1,records:[record] })[0].patternNote,record.patternNote);
  record.patternNote = {};
  assert.throws(() => validateBackup({ version:1,records:[record] }),/pattern/i);
});

test('guided records and exact URLs share curated connections; titles never infer patterns', () => {
  assert.deepEqual(patternConnections({ exerciseId:'pair-sum' }),patternConnections({ url:'https://leetcode.com/problems/two-sum/' }));
  assert.equal(patternConnections({ title:'Two Sum' }),null);
  assert.equal(patternConnections({ url:'https://leetcode.com/problems/constructor/' }),null);
  assert.equal(patternConnections({ url:'https://example.com/problems/two-sum/' }),null);
  const sliding = patternConnections({ url:'https://leetcode.com/problems/longest-substring-without-repeating-characters/' });
  assert.match(sliding.trap,/subsequence|contiguous/i);
  assert.ok(sliding.related.length);
});
