import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVisualView } from '../src/visual-ui.js';
import { emptyVisual, putTreeNode } from '../src/visual.js';

test('interactive tree exposes node controls instead of hiding them in an atomic image', () => {
  const tree = putTreeNode(emptyVisual('tree'),{ id:'root',value:1 });
  const editable = renderVisualView(tree,null,true);
  assert.match(editable,/<svg[^>]+role="group"/);
  assert.match(editable,/role="button" tabindex="0"/);
  const snapshot = renderVisualView(tree,null,false);
  assert.match(snapshot,/<svg[^>]+role="img"/);
});
