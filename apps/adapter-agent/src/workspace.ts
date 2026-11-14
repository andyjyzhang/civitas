// Server-side plumbing shared by the CLI runner and the LangGraph agent server: consumer
// config, run-config validation, per-space credentials, and short-lived MCP bridge calls.
// Credentials stay in process memory and only reach the MCP bridge child process; they
// never enter graph state, messages, metadata, or logs.
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ledgerPath } from './budget.js';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const SPACE_ID_RE = /^sp_[A-Za-z0-9_-]{1,200}$/;
export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

export type ConsumerConfig = { role: string; label: string; path: string; topic: string };

export function loadConsumers(): ConsumerConfig[] {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'agents.config.json'), 'utf8')) as { consumers?: unknown };
  if (!Array.isArray(config.consumers)) throw new Error('agents.config.json has no consumers list.');
  return config.consumers.filter((item): item is ConsumerConfig => !!item && typeof item === 'object'
    && typeof item.role === 'string' && /^[a-z0-9_-]{1,50}$/.test(item.role)
    && typeof item.path === 'string' && typeof item.topic === 'string' && typeof item.label === 'string');
}

export function findConsumer(role: unknown): ConsumerConfig {
  const consumer = typeof role === 'string' ? loadConsumers().find(item => item.role === role) : undefined;
  if (!consumer) throw new Error('role must be one of the consumers in agents.config.json.');
  return consumer;
}

/** Resolves a configured path relative to the repo root, refusing anything outside it. */
export function repoPath(path: string) {
  const full = resolve(ROOT, path);
  const rel = relative(ROOT, full);
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..') || rel.startsWith('.local')) throw new Error(`Configured path ${path} is outside the repository.`);
  return full;
}

export function checkSpaceId(spaceId: unknown): string {
  if (typeof spaceId !== 'string' || !SPACE_ID_RE.test(spaceId)) throw new Error('spaceId must match sp_[A-Za-z0-9_-]{1,200}.');
  return spaceId;
}

export function checkRunId(runId: unknown): string {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw new Error('runId must be 1-100 letters, digits, hyphens or underscores.');
  return runId;
}

export type Credentials = { relayUrl: string; token: string; spaceId: string };

export function parseEnvFile(file: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export function credentialsFromFile(file: string, expectedSpaceId?: string): Credentials {
  let values: Record<string, string>;
  try { values = parseEnvFile(file); }
  catch { throw new Error('No agent credential is connected for this role and space. Connect the workspace agents first.'); }
  const { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN, CIVITAS_DEMO_SPACE_ID } = values;
  if (!CIVITAS_RELAY_URL || !CIVITAS_AGENT_TOKEN || !CIVITAS_DEMO_SPACE_ID) throw new Error('Agent credential file is incomplete.');
  if (expectedSpaceId !== undefined && CIVITAS_DEMO_SPACE_ID !== expectedSpaceId) throw new Error('Agent credential belongs to a different space.');
  return { relayUrl: CIVITAS_RELAY_URL, token: CIVITAS_AGENT_TOKEN, spaceId: CIVITAS_DEMO_SPACE_ID };
}

/** `.local/workspace-agents/<spaceId>/<role>.env`, written by the web lane (mode 0600). */
export function loadWorkspaceCredentials(spaceId: string, role: string): Credentials {
  checkSpaceId(spaceId);
  if (!/^[a-z0-9_-]{1,50}$/.test(role)) throw new Error('Invalid agent role.');
  return credentialsFromFile(resolve(ROOT, '.local/workspace-agents', spaceId, `${role}.env`), spaceId);
}

const bridgePath = () => resolve(ROOT, 'packages/cli/dist/index.js');

/** Calls one Civitas MCP tool via @langchain/mcp-adapters; the space is always injected here. */
export async function callCivitas(creds: Credentials, name: string, args: Record<string, unknown>): Promise<any> {
  const mcp = new MultiServerMCPClient({ mcpServers: { civitas: {
    transport: 'stdio', command: process.execPath, args: [bridgePath()], stderr: 'ignore',
    // Only relay URL and this role's token reach the bridge; model keys are never forwarded.
    env: { CIVITAS_RELAY_URL: creds.relayUrl, CIVITAS_AGENT_TOKEN: creds.token },
  } } });
  try {
    const client = await mcp.getClient('civitas');
    if (!client) throw new Error('Civitas MCP bridge did not start');
    const response = await client.callTool({ name, arguments: { ...args, space_id: creds.spaceId } });
    const text = (response.content as { type: string; text?: string }[]).map(part => part.text ?? '').join('');
    if (response.isError) throw new Error(`${name} failed: ${text.slice(0, 500)}`);
    return JSON.parse(text);
  } finally { await mcp.close(); }
}

export function laneSpend() {
  try {
    return readFileSync(ledgerPath(), 'utf8').split('\n').filter(Boolean)
      .map(line => JSON.parse(line)).filter(entry => entry.app === 'adapter-agent')
      .reduce((sum, entry) => sum + (entry.usd || 0), 0);
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
}
