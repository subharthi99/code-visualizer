import test from 'node:test';
import assert from 'node:assert/strict';
import { readLeetCodeContext } from '../extension/extract.js';

test('page capture reads the rendered description container, never the editor or page body', t => {
  t.after(() => { delete globalThis.document; delete globalThis.location; });
  globalThis.location = { href:'https://leetcode.com/problems/two-sum/description/' };
  globalThis.document = {
    querySelector(selector) {
      if (selector === 'h1') return { innerText:'1. Two Sum' };
      if (selector === '[data-track-load="description_content"]') return { innerText:'Statement\nExample 1:\nA small input\nConstraints:\nTwo indices',getClientRects:() => [1] };
      if (selector === 'body' || selector.includes('editor')) throw new Error('Must not read body or editor');
      return null;
    }
  };
  const result = readLeetCodeContext();
  assert.equal(result.title,'1. Two Sum');
  assert.match(result.text,/Statement/);
  assert.equal(result.url,location.href);
});

test('missing or hidden description is reported instead of capturing unrelated page text', t => {
  t.after(() => { delete globalThis.document; delete globalThis.location; });
  globalThis.location = { href:'https://leetcode.com/problems/two-sum/solutions/' };
  globalThis.document = { querySelector:() => null };
  assert.throws(() => readLeetCodeContext(),/description/i);
});
