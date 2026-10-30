import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalLeetCode, makeRecord, saveAlgorithm, addSnapshot, enterFrame, returnFrame, reviewRecord, checkCase, parseCSV, mapCSV, validateBackup } from '../src/domain.js';
import { exercises } from '../src/content.js';

test('problem identity is stable across supported LeetCode routes', () => {
  for (const suffix of ['', '/', '/description/', '/solutions/12345/a-solution/', '/submissions/987/', '/editorial/?envType=study-plan#example']) {
    const actual = canonicalLeetCode(`https://leetcode.com/problems/two-sum${suffix}`);
    assert.equal(actual.url, 'https://leetcode.com/problems/two-sum/');
    assert.equal(makeRecord({ url:actual.url }).id, 'leetcode:two-sum');
  }
  assert.equal(canonicalLeetCode('https://www.leetcode.com/problems/two-sum/').slug, 'two-sum');
});

test('reject unrelated, misleading, insecure, contest, and malformed URLs', () => {
  for (const url of ['javascript:alert(1)', 'http://leetcode.com/problems/two-sum/', 'https://leetcode.com.evil.test/problems/two-sum/', 'https://evil.test/?url=https://leetcode.com/problems/two-sum/', 'https://leetcode.cn/problems/two-sum/', 'https://leetcode.com/contest/a/problems/b/', 'https://leetcode.com/problems/two-sum/not-a-problem-route/', 'https://user:secret@leetcode.com/problems/two-sum/', 'https://leetcode.com:8080/problems/two-sum/']) assert.throws(() => canonicalLeetCode(url), undefined, url);
});

test('algorithm revisions preserve the old reasoning and its snapshots', () => {
  const record = makeRecord({ exerciseId:'tree-depth' });
  const first = saveAlgorithm(record,'Return the sum of both child depths.');
  const traced = addSnapshot(first,{ action:'Combine', explanation:'I added both depths.', variables:'{"answer":3}', step:'2', input:'[1,2,3]' });
  const fixed = saveAlgorithm(traced,'Return 1 + the maximum child depth.');
  assert.equal(record.algorithm,'');
  assert.equal(fixed.revisions.at(-1).algorithm, first.algorithm);
  assert.equal(fixed.snapshots[0].revision, first.revision);
  assert.notEqual(fixed.snapshots[0].revision, fixed.revision);
  assert.strictEqual(saveAlgorithm(fixed,fixed.algorithm),fixed);
});

test('returning a child resumes exactly its caller without rewriting earlier frames', () => {
  const root = enterFrame([], 'depth(root)', '{"node":1}');
  const child = enterFrame(root, 'depth(left)', '{"node":2}');
  const returned = returnFrame(child,'1');
  assert.equal(root[0].status,'active');
  assert.equal(child[0].status,'suspended');
  assert.equal(returned[0].status,'active');
  assert.equal(returned[1].status,'returned');
  assert.equal(returned[1].parentId,returned[0].id);
  const finished = returnFrame(returned,'2');
  assert.ok(finished.every(f => f.status === 'returned'));
  assert.throws(() => returnFrame(finished,'3'));
});

test('dry-run snapshots copy mutable state and reject invalid shapes', () => {
  const original = makeRecord({ exerciseId:'subsets' });
  const variables = { path:[4], saved:[[]] };
  const next = addSnapshot(original,{ action:'Append 4', explanation:'Explore include branch.', variables, frames:[], diagram:'[4,9]' });
  variables.path.push(9);
  assert.deepEqual(next.snapshots[0].variables.path,[4]);
  assert.equal(original.snapshots.length,0);
  assert.throws(() => addSnapshot(original,{ action:'', explanation:'Why', variables:{} }));
  assert.throws(() => addSnapshot(original,{ action:'Append', explanation:'Why', variables:'[]' }));
  assert.throws(() => enterFrame([], 'call', 'null'));
});

test('authored edge inputs satisfy their actual contracts', () => {
  for (const exercise of exercises) for (const c of exercise.cases) {
    const result = checkCase(exercise.id,c.input);
    assert.ok(result.length, `${exercise.id}: ${c.category}`);
    if (exercise.id === 'tree-depth') assert.equal(result,c.expected);
  }
  assert.match(checkCase('pair-sum','{"nums":[2,3,4],"target":6}'), /\[0,2\]/);
  assert.throws(() => checkCase('pair-sum','{"nums":[3],"target":6}'));
  assert.throws(() => checkCase('pair-sum','{"nums":[1,2,3,4],"target":5}'));
  assert.throws(() => checkCase('pair-sum','{"nums":[1,2],"target":10}'));
  assert.throws(() => checkCase('subsets','[1,1]'));
  assert.equal(checkCase('subsets','[]'),'[[]] (any order)');
  assert.equal(checkCase('tree-depth','[1,2,null,3]'),'3');
  assert.throws(() => checkCase('tree-depth','[null,1]'));
  assert.throws(() => checkCase('tree-depth','[1,null,null,2]'));
  assert.throws(() => checkCase('custom','[]'));
});

