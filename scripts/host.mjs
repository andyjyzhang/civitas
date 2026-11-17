// Single-instance shared host. Only the gateway is public; relay and LangGraph
// stay on loopback. Free Render files/session/run state can disappear on restart.
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
const children = [];
let stopping = false;
let server;

function port(value, fallback) {
  const n = Number(value || fallback);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('Invalid host port configuration.');
  return n;
}

function launch(name, args, cwd = root, extraEnv = {}) {
  if (stopping) throw new Error('Host is stopping.');
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...extraEnv }, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.push(child);
  child.once('error', () => { console.error(`${name} could not start.`); shutdown(1); });
  child.once('exit', code => {
    if (!stopping) { console.error(`${name} exited (${code ?? 'signal'}). Restarting the service is required.`); shutdown(1); }
  });
  return child;
}

function stopChild(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch { /* Already stopped. */ }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  server?.close();
  for (const child of children) stopChild(child, 'SIGTERM');
  // LangGraph's CLI has a child worker; signal the entire process group.
  setTimeout(() => {
    for (const child of children) stopChild(child, 'SIGKILL');
    process.exit(code);
  }, 5000);
}
process.once('SIGTERM', () => shutdown());
process.once('SIGINT', () => shutdown());

async function healthy(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'manual' })).ok; }
  catch { return false; }
}
async function waitFor(url) {
  const deadline = Date.now() + 120000;
  while (!stopping && Date.now() < deadline) {
    if (await healthy(url)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('A required service did not become ready.');
}

async function main() {
  if (!env.DATABASE_URL || env.RELAY_STORAGE === 'memory') throw new Error('Shared hosting requires DATABASE_URL and PostgreSQL storage.');
  for (const key of ['CIVITAS_PUBLISHER_TOKEN', 'CIVITAS_RECEIVER_TOKEN']) {
    if (!env[key] || env[key].length < 24) throw new Error(`Set ${key} to a unique generated secret.`);
  }
  const publicUrl = new URL(env.CIVITAS_PUBLIC_URL || env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:10000');
  if (publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash ||
      (publicUrl.protocol !== 'https:' && !(publicUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(publicUrl.hostname)))) {
    throw new Error('CIVITAS_PUBLIC_URL must be an HTTPS origin (HTTP is allowed only on loopback).');
  }
  if (env.RENDER && publicUrl.protocol !== 'https:') throw new Error('Render requires a public HTTPS origin.');
  const gatewayPort = port(env.PORT, 10000);
  const webPort = port(env.CIVITAS_WEB_PORT, 3000);
  const relayPort = port(env.RELAY_PORT, 4000);
  const agentPort = port(env.CIVITAS_AGENT_PORT, 2024);
  if (new Set([gatewayPort, webPort, relayPort, agentPort]).size !== 4) throw new Error('Host ports must be distinct.');
  Object.assign(env, {
    NODE_ENV: 'production', CIVITAS_HOSTED_WORKSPACE: 'true',
    CIVITAS_REPO_ROOT: root, CIVITAS_PUBLIC_URL: publicUrl.origin,
    CIVITAS_PUBLIC_RELAY_URL: publicUrl.origin,
    CIVITAS_RELAY_URL: `http://127.0.0.1:${relayPort}`,
    CIVITAS_AGENT_SERVER_URL: `http://127.0.0.1:${agentPort}`,
    RELAY_HOST: '127.0.0.1', RELAY_PORT: String(relayPort), RELAY_STORAGE: 'postgres',
    NEXT_TELEMETRY_DISABLED: '1',
  });
  await mkdir(resolve(root, '.local'), { recursive: true, mode: 0o700 });
  if (env.DATABASE_CA_PEM) {
    env.DATABASE_CA_FILE = resolve(root, '.local/host-database-ca.crt');
    await writeFile(env.DATABASE_CA_FILE, env.DATABASE_CA_PEM, { mode: 0o600 });
  }
  // Migrations are serialized and safe to rerun. No memory fallback on DB failure.
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ['apps/relay/dist/migrate.js'], { cwd: root, env, stdio: 'inherit' });
    children.push(child);
    child.once('error', () => reject(new Error('Could not start migrations.')));
    child.once('exit', code => {
      children.splice(children.indexOf(child), 1);
      code === 0 ? resolveRun() : reject(new Error('Database migrations failed.'));
    });
  });
  launch('Relay', ['apps/relay/dist/index.js']);
  await waitFor(`${env.CIVITAS_RELAY_URL}/readyz`);
  launch('Agent server', ['node_modules/@langchain/langgraph-cli/dist/cli/cli.mjs', 'dev', '--host', '127.0.0.1', '--port', String(agentPort), '--no-browser', '--no-reload', '--n-jobs-per-worker', '1', '--config', 'langgraph.json']);
  launch('Website', [resolve(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], resolve(root, 'apps/web'));
  await Promise.all([waitFor(`http://127.0.0.1:${webPort}/`), waitFor(`${env.CIVITAS_AGENT_SERVER_URL}/ok`)]);

  server = createServer(async (req, res) => {
    if (stopping) { res.writeHead(503).end(); return; }
    const bodyLimit = 1024 * 1024;
    if (Number(req.headers['content-length']) > bodyLimit) {
      res.writeHead(413, { Connection: 'close' }).end(); return;
    }
    // Do not derive routing or the trusted origin from visitor-controlled headers.
    let pathname;
    try { pathname = new URL(req.url, publicUrl).pathname; }
    catch { res.writeHead(400).end(); return; }
    if (pathname === '/readyz') {
      const checks = await Promise.all([healthy(`${env.CIVITAS_RELAY_URL}/readyz`), healthy(`http://127.0.0.1:${webPort}/`), healthy(`${env.CIVITAS_AGENT_SERVER_URL}/ok`)]);
      const ready = checks.every(Boolean);
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: ready ? 'ready' : 'unavailable', storage: 'postgres', agentFiles: 'ephemeral' }));
      return;
    }
    const headers = { ...req.headers, host: publicUrl.host, 'x-forwarded-host': publicUrl.host, 'x-forwarded-proto': publicUrl.protocol.slice(0, -1) };
    delete headers.forwarded;
    delete headers['x-forwarded-for'];
    const upstream = httpRequest({ hostname: '127.0.0.1', port: pathname.startsWith('/v1/') ? relayPort : webPort, path: req.url, method: req.method, headers }, response => {
      if (res.writableEnded || res.destroyed) { response.destroy(); return; }
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.once('error', () => {
      if (res.writableEnded) return;
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"error":"Service temporarily unavailable."}');
    });
    req.once('aborted', () => upstream.destroy());
    res.once('close', () => upstream.destroy());
    let received = 0;
    req.on('data', chunk => {
      received += chunk.length;
      if (received > bodyLimit) {
        req.unpipe(upstream); req.pause();
        if (!res.headersSent) res.writeHead(413, { Connection: 'close' }).end();
        else res.destroy();
        upstream.destroy();
      }
    });
    req.pipe(upstream); // Streams SSE without buffering approval or run events.
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.once('error', () => { console.error('Public gateway could not bind.'); shutdown(1); });
  server.listen(gatewayPort, '0.0.0.0', () => {
    console.log(`Civitas server: ${publicUrl.origin}. Tiger data persists; local agent files and browser sessions reset on restart.`);
  });
}

main().catch(error => { console.error(error.message); shutdown(1); });
