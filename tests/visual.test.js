import test from 'node:test';
import assert from 'node:assert/strict';
import * as visual from '../src/visual.js';
import { makeRecord, addSnapshot, validateBackup } from '../src/domain.js';

test('array values and named pointers edit immutably, including a one-past-end pointer', () => {
  const initial = visual.emptyVisual('array');
  const array = visual.setVisualArray(initial,[2,3,4]);
  const pointed = visual.putPointer(array,'left',0);
  const end = visual.putPointer(pointed,'right',3);
  assert.deepEqual(initial.values,[]);
  assert.deepEqual(end.pointers,[{ name:'left',index:0 },{ name:'right',index:3 }]);
  assert.throws(() => visual.putPointer(end,'bad',4),/index|range/i);
  assert.equal(pointed.pointers.length,1);
});

test('tree editor preserves child links while editing values and rejects occupied branches', () => {
  const root = visual.putTreeNode(visual.emptyVisual('tree'),{ id:'r',value:1 });
  const child = visual.putTreeNode(root,{ id:'l',value:2,parentId:'r',side:'left' });
  const edited = visual.putTreeNode(child,{ id:'l',value:9 });
  assert.equal(root.nodes.length,1);
  assert.equal(edited.nodes[0].left,'l');
  assert.equal(edited.nodes[1].value,9);
  assert.throws(() => visual.putTreeNode(child,{ id:'other',value:3,parentId:'r',side:'left' }),/occupied/i);
  assert.throws(() => visual.putTreeNode(child,{ id:'second-root',value:3 }),/root|parent/i);
});

test('shared-object edits update one identity without duplicating references', () => {
  const object = visual.putObject(visual.emptyVisual('objects'),'path',[4]);
  const shared = visual.putReference(visual.putReference(object,'caller.path','path'),'child.path','path');
  const changed = visual.putObject(shared,'path',[4,9]);
  assert.deepEqual(shared.objects[0].values,[4]);
  assert.deepEqual(changed.references,[{ name:'caller.path',target:'path' },{ name:'child.path',target:'path' }]);
  assert.equal(changed.objects.length,1);
  assert.deepEqual(changed.objects[0].values,[4,9]);
  assert.throws(() => visual.putReference(shared,'dangling','missing'),/object|reference/i);
});

test('visual and variable diffs identify changed entities rather than rewriting prior state', () => {
  const a = visual.putPointer(visual.setVisualArray(visual.emptyVisual(),[2,3]),'left',0);
  const b = visual.putPointer(a,'left',1);
  assert.deepEqual(visual.visualChanges(a,b),[{ label:'Pointer left',before:0,after:1 }]);
  assert.deepEqual(visual.stateChanges({ path:[] },{ path:[4] }),[{ label:'path',before:[],after:[4] }]);
});

test('visual snapshots survive backup round-trip, rejecting cyclic or dangling diagrams', () => {
  const visualState = visual.putTreeNode(visual.emptyVisual('tree'),{ id:'root',value:1 });
  const record = addSnapshot(makeRecord(),{ action:'Visit root',explanation:'Start traversal',variables:{},frames:[],visual:visualState });
  assert.deepEqual(record.snapshots[0].visual,visualState);
  const restored = validateBackup(JSON.parse(JSON.stringify({ version:1,records:[record] })));
  assert.deepEqual(restored[0].snapshots[0].visual,visualState);
  const cycle = { kind:'tree',rootId:'r',activeNodeId:'r',nodes:[{ id:'r',value:1,left:'r',right:null }] };
  assert.throws(() => visual.validateVisual(cycle),/tree|cycle/i);
  const bad = structuredClone(record); bad.snapshots[0].visual = cycle;
  assert.throws(() => validateBackup({ version:1,records:[bad] }),/tree|cycle/i);
});