test('review schedule is explicit, calendar based, and does not mutate history', () => {
  const record = makeRecord({ exerciseId:'tree-depth' });
  const now = new Date(2026,9,30,12,0,0);
  const next = reviewRecord(record,'good',now);
  const due = new Date(next.due);
  assert.equal(due.getDate(),2);
  assert.equal(due.getMonth(),10);
  assert.equal(due.getHours(),12); // Preserve local time across a DST boundary.
  assert.equal(next.reviews[0].policy,'fixed-v1');
  assert.equal(record.reviews.length,0);
  assert.throws(() => reviewRecord(record,'mastered'));
});

test('CSV mapping supports quoted multiline Notion notes, previews errors and deduplicates', () => {
  const csv = parseCSV('\uFEFFName,Link,Notes,Status\r\n"Pair, sum",https://leetcode.com/problems/two-sum/,"Think first\nthen dry-run ""small"" inputs",Done\r\nDuplicate,https://leetcode.com/problems/two-sum/description/,Other,Done\r\nMissing,,No URL,Todo\r\nBad,https://evil.test/,No,Todo');
  const result = mapCSV(csv,{ title:'0', url:'1', notes:'2', status:'3' });
  assert.equal(result.records.length,1);
  assert.equal(result.errors.length,3);
  assert.equal(result.records[0].title,'Pair, sum');
  assert.equal(result.records[0].approach,'Think first\nthen dry-run "small" inputs');
  assert.equal(result.records[0].status,'Practiced');
  assert.throws(() => parseCSV('a,b\n"unfinished,b'));
});

test('backup round-trip preserves attempts, algorithm revisions, hints, cases, frames, and reviews', () => {
  let record = saveAlgorithm(makeRecord({ exerciseId:'tree-depth' }), 'Return 1 + max child heights.');
  record.hintCount = 1; record.hintHistory = [{ level:1, at:record.createdAt }];
  record.cases.push({ id:'case-1',input:'[]',expected:'0',why:'Base case',category:'Empty',revision:record.revision,provenance:'learner' });
  record = addSnapshot(record,{ action:'Return empty', explanation:'Base case', variables:{ result:0 }, frames:returnFrame(enterFrame([],'depth(empty)'),'0'), step:'1',input:'[]',diagram:'' });
  record = reviewRecord(record,'hard');
  const restored = validateBackup(JSON.parse(JSON.stringify({ version:1, records:[record] })));
  assert.deepEqual(restored,[record]);
});

test('reject backups with invalid identity, dates, histories, or dangling frames', () => {
  const record = makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  for (const patch of [{ id:'leetcode:other' },{ updatedAt:'bad' },{ due:'tomorrow' },{ cases:[{}] },{ snapshots:[{}] },{ reviews:[{}] }]) {
    assert.throws(() => validateBackup({ version:1, records:[{ ...record,...patch }] }));
  }
  assert.throws(() => validateBackup({ version:2,records:[] }));
  assert.throws(() => validateBackup({ version:1,records:[record,record] }));
  assert.throws(() => addSnapshot(record,{ action:'Call',explanation:'why',variables:{},frames:[{ id:'a',parentId:'missing',status:'active' }] }));
});

test('subset references contain every choice exactly once for small inputs', () => {
  for (let size = 0; size <= 6; size++) {
    const input = Array.from({ length:size },(_,i) => i-2);
    const result = JSON.parse(checkCase('subsets',JSON.stringify(input)).replace(' (any order)',''));
    assert.equal(result.length,2 ** size);
    const expected = new Set(Array.from({ length:2 ** size },(_,mask) => JSON.stringify(input.filter((_,i) => mask & (1 << i)))));
    assert.deepEqual(new Set(result.map(s => JSON.stringify(s))),expected);
  }
});

test('all review ratings retain prior history and use the documented interval', () => {
  const record = reviewRecord(makeRecord(),'hard',new Date(2026,0,1,12));
  for (const [rating,days] of Object.entries({ again:1,hard:1,good:3,easy:7 })) {
    const result = reviewRecord(record,rating,new Date(2026,0,10,12));
    assert.equal(new Date(result.due).getDate(),10+days);
    assert.equal(result.reviews.length,2);
    assert.deepEqual(result.reviews[0],record.reviews[0]);
    assert.equal(record.reviews.length,1);
  }
});
