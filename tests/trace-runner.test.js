import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateTrace } from '../src/trace.js';

const runPython = (source, extra = {}) => {
  const result = spawnSync('python3',['-I','scripts/trace_python.py'],{ input:JSON.stringify({ source,...extra }),encoding:'utf8',timeout:6000,maxBuffer:6_000_000 });
  assert.equal(result.status,0,result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
};

test('native factorial results match traced returns with distinct invocations and caller handoff', () => {
  const source = 'def f(n):\n    if n <= 1:\n        return 1\n    child = f(n - 1)\n    return n * child\nresult = f(3)\nprint(result)\n';
  const trace = runPython(source);
  const native = spawnSync('python3',['-I','-c',source],{ encoding:'utf8' });
  assert.equal(trace.status,'complete');
  assert.equal(trace.stdout,native.stdout);
  const calls = trace.events.filter(e => e.kind === 'call' && e.function === 'f');
  assert.equal(new Set(calls.map(e => e.frameId)).size,3);
  assert.deepEqual(calls.map(e => e.frames.at(-1).locals.n),[3,2,1]);
  const returned = trace.events.filter(e => e.kind === 'return' && e.function === 'f');
  assert.deepEqual(returned.map(e => e.value),[1,2,6]);
  const last = returned.at(-1);
  const resume = trace.events[last.id];
  assert.equal(resume.frameId,last.parentId);
  assert.equal(resume.frames.at(-1).locals.result,6);
  assert.equal(trace.events[0].id,1);
  assert.ok(trace.events.every((e,i) => e.id === i+1));
});

test('shared mutable objects keep identity and historical values across child calls', () => {
  const trace = runPython('def child(path):\n    path.append(4)\n    path.pop()\npath = []\nalias = path\nchild(path)\n');
  assert.equal(trace.status,'complete');
  const appendEffect = trace.events.find(e => e.function === 'child' && e.kind === 'line' && e.line === 3);
  const ref = appendEffect.frames.at(-1).locals.path;
  assert.deepEqual(appendEffect.frames[0].locals.alias,ref);
  assert.deepEqual(appendEffect.heap[ref.ref],{ type:'list',items:[4] });
  const final = trace.events.at(-1);
  assert.deepEqual(final.heap[ref.ref].items,[]);
  assert.deepEqual(appendEffect.heap[ref.ref].items,[4]);
});

test('exception propagation is labeled unwind rather than a successful None return', () => {
  const trace = runPython('def fail():\n    return 1 / 0\nfail()\n');
  assert.equal(trace.status,'error');
  assert.match(trace.message,/ZeroDivisionError/);
  assert.equal(trace.events.filter(e => e.kind === 'exception').length,2);
  assert.equal(trace.events.filter(e => e.kind === 'unwind').length,2);
  assert.equal(trace.events.filter(e => e.kind === 'return').length,0);
  const caught = runPython('try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    x = 7\n');
  assert.equal(caught.status,'complete');
  assert.equal(caught.events.at(-1).kind,'return');
  assert.equal(caught.events.at(-1).frames[0].locals.x,7);
});

test('finally cleanup does not turn exception unwinding into a successful return', () => {
  const raised = runPython('def f():\n    try:\n        x = 1 / 0\n    finally:\n        cleanup = True\nf()\n');
  assert.equal(raised.status,'error');
  assert.equal(raised.events.find(e => e.function === 'f' && ['unwind','return'].includes(e.kind)).kind,'unwind');
  const suppressed = runPython('def f():\n    try:\n        x = 1 / 0\n    finally:\n        return None\nf()\n');
  assert.equal(suppressed.status,'complete');
  assert.equal(suppressed.events.find(e => e.function === 'f' && ['unwind','return'].includes(e.kind)).kind,'return');
});

test('bounded failures retain partial events and never report a complete trace', () => {
  const infinite = runPython('while True:\n    pass\n',{ maxEvents:20 });
  assert.equal(infinite.status,'limited');
  assert.equal(infinite.events.length,20);
  assert.match(infinite.message,/event/i);
  const deep = runPython('def f():\n    return f()\nf()\n');
  assert.equal(deep.status,'limited');
  assert.match(deep.message,/depth/i);
  assert.equal(runPython('x = [0] * 100').status,'limited');
  assert.equal(runPython('def broken(:').status,'error');
  assert.match(runPython('import os').message,/unsupported/i);
  assert.match(runPython('x = (n for n in range(3))').message,/unsupported/i);
});

test('program exception handling cannot hide a stopped trace or output limit', () => {
  const stopped = runPython('try:\n    while True:\n        pass\nexcept:\n    x = 1\n',{ maxEvents:10 });
  assert.equal(stopped.status,'limited');
  assert.equal(stopped.events.length,10);
  const output = runPython('try:\n    print("x" * 9000)\nexcept:\n    x = 1\n');
  assert.equal(output.status,'limited');
  assert.match(output.message,/output/i);
});

test('cyclic lists and repeated calls preserve separate invocation and object identities', () => {
  const trace = runPython('def f(n):\n    return n\na = f(1)\nb = f(1)\nx = []\nx.append(x)\n');
  assert.equal(trace.status,'complete');
  const calls = trace.events.filter(e => e.function === 'f' && e.kind === 'call');
  assert.notEqual(calls[0].frameId,calls[1].frameId);
  const end = trace.events.at(-1), ref = end.frames[0].locals.x;
  assert.deepEqual(end.heap[ref.ref].items,[ref]);
});

test('shipped factorial, Fibonacci, tree depth and subsets examples agree with native Python', () => {
  for (const name of ['factorial','fibonacci','tree-depth','subsets']) {
    const source = readFileSync(`assets/examples/${name}.py`,'utf8');
    const native = spawnSync('python3',['-I','-c',source],{ encoding:'utf8' });
    const trace = validateTrace(runPython(source));
    assert.equal(trace.status,'complete',trace.message);
    assert.equal(trace.stdout,native.stdout);
    assert.equal(native.status,0,native.stderr);
    if (name === 'fibonacci') {
      const ones = trace.events.filter(e => e.kind === 'call' && e.function === 'fib' && e.frames.at(-1).locals.n === 1);
      assert.ok(ones.length > 1);
      assert.equal(new Set(ones.map(e => e.frameId)).size,ones.length);
    }
  }
});

test('CLI writes clean JSON and reports missing source and Python executables on stderr', () => {
  const success = spawnSync(process.execPath,['scripts/trace.mjs','assets/examples/factorial.py'],{ encoding:'utf8' });
  assert.equal(success.status,0,success.stderr);
  assert.equal(validateTrace(JSON.parse(success.stdout)).stdout,'6\n');
  const missing = spawnSync(process.execPath,['scripts/trace.mjs','/missing-program.py'],{ encoding:'utf8' });
  assert.equal(missing.status,1);
  assert.equal(missing.stdout,'');
  const python = spawnSync(process.execPath,['scripts/trace.mjs','assets/examples/factorial.py'],{ encoding:'utf8',env:{ ...process.env,PYTHON:'/missing-python' } });
  assert.equal(python.status,1);
  assert.match(python.stderr,/Trace failed/);
  assert.equal(python.stdout,'');
});
