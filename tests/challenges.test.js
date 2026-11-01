import test from 'node:test';
import assert from 'node:assert/strict';
import { caseSupport, challengeCases, referenceFor, saveCounterexample } from '../src/challenges.js';
import { makeRecord, validateBackup } from '../src/domain.js';

const linked = slug => makeRecord({ url:`https://leetcode.com/problems/${slug}/` });
test('three new linked contracts validate inputs and compute independent references', () => {
  const brackets = linked('valid-parentheses'), search = linked('binary-search'), window = linked('longest-substring-without-repeating-characters');
  assert.ok(caseSupport(brackets));
  assert.equal(referenceFor(brackets,'"([)]"'),'false');
  assert.equal(referenceFor(brackets,'"([])"'),'true');
  assert.throws(() => referenceFor(brackets,'""'),/1|empty/);
  assert.throws(() => referenceFor(brackets,'"abc"'),/bracket/);
  assert.equal(referenceFor(search,'{"nums":[-4,0,3],"target":0}'),'1');
  assert.equal(referenceFor(search,'{"nums":[-4,0,3],"target":2}'),'-1');
  assert.throws(() => referenceFor(search,'{"nums":[2,1],"target":1}'),/increasing|sorted/);
  assert.throws(() => referenceFor(search,'{"nums":[1,1],"target":1}'),/increasing|distinct/);
  assert.equal(referenceFor(window,'"abba"'),'2');
  assert.equal(referenceFor(window,'""'),'0');
  assert.equal(referenceFor(window,'"a a"'),'2');
  assert.throws(() => referenceFor(window,'[1,2]'),/string/);
  assert.equal(caseSupport(linked('two-sum')),null); // Never reuse the narrower practice contract.
  assert.throws(() => referenceFor(linked('unknown'),'[]'),/learner|supported/i);
});

test('authored challenges expose assumptions and all satisfy their declared contracts', () => {
  for (const slug of ['valid-parentheses','binary-search','longest-substring-without-repeating-characters']) {
    const record = linked(slug), cases = challengeCases(record);
    assert.ok(cases.length >= 3);
    for (const c of cases) {
      assert.ok(c.why && c.prompt && c.category);
      assert.equal(referenceFor(record,c.input),c.expected);
    }
  }
  assert.equal(challengeCases(makeRecord({ exerciseId:'pair-sum' })).length,4);
});

test('counterexample reductions preserve the original prediction and require an observed failure', () => {
  const record = linked('binary-search');
  record.cases.push({ id:'c1',input:'{"nums":[1,2,3],"target":3}',expected:'2',why:'Check last index',category:'Boundary',revision:1 });
  const details = { input:'{"nums":[3],"target":3}',actual:'-1',expected:'0',lesson:'My loop skips a one-element interval.' };
  const reduced = saveCounterexample(record,'c1',details);
  assert.equal(record.cases[0].reductions,undefined);
  assert.equal(reduced.cases[0].input,record.cases[0].input);
  assert.equal(reduced.cases[0].reductions[0].lesson,details.lesson);
  assert.throws(() => saveCounterexample(record,'c1',{ ...details,actual:'0' }),/differ|failure/);
  assert.throws(() => saveCounterexample(record,'c1',{ ...details,lesson:'' }),/explain|lesson/i);
  assert.throws(() => saveCounterexample(record,'missing',details),/case/i);
  const imported = validateBackup({ version:1,records:[reduced] });
  assert.deepEqual(imported[0].cases[0].reductions,reduced.cases[0].reductions);
});

test('malformed reduction histories cannot enter through backups', () => {
  for (const reductions of ['bad',[null],[{ input:'[]',actual:1,expected:'0',lesson:'Oops',at:'bad',revision:1 }]]) {
    const record = linked('binary-search');
    record.cases.push({ id:'c',input:'{}',expected:'0',why:'Boundary',category:'Boundary',revision:1,reductions });
    assert.throws(() => validateBackup({ version:1,records:[record] }),/counterexample/i);
  }
});
