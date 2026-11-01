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
  chrome.tabs.get = async () => ({ url:'https://leetcode.com/problems/two-sum/solutions/' });
  const solutions = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' });
  assert.equal(solutions.ok,false);
  assert.match(solutions.error,/Description/);
  assert.equal(injected.length,1,'Do not inject an extractor into Solutions');
  chrome.tabs.get = async () => ({});
  const expired = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' });
  assert.match(expired.error,/access|toolbar/i);
  chrome.tabs.get = async () => ({ url:'https://leetcode.com/problems/two-sum/description/' });
  chrome.scripting.executeScript = async () => [{ result:undefined }];
  const unavailable = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' });
  assert.match(unavailable.error,/description|rendered/i);
  let reads = 0;
  chrome.tabs.get = async () => ({ url:++reads === 1 ? 'https://leetcode.com/problems/two-sum/description/' : 'https://leetcode.com/problems/subsets/description/' });
  chrome.scripting.executeScript = async () => [{ result:{ url:'https://leetcode.com/problems/two-sum/description/',text:'Original question text' } }];
  const navigated = await request({ type:'capture-context',tabId:7,url:'https://leetcode.com/problems/two-sum/' });
  assert.equal(navigated.ok,false);
  assert.match(navigated.error,/changed|different/i);
});
