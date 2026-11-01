import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as domain from '../src/domain.js';
import * as content from '../src/content.js';
import * as contextModule from '../src/context.js';
import * as lessonModule from '../src/lessons.js';
import * as visualUI from '../src/visual-ui.js';
import * as visualModule from '../src/visual.js';
import * as patternModule from '../src/patterns.js';
import * as challengeModule from '../src/challenges.js';
import * as recallModule from '../src/recall.js';

// Exercise the actual application handlers with DOM/storage boundaries replaced.
// This verifies state and rendering decisions, not layout or real browser events.
async function workspace(initial, options = {}) {
  const stored = new Map(initial.map(record => [record.id,structuredClone(record)]));
  const rootEvents = {}, documentEvents = {}, timers = new Map();
  const root = { innerHTML:'', querySelectorAll:() => [], addEventListener:(name,fn) => { rootEvents[name] = fn; } };
  const notice = { textContent:'', classList:{ add() {},remove() {},toggle() {} } };
  const controls = new Map();
  const modal = { innerHTML:'', addEventListener() {},showModal() {},close() {} };
  const focus = { focus() {} };
  const context = vm.createContext({
    ...domain, ...content, ...contextModule, ...lessonModule, ...visualModule, ...visualUI, ...patternModule, ...challengeModule, ...recallModule, console, URLSearchParams, URL, structuredClone, chrome:options.chrome,
    Date:options.now ? class extends Date {
      constructor(...args) { super(...(args.length ? args : [options.now])); }
      static now() { return new Date(options.now).getTime(); }
    } : Date, JSON, Object, Map, Set, Number, String, Array, Promise,
    FormData:class { constructor(form) { this.entries = Object.entries(form.values); } [Symbol.iterator]() { return this.entries[Symbol.iterator](); } },
    setTimeout:fn => { const id = timers.size+1; timers.set(id,fn); return id; }, clearTimeout:id => timers.delete(id),
    sessionStorage:{ getItem:key => key === 'cv-source-tab' ? String(options.sourceTabId ?? '') : initial[0]?.id || '',setItem() {} },
    location:{ hash:'',pathname:'/',search:'' }, history:{ replaceState() {} },
    window:{ addEventListener() {} },
    document:{
      querySelector:selector => selector === '#app' ? root : selector === '#modal' ? modal : selector === '#notice' ? notice : controls.get(selector) || focus,
      getElementById:id => controls.get(`#${id}`) || null, addEventListener:(name,fn) => { documentEvents[name] = fn; }
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
  const change = (id,checked) => rootEvents.change?.({ target:{ id,checked } });
  return { root,stored,click,input,change,submit,controls,notice,modal, flush:context.boundary.persist };
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

test('challenge outcomes require a prediction and smaller failures preserve the original case', async () => {
  const record = domain.makeRecord({ url:'https://leetcode.com/problems/binary-search/' });
  const app = await workspace([record]);
  await app.click('tab',{ tab:'Edge cases' });
  await app.click('suggest-case');
  assert.match(app.root.innerHTML,/strictly increasing/);
  await app.click('reveal-case');
  assert.match(app.notice.textContent,/predict/i);
  assert.ok(!app.root.innerHTML.includes('Reference outcome:'));
  app.controls.set('#challenge-prediction',{ value:'-1' });
  await app.click('reveal-case');
  assert.match(app.root.innerHTML,/Reference outcome:/);
  assert.match(app.root.innerHTML,/Your prediction:.*-1/);
  await app.submit('case-form',{ category:'Last candidate',input:'{"nums":[1,3],"target":3}',expected:'1',why:'My loop misses a boundary' });
  const c = app.stored.get(record.id).cases[0];
  await app.click('check-case',{ id:c.id });
  assert.equal(app.stored.get(record.id).cases[0].reference,'1');
  await app.submit('counterexample-form',{ caseId:c.id,input:'{"nums":[3],"target":3}',actual:'-1',expected:'0',lesson:'Inspect the final candidate.' });
  assert.equal(app.stored.get(record.id).cases[0].reductions[0].actual,'-1');
  assert.match(app.root.innerHTML,/Inspect the final candidate/);
});

test('pattern discovery compares contracts and opens related questions without losing notes', async () => {
  const record = domain.makeRecord({ exerciseId:'tree-depth' });
  const app = await workspace([record]);
  app.input('approach','Combine child heights');
  await app.click('tab',{ tab:'Patterns' });
  assert.match(app.root.innerHTML,/Tree recursion/);
  assert.match(app.root.innerHTML,/When this approach fails/);
  assert.match(app.root.innerHTML,/Diameter of Binary Tree/);
  await app.click('related-problem',{ url:'https://leetcode.com/problems/diameter-of-binary-tree/' });
  assert.equal(app.stored.get(record.id).approach,'Combine child heights');
  assert.ok(app.stored.has('leetcode:diameter-of-binary-tree'));
  assert.match(app.root.innerHTML,/Authored lesson for this question/);
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
  app.controls.set('#recall-transition',{ value:'Return to the parent with height 1.' });
  app.controls.set('#recall-edge-case',{ value:'One root returns 1.' });
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

test('recall hides saved mistakes until reveal, latches pre-reveal evidence, and groups the review queue', async () => {
  const record = domain.makeRecord({ exerciseId:'tree-depth' });
  record.mistake = 'SECRET: confused node depth and edge depth'; record.due = '2026-01-01T12:00:00Z';
  const later = domain.makeRecord({ title:'Future review' }); later.due = '2099-01-01T12:00:00Z';
  const app = await workspace([record,later]);
  await app.click('tab',{ tab:'Recall' });
  assert.ok(!app.root.innerHTML.includes('SECRET'));
  assert.match(app.root.innerHTML,/fresh edge case/);
  await app.click('rate',{ rating:'easy' });
  assert.equal(app.stored.get(record.id).reviews.length,0);
  app.controls.set('#recall-attempt',{ value:'Before reveal' });
  app.controls.set('#recall-transition',{ value:'' });
  app.controls.set('#recall-edge-case',{ value:'' });
  await app.click('reveal-recall');
  assert.match(app.root.innerHTML,/SECRET/);
  app.controls.get('#recall-attempt').value = 'Copied after reveal';
  await app.click('rate',{ rating:'easy' });
  const saved = app.stored.get(record.id).reviews[0];
  assert.equal(saved.attempt,'Before reveal'); assert.equal(saved.assisted,true); assert.equal(saved.intervalDays,1);
  await app.click('reviews');
  assert.match(app.root.innerHTML,/Due now/);
  assert.match(app.root.innerHTML,/Upcoming/);
  assert.match(app.root.innerHTML,/Self-rated progress/);
});

test('declaring help after reveal updates intervals and cannot be undone for that attempt', async () => {
  const record = domain.makeRecord({ title:'Help usage' });
  const app = await workspace([record]);
  await app.click('tab',{ tab:'Recall' });
  for (const id of ['#recall-attempt','#recall-transition','#recall-edge-case']) app.controls.set(id,{ value:'Independent reconstruction' });
  await app.click('reveal-recall');
  assert.match(app.root.innerHTML,/Easy<small>7 days/);
  app.change('recall-help',true);
  assert.match(app.root.innerHTML,/Easy<small>1 day/);
  app.change('recall-help',false);
  assert.match(app.root.innerHTML,/Easy<small>1 day/);
  await app.click('rate',{ rating:'easy' });
  assert.equal(app.stored.get(record.id).reviews[0].assisted,true);
});

test('help acknowledgement survives tab changes before recall reveal', async () => {
  const record = domain.makeRecord({ title:'Recall draft' });
  const app = await workspace([record]);
  await app.click('tab',{ tab:'Recall' });
  const checkbox = { type:'checkbox',value:'on',checked:true };
  const form = { id:'recall-form',values:{ usedHelp:'on' },dataset:{},elements:{ namedItem:name => name === 'usedHelp' ? checkbox : null } };
  app.root.querySelectorAll = () => [form];
  await app.click('tab',{ tab:'Understand' });
  checkbox.checked = false;
  app.root.querySelectorAll = () => [];
  app.controls.set('#recall-form',form);
  await app.click('tab',{ tab:'Recall' });
  assert.equal(checkbox.checked,true);
});

test('tomorrow scheduling advances the local calendar across daylight saving changes', async () => {
  const previousTZ = process.env.TZ; process.env.TZ = 'America/Los_Angeles';
  try {
    const record = domain.makeRecord({ title:'Calendar review' });
    const app = await workspace([record],{ now:'2026-11-01T00:30:00-07:00' });
    await app.click('schedule');
    assert.equal(app.stored.get(record.id).due,'2026-11-02T08:30:00.000Z');
  } finally { if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ; }
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

test('question context is previewed and only explicitly selected fields replace saved data', async () => {
  const record = domain.makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  record.constraints = 'Keep my constraint notes'; record.approach = 'Keep my reasoning';
  const app = await workspace([record]);
  await app.click('import-context');
  assert.match(app.modal.innerHTML,/Review question context/);
  assert.equal(app.stored.get(record.id).description,undefined);
  await app.submit('context-form',{ url:record.url,title:'Two Sum',description:'Imported statement',examples:'Imported examples',constraints:'Replace me', 'use-description':'on','use-examples':'on' });
  assert.equal(app.stored.get(record.id).description,'Imported statement');
  assert.equal(app.stored.get(record.id).constraints,'Keep my constraint notes');
  assert.equal(app.stored.get(record.id).approach,'Keep my reasoning');
  assert.match(app.root.innerHTML,/Imported statement/);
});

test('linked questions show staged authored hints and attempt-specific checkpoints', async () => {
  const record = domain.makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  record.approach = 'Use a hash map, inserting before checking.';
  const app = await workspace([record]);
  assert.match(app.root.innerHTML,/Authored lesson for this question/);
  assert.ok(!app.root.innerHTML.includes(content.exercises[2].hints[0]));
  await app.click('hint');
  assert.match(app.root.innerHTML,/Which indices are already in your map/);
  assert.ok(app.root.innerHTML.includes(content.exercises[2].hints[0]));
  assert.ok(!app.root.innerHTML.includes(content.exercises[2].hints[1]));
  await app.click('hint-focus',{ focus:'implementation' });
  assert.match(app.root.innerHTML,/Trace index 0/);
});

test('visual dry runs save editable diagrams and highlight changes when replayed', async () => {
  const record = domain.makeRecord({ title:'Visual workspace' });
  const app = await workspace([record]);
  await app.click('tab',{ tab:'Dry run' });
  assert.match(app.root.innerHTML,/Visual state editor/);
  app.controls.set('#array-values',{ value:'[2,3]' });
  await app.click('visual-set-array');
  app.controls.set('#pointer-name',{ value:'left' }); app.controls.set('#pointer-index',{ value:'0' });
  await app.click('visual-pointer');
  await app.submit('snapshot-form',{ action:'Initial window',explanation:'Start at index 0',variables:'{"i":0}',input:'[2,3]',step:'1',diagram:'' });
  app.controls.get('#pointer-index').value = '1';
  await app.click('visual-pointer');
  await app.submit('snapshot-form',{ action:'Move right',explanation:'Advance the boundary',variables:'{"i":1}',input:'[2,3]',step:'2',diagram:'' });
  assert.equal(app.stored.get(record.id).snapshots[0].visual.pointers[0].index,0);
  assert.equal(app.stored.get(record.id).snapshots[1].visual.pointers[0].index,1);
  assert.match(app.root.innerHTML,/Pointer left/);
  assert.match(app.root.innerHTML,/What changed/);
  await app.click('prev-snapshot');
  assert.match(app.root.innerHTML,/Initial window/);
});

test('a delayed context response cannot attach one question’s description to another question', async () => {
  const first = domain.makeRecord({ url:'https://leetcode.com/problems/two-sum/' });
  const second = domain.makeRecord({ url:'https://leetcode.com/problems/subsets/' });
  let deliver, started;
  const ready = new Promise(resolve => { started = resolve; });
  const app = await workspace([first,second],{ sourceTabId:7,chrome:{ runtime:{ id:'test-extension',sendMessage:() => { started(); return new Promise(resolve => { deliver = resolve; }); } } } });
  const importing = app.click('import-context');
  await ready;
  await app.click('select',{ id:second.id });
  deliver({ ok:true,context:{ url:first.url,description:'First question statement' } });
  await importing;
  assert.equal(app.modal.innerHTML,'');
  assert.match(app.notice.textContent,/switched|changed/i);
});
