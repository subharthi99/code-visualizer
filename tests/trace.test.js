import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as trace from '../src/trace.js';
import { makeRecord, validateBackup } from '../src/domain.js';

const sample = () => JSON.parse(spawnSync('python3',['-I','scripts/trace_python.py'],{
  input:JSON.stringify({ source:'def f(n):\n    return n + 1\nx = f(2)\nprint(x)\n' }),encoding:'utf8'
}).stdout);

test('trace import preserves exact source, event snapshots and algorithm association in backups', () => {
  const record = makeRecord();
  record.pythonSource = 'Unsaved newer implementation';
  record.pythonTrace = { ...trace.validateTrace(sample()),algorithmRevision:record.revision };
  const [restored] = validateBackup({ version:1,records:[record] });
  assert.deepEqual(restored.pythonTrace,record.pythonTrace);
  assert.equal(restored.pythonSource,record.pythonSource);
  assert.equal(restored.snapshots.length,0);
  const bad = structuredClone(record);
  bad.pythonTrace.events[0].frames[0].locals.x = { ref:'missing' };
  assert.throws(() => validateBackup({ version:1,records:[bad] }),/trace|reference/i);
});

test('malformed traces reject broken stacks, dangling refs, invalid source locations and statuses', () => {
  for (const mutate of [
    t => { t.version = 2; },
    t => { t.events[0].id = 99; },
    t => { t.events[0].line = 9999; },
    t => { t.events[0].frameId = 'unknown'; },
    t => { t.events[0].frames[0].parentId = 'self'; },
    t => { t.events[0].heap.o1 = { type:'list',items:[{ ref:'missing' }] }; },
    t => { t.events[0].frames[0].locals.x = { arbitrary:true }; },
    t => { t.status = 'complete'; t.events = []; },
    t => { t.events[0].kind = 'invented'; }
  ]) {
    const data = sample(); mutate(data);
    assert.throws(() => trace.validateTrace(data),/trace/i);
  }
});

test('step over skips descendants and step out reaches a resumed caller with reversible navigation', () => {
  const data = trace.validateTrace(sample());
  const call = data.events.findIndex(e => e.function === 'f' && e.kind === 'call');
  const exit = data.events.findIndex(e => e.function === 'f' && e.kind === 'return');
  assert.equal(trace.tracePosition(data,call,'into'),call+1);
  assert.equal(trace.tracePosition(data,call,'over'),call+1);
  assert.equal(trace.tracePosition(data,call,'out'),exit+1);
  assert.equal(trace.tracePosition(data,call-1,'over'),exit+1);
  assert.equal(trace.tracePosition(data,0,'previous'),0);
  assert.equal(trace.tracePosition(data,call,'first'),0);
  assert.equal(trace.tracePosition(data,call,'last'),data.events.length-1);
});
