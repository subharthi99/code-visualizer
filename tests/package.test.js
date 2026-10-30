import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('standalone preview contains a valid self-contained module and no external stylesheets', async () => {
  const html = await readFile(new URL('../dist/web/standalone.html',import.meta.url),'utf8');
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotMatch(script,/^import /m);
  assert.doesNotMatch(html,/<link rel="stylesheet"/);
  const result = spawnSync(process.execPath,['--check','--input-type=module'],{ input:script,encoding:'utf8' });
  assert.equal(result.status,0,result.stderr);
});

test('app and extension distributions use the same release version', async () => {
  const app = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const extension = JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.equal(app.version,extension.version);
});
