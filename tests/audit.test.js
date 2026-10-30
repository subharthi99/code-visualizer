import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecord, validateBackup, addSnapshot, parseCSV } from '../src/domain.js';

test('backup identities cannot impersonate guided or linked questions without their source', () => {
  for (const id of ['exercise:tree-depth', 'leetcode:two-sum']) {
    const record = { ...makeRecord({ title:'Custom question' }), id };
    assert.throws(() => validateBackup({ version:1, records:[record] }), /identity|source/i);
  }
});

test('dry-run snapshots reject two active calls and suspended callers with no active child', () => {
  const frame = (id,status,parentId = null) => ({ id,status,parentId,label:id,locals:{},returned:'' });
  const draft = { action:'Take a step', explanation:'Apply the algorithm', variables:{} };
  for (const frames of [
    [frame('a','active'),frame('b','active')],
    [frame('a','suspended')],
    [frame('a','returned'),frame('b','active','a')]
  ]) assert.throws(() => addSnapshot(makeRecord(),{ ...draft,frames }), /frame|call/i);
});

test('CSV rejects characters after a closing quote instead of corrupting imported text', () => {
  assert.throws(() => parseCSV('Title,URL\n"A title"garbage,https://leetcode.com/problems/two-sum/'), /quot|CSV/i);
});
