import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
for (const destination of ['web','extension']) {
  const directory = path.join(out, destination);
  await mkdir(directory, { recursive: true });
  for (const source of ['index.html','src','assets']) await cp(path.join(root,source), path.join(directory,source), { recursive: true });
}
for (const name of ['manifest.json','background.js']) await cp(path.join(root,'extension',name), path.join(out,'extension',name));
// A standalone preview also works from disk when a local server is unavailable.
// Source remains native modules; this small fixed-order bundle has no runtime eval.
let bundled = '';
for (const file of ['content.js','domain.js','persistence.js','app.js']) {
  bundled += (await readFile(path.join(root,'src',file),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'') + '\n';
}
const css = (await readFile(path.join(root,'src/theme.css'),'utf8')) + (await readFile(path.join(root,'src/styles.css'),'utf8')).replace(/^@import .*;\n/,'');
const html = (await readFile(path.join(root,'index.html'),'utf8'))
  .replace('<link rel="stylesheet" href="./src/styles.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./src/app.js"></script>', () => `<script type="module">${bundled.replaceAll('</script','<\\/script')}</script>`);
await writeFile(path.join(out,'web','standalone.html'),html);
const manifest = JSON.parse(await readFile(path.join(out,'extension','manifest.json'),'utf8'));
if (manifest.permissions.includes('tabs') || manifest.host_permissions) throw new Error('Unexpected broad extension permissions.');
await writeFile(path.join(out,'extension','INSTALL.txt'), 'Load this directory as an unpacked extension in chrome://extensions. See docs/DEVELOPMENT.md for permissions, limitations, and checks.\n');
console.log('Built dist/web and dist/extension. No third-party dependencies or network access required.');
