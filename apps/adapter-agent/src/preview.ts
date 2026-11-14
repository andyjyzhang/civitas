#!/usr/bin/env node
// node dist/preview.js <runId>
// Renders the v2 sample payloads with the ORIGINAL triage consumer and with the PATCHED
// copy at .local/adapter/<runId>/triage/, writing .local/adapter/<runId>/triage-preview.html.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const runId = process.argv[2];
if (!runId || !/^[A-Za-z0-9_-]{1,64}$/.test(runId)) throw new Error('Usage: node dist/preview.js <runId>');
const patched = resolve(root, '.local/adapter', runId, 'triage');
if (!existsSync(patched)) throw new Error(`No patched triage copy at ${patched}; run the triage adapter first.`);
const original = resolve(root, 'examples/consumers/triage');
const tsx = resolve(root, 'node_modules/.bin/tsx');
const escape = (value: string) => value.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

function render(dir: string, sample: string) {
  try {
    return execFileSync(tsx, [resolve(dir, 'src/render.ts'), resolve(original, 'samples', sample)], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return `<pre style="color:#b42318">render failed: ${escape(String((error as { stderr?: string }).stderr || error))}</pre>`;
  }
}

const rows = ['v2-p1.json', 'v2-p2.json'].map(sample => `<tr><th>${sample}</th><td>${render(original, sample)}</td><td>${render(patched, sample)}</td></tr>`).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>Triage preview ${escape(runId)}</title>
<body style="font-family:sans-serif;margin:24px">
<h1>Triage card preview (synthetic) &mdash; run ${escape(runId)}</h1>
<p>Same v2 payloads rendered by the original v1 consumer and by the copy patched by the adapter agent.</p>
<table border="1" cellpadding="8" style="border-collapse:collapse;vertical-align:top">
<tr><th>Payload</th><th>Original (examples/consumers/triage)</th><th>Patched (.local/adapter/${escape(runId)}/triage)</th></tr>
${rows}
</table></body>`;
const out = resolve(root, '.local/adapter', runId, 'triage-preview.html');
writeFileSync(out, html);
console.log(`Wrote ${out}`);
