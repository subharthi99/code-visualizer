import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json' };
const port = Number(process.env.PORT || 5173);
const server = http.createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only public application assets, never Git metadata, docs, or local files.
    if (!['index.html'].includes(relative) && !/^(src|assets)\/[a-zA-Z0-9_./-]+$/.test(relative)) { response.writeHead(404).end('Not found'); return; }
    const file = path.resolve(root,relative);
    if (!file.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.')) || !(await stat(file)).isFile()) { response.writeHead(404).end('Not found'); return; }
    const data = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(data);
  } catch { response.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(`Could not start local preview: ${error.message}`); process.exitCode = 1; });
server.listen(port,'127.0.0.1',() => console.log(`Code Visualizer: http://127.0.0.1:${port}`));
