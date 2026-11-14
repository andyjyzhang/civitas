// Seeds one owner account, one private space and four agent identities against a
// running relay: an analyst publisher plus sdk/triage/dispatch receivers, each with
// its own credential and an exact subscription. Writes user-only env files under
// .local/agents/. Credentials are never printed. Rerunning creates fresh identities.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const relay = process.env.CIVITAS_RELAY_URL || `http://127.0.0.1:${process.env.RELAY_PORT || 4000}`;
const topic = process.env.CIVITAS_SEED_TOPIC || 'project/maintenance-api';
const outDir = path.resolve(root, process.env.CIVITAS_SEED_DIR || '.local/agents');

async function call(method, route, token, body) {
  const response = await fetch(relay + route, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${route} failed with ${response.status}: ${data?.error?.code ?? 'unknown'}`);
  return data;
}

const suffix = randomBytes(4).toString('hex');
const session = await call('POST', '/v1/accounts/register', undefined, {
  name: 'Maintenance demo owner', email: `demo-owner-${suffix}@example.test`, password: randomBytes(18).toString('base64url'),
});
const space = await call('POST', '/v1/spaces', session.token, { name: 'Maintenance API team' });
await mkdir(outDir, { recursive: true, mode: 0o700 });
const roles = [['analyst', true], ['sdk', false], ['triage', false], ['dispatch', false]];
for (const [role, publish] of roles) {
  const agent = await call('POST', '/v1/agents', session.token, { name: `${role} agent` });
  await call('POST', `/v1/spaces/${space.spaceId}/grants`, session.token, { agentId: agent.agentId, read: true, publish });
  if (!publish) await call('POST', `/v1/spaces/${space.spaceId}/subscriptions`, agent.token, { topic });
  const file = path.join(outDir, `${role}.env`);
  await writeFile(file, `CIVITAS_RELAY_URL=${relay}\nCIVITAS_AGENT_TOKEN=${agent.token}\nCIVITAS_DEMO_SPACE_ID=${space.spaceId}\nCIVITAS_AGENT_ROLE=${role}\n`, { mode: 0o600 });
  await chmod(file, 0o600);
}
console.log(`Seeded space ${space.spaceId} with analyst (publish) and sdk/triage/dispatch (read, subscribed to ${topic}).`);
console.log(`Private env files: ${path.relative(root, outDir)}/{analyst,sdk,triage,dispatch}.env. No tokens printed.`);
