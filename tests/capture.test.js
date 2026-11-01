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

test('capture preserves superscripts, subscripts, and block boundaries without changing the page', t => {
  t.after(() => { delete globalThis.document; delete globalThis.location; });
  const text = value => ({ nodeType:3,textContent:value });
  const element = (tagName,...childNodes) => ({ nodeType:1,tagName,childNodes });
  const container = element('DIV',element('P',text('A bound of 10'),element('SUP',text('4')),text(' and a'),element('SUB',text('i'))),element('P',text('Example 1:')),element('PRE',text('Input: [1]\nOutput: 1')),element('P',text('Constraints:')),element('UL',element('LI',text('-10'),element('SUP',text('9')),text(' <= value <= 10'),element('SUP',text('9')))));
  container.innerText = 'A bound of 104 and ai\nExample 1:\nInput: [1]\nOutput: 1\nConstraints:\n-109 <= value <= 109';
  container.getClientRects = () => [1];
  globalThis.location = { href:'https://leetcode.com/problems/two-sum/description/' };
  globalThis.document = { querySelector:selector => selector === '[data-track-load="description_content"]' ? container : null };
  const before = JSON.stringify(container);
  const result = readLeetCodeContext();
  assert.match(result.text,/10\^\(4\)/);
  assert.match(result.text,/a_\(i\)/);
  assert.match(result.text,/\nExample 1:/);
  assert.match(result.text,/-10\^\(9\) <= value <= 10\^\(9\)/);
  assert.equal(JSON.stringify(container),before);
});
