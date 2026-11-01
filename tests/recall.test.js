import test from 'node:test';
import assert from 'node:assert/strict';
import { recallPrompts, recallInterval, recordRecall, reviewOverview } from '../src/recall.js';
import { makeRecord, validateBackup } from '../src/domain.js';

const now = new Date('2026-11-01T12:00:00Z');
const evidence = { attempt:'Reconstruct the invariant',transition:'Resume the caller with child height 1',edgeCase:'A one-node tree returns 1',usedHelp:false };
test('independent recall grows intervals; failures and assistance bring review closer', () => {
  const original = makeRecord({ exerciseId:'tree-depth' });
  let next = recordRecall(original,'good',evidence,now);
  assert.equal(next.reviews[0].intervalDays,3);
  assert.equal(next.reviews[0].policy,'recall-v2');
  assert.equal(original.reviews.length,0);
  assert.equal(recallInterval(next,'good',false),6);
  next = recordRecall(next,'good',evidence,new Date('2026-11-04T12:00:00Z'));
  assert.equal(next.reviews[1].intervalDays,6);
  assert.equal(recallInterval(next,'again',false),1);
  assert.equal(recallInterval(next,'easy',true),1);
  assert.ok(recallInterval(next,'easy',false) > recallInterval(next,'hard',false));
  assert.throws(() => recordRecall(next,'invalid',evidence,now),/rating/i);
  assert.equal(validateBackup({ version:1,records:[next] })[0].reviews[1].edgeCase,evidence.edgeCase);
});

test('missing reconstruction evidence and explicit help are stored as assisted', () => {
  const record = makeRecord({ title:'Custom' });
  for (const data of [{ ...evidence,attempt:'' },{ ...evidence,transition:'' },{ ...evidence,edgeCase:'' },{ ...evidence,usedHelp:true }]) {
    const result = recordRecall(record,'easy',data,now);
    assert.equal(result.reviews[0].assisted,true);
    assert.equal(result.reviews[0].intervalDays,1);
  }
  const limited = { ...record,reviews:[{ rating:'easy',at:now.toISOString(),intervalDays:90,assisted:false,policy:'recall-v2' }] };
  assert.equal(recallInterval(limited,'easy',false),90);
});

test('mistake prompts invite reconstruction without revealing the saved answer', () => {
  const record = makeRecord({ exerciseId:'tree-depth' }); record.mistake = 'SECRET failed assumption';
  const prompts = recallPrompts(record);
  assert.equal(prompts.length,3);
  assert.match(prompts.join(' '),/mistake|assumption/i);
  assert.match(prompts.join(' '),/call|transition/i);
  assert.ok(!prompts.join(' ').includes('SECRET'));
});

test('overview separates due, upcoming, and unscheduled and reports self-rated history', () => {
  const a = makeRecord({ title:'Overdue' }), b = makeRecord({ title:'Upcoming' }), c = makeRecord({ title:'Unscheduled' });
  a.due = '2026-10-30T12:00:00Z'; b.due = '2026-11-03T12:00:00Z';
  a.reviews = [{ rating:'good',assisted:false,at:'2026-10-29T12:00:00Z' },{ rating:'again',assisted:true,at:'2026-10-30T12:00:00Z' }];
  const result = reviewOverview([b,c,a],now);
  assert.deepEqual(result.due.map(r => r.id),[a.id]);
  assert.deepEqual(result.upcoming.map(r => r.id),[b.id]);
  assert.deepEqual(result.unscheduled.map(r => r.id),[c.id]);
  assert.equal(result.attempts,2); assert.equal(result.independent,1); assert.equal(result.needsWork,1);
});

test('backup rejects malformed v2 recall evidence and intervals while accepting old history', () => {
  const record = makeRecord({ title:'Review import' });
  record.reviews = [{ at:now.toISOString(),rating:'good',policy:'fixed-v1',assisted:false }];
  assert.equal(validateBackup({ version:1,records:[record] })[0].reviews.length,1);
  for (const bad of [{ intervalDays:Infinity },{ intervalDays:0 },{ assisted:'yes' },{ attempt:{} },{ transition:[] }]) {
    const next = recordRecall({ ...record,reviews:[] },'good',evidence,now);
    Object.assign(next.reviews[0],bad);
    assert.throws(() => validateBackup({ version:1,records:[next] }),/recall|review/i);
  }
});
