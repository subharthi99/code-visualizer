import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('extension requests only activeTab and sidePanel, with no page injection', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['activeTab','sidePanel']);
  assert.equal(manifest.host_permissions,undefined);
  assert.equal(manifest.content_scripts,undefined);
});

test('built extension captures only the clicked question and falls back on panel failure', async () => {
  let listener;
  const calls = [];
  globalThis.chrome = {
    action:{ onClicked:{ addListener:fn => { listener = fn; } } },
    runtime:{ getURL:path => `chrome-extension://example/${path}` },
    tabs:{ create:options => { calls.push(['tab',options]); return Promise.resolve(); } },
    sidePanel:{ setOptions:options => { calls.push(['set',options]); return Promise.resolve(); }, open:options => { calls.push(['open',options]); return Promise.resolve(); } }
  };
  await import('../dist/extension/background.js');
  listener({ id:7,url:'https://leetcode.com/problems/two-sum/description/?x=1' });
  assert.equal(calls[0][1].tabId,7);
  assert.ok(calls[0][1].path.includes(encodeURIComponent('https://leetcode.com/problems/two-sum/')));
  assert.deepEqual(calls[1],['open',{ tabId:7 }]);
  calls.length = 0;
  listener({ id:8,url:'https://example.com/' });
  assert.ok(calls[0][1].path.includes('unsupported=1'));
  chrome.sidePanel.open = () => Promise.reject(new Error('No panel'));
  listener({ id:9,url:'https://leetcode.com/problems/subsets/' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.at(-1)[0],'tab');
  assert.ok(calls.at(-1)[1].url.includes(encodeURIComponent('https://leetcode.com/problems/subsets/')));
  calls.length = 0;
  chrome.sidePanel.open = () => { throw new Error('Panel unavailable synchronously'); };
  assert.doesNotThrow(() => listener({ id:10,url:'https://leetcode.com/problems/two-sum/' }));
  assert.equal(calls.at(-1)[0],'tab');
  delete globalThis.chrome;
});
