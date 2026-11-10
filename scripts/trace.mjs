import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const filename = process.argv[2];
if (!filename || process.argv.length !== 3) {
  console.error('Usage: node scripts/trace.mjs program.py > trace.json (Python 3.9+, macOS/Linux; trusted study programs only)');
  process.exit(1);
}
try {
  const source = await readFile(filename,'utf8');
  if (source.length > 20000) throw new Error('Source limit: 20,000 characters.');
  const run = spawnSync(process.env.PYTHON || 'python3',['-I',fileURLToPath(new URL('./trace_python.py',import.meta.url))],{
    input:JSON.stringify({ source }),encoding:'utf8',timeout:5000,maxBuffer:5_000_000
  });
  if (run.error || run.status !== 0) throw new Error(run.error?.code === 'ETIMEDOUT' ? 'Python exceeded the host deadline. No complete trace was produced.' : run.error?.message || run.stderr || 'Python exited before producing a trace.');
  JSON.parse(run.stdout);
  process.stdout.write(run.stdout);
} catch (error) {
  console.error(`Trace failed: ${error.message}`);
  process.exitCode = 1;
}
