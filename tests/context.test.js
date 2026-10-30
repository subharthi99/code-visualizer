import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContext, applyContext } from '../src/context.js';
import { makeRecord, validateBackup } from '../src/domain.js';

test('captured context separates statement, examples, and constraints without importing follow-up text', () => {
  const actual = normalizeContext({ url:'https://leetcode.com/problems/two-sum/description/',title:'1. Two Sum',text:'Find two indices.\nExample 1:\nInput: nums = [3,3], target = 6\nOutput: [0,1]\nConstraints:\n2 <= nums.length <= 100\nFollow-up: optimize it.' });
  assert.equal(actual.url,'https://leetcode.com/problems/two-sum/');
  assert.equal(actual.title,'Two Sum');
  assert.equal(actual.description,'Find two indices.');
  assert.match(actual.examples,/Input: nums/);
  assert.equal(actual.constraints,'2 <= nums.length <= 100');
  assert.equal(actual.constraints.includes('optimize'),false);
});

test('context preview applies only selected fields and preserves learner reasoning', () => {
  const record = makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  record.constraints = 'My existing constraints'; record.approach = 'My attempt';
  const result = applyContext(record,{ url:record.url,title:'Two Sum',description:'Statement',examples:'Example',constraints:'New constraints' },['description','examples']);
  assert.equal(result.description,'Statement');
  assert.equal(result.example,'Example');
  assert.equal(result.constraints,'My existing constraints');
  assert.equal(result.approach,'My attempt');
  assert.equal(record.description,undefined);
  const restored = validateBackup(JSON.parse(JSON.stringify({ version:1,records:[result] })));
  assert.deepEqual(restored,[result]);
});

test('context refuses unrelated sources, editorial routes, and empty extraction', () => {
  assert.throws(() => normalizeContext({ url:'https://leetcode.com/problems/two-sum/editorial/',text:'Editorial' }),/description/i);
  assert.throws(() => normalizeContext({ url:'https://example.com/',text:'Other page' }));
  assert.throws(() => normalizeContext({ url:'https://leetcode.com/problems/two-sum/',text:'' }),/description/i);
  const record = makeRecord({ url:'https://leetcode.com/problems/subsets/' });
  assert.throws(() => applyContext(record,{ url:'https://leetcode.com/problems/two-sum/',description:'Wrong question' },['description']),/different|match/i);
});
