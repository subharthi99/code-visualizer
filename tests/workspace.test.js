import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as domain from '../src/domain.js';
import * as content from '../src/content.js';

// Exercise the actual application handlers with DOM/storage boundaries replaced.
// This verifies state and rendering decisions, not layout or real browser events.
async function workspace(initial) {
  const stored = new Map(initial.map(record => [record.id,structuredClone(record)]));
  const rootEvents = {}, documentEvents = {}, timers = new Map();
  const root = { innerHTML:'', querySelectorAll:() => [], addEventListener:(name,fn) => { rootEvents[name] = fn; } };
  const notice = { textContent:'', classList:{ add() {},remove() {},toggle() {} } };
  const controls = new Map();
  const modal = { innerHTML:'', addEventListener() {},showModal() {},close() {} };
  const focus = { focus() {} };
  const context = vm.createContext({
    ...domain, ...content, console, URLSearchParams, URL, structuredClone,
    Date, JSON, Object, Map, Set, Number, String, Array, Promise,
    FormData:class { constructor(form) { this.entries = Object.entries(form.values); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } },
    setTimeout:fn => { const id = timers.size+1; timers.set(id,fn); return id; }, clearTimeout:id => timers.delete(id),
    sessionStorage:{ getItem:() => initial[0]?.id || '',setItem() {} },
    location:{ hash:'',pathname:'/',search:'' }, history:{ replaceState() {} },
    window:{ addEventListener() {} },
    document:{
      querySelector:selector => selector === '#app' ? root : selector === '#modal' ? modal : selector === '#notice' ? notice : controls.get(selector) || focus,
      getElementById:() => null, addEventListener:(name,fn) => { documentEvents[name] = fn; }
    },
    openDatabase:async () => {}, readRecords:async () => structuredClone([...stored.values()]),
    writeRecords:async (records,{ onlyNew,clear,expectedUpdatedAt } = {}) => {
      if (clear) stored.clear();
      for (const r of records) {
        if (onlyNew && stored.has(r.id)) continue;
        if (expectedUpdatedAt !== undefined && stored.get(r.id)?.updatedAt !== expectedUpdatedAt) throw new Error('changed in another tab');
        stored.set(r.id,structuredClone(r));
      }
    }
  });
  const source = (await readFile(new URL('../src/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/\ninit\(\);\s*$/,'');
  vm.runInContext(source + '\nglobalThis.boundary = { init, persist };',context);
  await context.boundary.init();
  const click = (action,extra = {}) => documentEvents.click({ preventDefault() {},target:{ closest:() => ({ dataset:{ action,...extra } }) } });
  const input = (field,value) => rootEvents.input({ target:{ dataset:{ field },value } });
  const submit = (id,values) => documentEvents.submit({ preventDefault() {},target:{ id,values,dataset:{},reset() {} } });
  return { root,stored,click,input,submit,controls,notice, flush:context.boundary.persist };
}

test('workspace reveals one authored hint while preserving notes across a problem switch', async () => {
  const guided = domain.makeRecord({ exerciseId:'tree-depth' });
  const custom = domain.makeRecord({ title:'My question' });
  const app = await workspace([guided,custom]);
  assert.ok(!app.root.innerHTML.includes(content.exercises[0].hints[0]));
  app.input('restatement','Count nodes on the longest path.');
  await app.click('hint');
  assert.equal(app.stored.get(guided.id).hintCount,1);
  assert.equal(app.stored.get(guided.id).hintHistory.length,1);
  assert.ok(app.root.innerHTML.includes(content.exercises[0].hints[0]));
  assert.ok(!app.root.innerHTML.includes(content.exercises[0].hints[1]));
  await app.click('select',{ id:custom.id });
  await app.click('select',{ id:guided.id });
  assert.equal(app.stored.get(guided.id).restatement,'Count nodes on the longest path.');
  assert.ok(app.root.innerHTML.includes('Count nodes on the longest path.'));
});

test('autosave preserves algorithm edits before blur and associates cases with their revision', async () => {
  const record = domain.makeRecord({ exerciseId:'tree-depth' });
  const app = await workspace([record]);
  app.input('algorithm','Empty returns 0; otherwise 1 + max child heights.');
  await app.flush();
  const saved = app.stored.get(record.id);
  assert.equal(saved.revision,2);
  assert.equal(saved.algorithm,'Empty returns 0; otherwise 1 + max child heights.');
  await app.submit('case-form',{ category:'Empty',input:'[]',expected:'0',why:'Check the base case' });
  assert.equal(app.stored.get(record.id).cases[0].revision,2);
});

test('workspace escapes imported notes and labels custom hints as generic', async () => {
  const record = domain.makeRecord({ title:'<img src=x onerror=alert(1)>' });
  record.restatement = '</textarea><script>alert(1)</script>';
  const app = await workspace([record]);
  assert.ok(!app.root.innerHTML.includes('<script>alert(1)</script>'));
  assert.ok(app.root.innerHTML.includes('&lt;script&gt;'));
  assert.ok(app.root.innerHTML.includes('General reasoning prompts.'));
  await app.click('hint');
  assert.ok(app.root.innerHTML.includes('Restate the task.'));
});

test('manual timeline replays older state without mutating recorded snapshots', async () => {
  let record = domain.makeRecord({ exerciseId:'subsets' });
  for (const path of [[],[4]]) record = domain.addSnapshot(record,{ action:'Choose',explanation:'Follow a branch',variables:{ path },frames:[],input:'[4]',step:'1',diagram:'[4]' });
  const app = await workspace([record]);
  await app.click('tab',{ tab:'Dry run' });
  assert.ok(app.root.innerHTML.includes('SNAPSHOT 2'));
  await app.click('prev-snapshot');
  assert.ok(app.root.innerHTML.includes('SNAPSHOT 1'));
  assert.deepEqual(app.stored.get(record.id).snapshots.map(s => s.variables.path),[[],[4]]);
});

test('review reveal keeps the reconstruction and records assistance with the rating', async () => {
  const record = domain.makeRecord({ exerciseId:'tree-depth' });
  record.algorithm = 'Saved reasoning that must stay hidden.';
  const app = await workspace([record]);
  app.controls.set('#recall-attempt',{ value:'My reconstructed approach.' });
  await app.click('tab',{ tab:'Recall' });
  assert.ok(!app.root.innerHTML.includes(record.algorithm));
  await app.click('reveal-recall');
  assert.ok(app.root.innerHTML.includes(record.algorithm));
  assert.equal(app.controls.get('#recall-attempt').value,'My reconstructed approach.');
  await app.click('rate',{ rating:'good' });
  const reviewed = app.stored.get(record.id);
  assert.equal(reviewed.reviews[0].attempt,'My reconstructed approach.');
  assert.equal(reviewed.reviews[0].assisted,false);
  assert.ok(reviewed.due);
});

test('case collection deduplicates equivalent JSON despite formatting and key order', async () => {
  for (const [exerciseId,first,second] of [
    ['tree-depth','[]','[ ]'],
    ['pair-sum','{"nums":[3,3],"target":6}','{ "target":6, "nums": [3, 3] }']
  ]) {
    const record = domain.makeRecord({ exerciseId });
    const app = await workspace([record]);
    const values = { category:'Boundary',expected:'A valid result',why:'Check an assumption' };
    await app.submit('case-form',{ ...values,input:first });
    await app.submit('case-form',{ ...values,input:second });
    assert.equal(app.stored.get(record.id).cases.length,1);
    assert.match(app.notice.textContent,/already in your collection/);
  }
});
