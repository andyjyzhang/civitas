import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { decodeMaintenanceRequest, type MaintenanceRequest } from './consumers/sdk.js';
import { renderTriage } from './consumers/triage.js';
import { dispatchDecision } from './consumers/dispatch.js';

const fixtures = {
  'maintenance-v1': JSON.parse(await readFile(new URL('./before.json', import.meta.url), 'utf8')),
  'maintenance-v2': JSON.parse(await readFile(new URL('./after.json', import.meta.url), 'utf8')),
};
const port = Number(process.env.CIVITAS_CONSUMER_PORT ?? 4100);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid CIVITAS_CONSUMER_PORT.');
const style = `:root{font-family:"Avenir Next",Avenir,"Segoe UI",sans-serif;color:#1d3444;background:#eef4f7;font-size:17px}*{box-sizing:border-box}body{margin:0}main{max-width:880px;margin:60px auto;padding:0 24px}h1{font-size:clamp(2rem,5vw,3.3rem);line-height:1.08;letter-spacing:-.04em;margin:10px 0 18px}p{line-height:1.6;max-width:65ch}a{color:#165a8c;text-underline-offset:3px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}nav a{padding:10px 14px;border:1px solid #a8becb;border-radius:6px;background:#fff}a[aria-current="page"]{background:#1d3444;color:#fff}.request{display:flex;gap:22px;background:#fff;border:1px solid #c8d8e1;border-radius:8px;padding:30px}.signal{width:12px;flex-shrink:0;border-radius:6px;background:#b72f28}.review .signal{background:#977114}.priority{font-weight:700;color:#a12520}.review .priority{color:#806114}h2{font-size:1.3rem;line-height:1.3;margin:10px 0}dl{display:grid;grid-template-columns:auto 1fr;gap:12px 24px;margin:26px 0 0}dt{color:#526d7f}dd{margin:0;overflow-wrap:anywhere}footer{margin-top:28px;font-size:.88rem}a:focus-visible{outline:3px solid #246eac;outline-offset:3px}@media(max-width:520px){main{margin-top:30px}.request{padding:20px;gap:15px}dl{grid-template-columns:1fr;gap:5px}dd{margin-bottom:12px}}`;
const app = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const revision = url.searchParams.get('revision') ?? 'maintenance-v2';
  if (!Object.hasOwn(fixtures, revision)) { res.writeHead(400).end('Use maintenance-v1 or maintenance-v2.'); return; }
  const sourceRevision = revision as MaintenanceRequest['sourceRevision'];
  const fixture = fixtures[sourceRevision];
  const request = decodeMaintenanceRequest(fixture.response, sourceRevision);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if (url.pathname === '/api/requests' || url.pathname === '/api/dispatch' || url.pathname === '/source') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(url.pathname === '/source' ? fixture : url.pathname === '/api/dispatch' ? dispatchDecision(request) : request, null, 2));
    return;
  }
  if (url.pathname !== '/') { res.writeHead(404).end('Not found.'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance triage · Civitas consumer example</title><style>${style}</style></head><body><main><h1>Urgent stays urgent.</h1><p>The maintenance API now sends <code>priority_code: "P1"</code>. The adapted SDK, triage view and dispatch decision preserve the reviewed urgent mapping.</p><nav aria-label="Source revision"><a href="/?revision=maintenance-v1" ${revision === 'maintenance-v1' ? 'aria-current="page"' : ''}>Before · maintenance-v1</a><a href="/?revision=maintenance-v2" ${revision === 'maintenance-v2' ? 'aria-current="page"' : ''}>After · maintenance-v2</a></nav>${renderTriage(request)}<p><a href="/api/requests?revision=${revision}">SDK response</a> &nbsp; <a href="/api/dispatch?revision=${revision}">Dispatch decision</a> &nbsp; <a href="/source?revision=${revision}">Source fixture</a></p><footer>Local example using synthetic input. No property data or real dispatch. Unknown codes require manual review. These adapters are implemented examples; the UI does not claim a model generated their code.</footer></main></body></html>`);
});
app.listen(port, '127.0.0.1', () => {
  console.log(`Maintenance consumer example: http://127.0.0.1:${port}`);
  for (const [revision, fixture] of Object.entries(fixtures)) {
    const normalized = decodeMaintenanceRequest(fixture.response, revision as MaintenanceRequest['sourceRevision']);
    console.log(JSON.stringify({ sdk: normalized, dispatch: dispatchDecision(normalized) }));
  }
});
