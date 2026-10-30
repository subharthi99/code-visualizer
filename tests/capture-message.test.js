import test from 'node:test';
import assert from 'node:assert/strict';

test('context requests verify sender and current question before injecting a read-only extractor', async t => {
  let receive; const injected = [];
  globalThis.chrome = {
    runtime:{ id:'this-extension',onMessage:{ addListener:fn => { receive = fn; } } },
    action:{ onClicked:{ addListener() {} } },
    tabs:{ get:async () => ({ url:'https://leetcode.com/problems/two-sum/description/' }) },
    scripting:{ executeScript:async options => { injected.push(options); return [{ result:{ url:'https://leetcode.com/problems/two-sum/description/',title:'1. Two Sum',text:'Find indices.\nConstraints:\nDistinct indices' } }]; } }
  };
  t.after(() => { delete globalThis.chrome; });
  await import('../dist/extension/background.js?message-tests');
  assert.equal(typeof receive,'function','Extension must handle explicit context requests');
  const request = (message,sender = { id:'this-extension' }) => new Promise(resolve => receive(message,sender,resolve));
  const valid = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' });
  assert.equal(valid.ok,true);
  assert.equal(valid.context.description,'Find indices.');
  assert.equal(injected[0].target.tabId,7);
  assert.equal(typeof injected[0].func,'function');
  const wrong = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/subsets/' });
  assert.equal(wrong.ok,false);
  assert.equal(injected.length,1);
  const foreign = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' },{ id:'other-extension' });
  assert.equal(foreign.ok,false);
  assert.equal(injected.length,1);
});
