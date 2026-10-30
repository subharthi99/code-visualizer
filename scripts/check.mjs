import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function walk(directory) {
  const files = [];
  for (const item of await readdir(path.join(root,directory), { withFileTypes: true })) {
    const file = path.join(directory,item.name);
    if (item.isDirectory()) files.push(...await walk(file));
    else if (/\.(m?js)$/.test(file)) files.push(file);
  }
  return files;
}
const files = (await Promise.all(['src','scripts','tests','extension'].map(walk))).flat();
for (const file of files) {
  const result = spawnSync(process.execPath,['--check',file],{ cwd:root, encoding:'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
}
const manifest = JSON.parse(await readFile(path.join(root,'extension/manifest.json'),'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Extension must use Manifest V3.');
console.log(`Syntax checked ${files.length} JavaScript modules and extension manifest.`);
