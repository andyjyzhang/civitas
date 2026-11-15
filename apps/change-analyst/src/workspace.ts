// Server-side workspace plumbing shared by the CLI and the LangGraph agent server:
// agents.config.json sources, run-config validation, and per-space Civitas credentials.
// Credentials stay in process memory and are only handed to the MCP bridge child process;
// they never enter graph state, messages, metadata, or logs.
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { AnalystError } from './errors.js';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const SPACE_ID_RE = /^sp_[A-Za-z0-9_-]{1,200}$/;
export const RUN_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

const SourceSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  label: z.string(),
  path: z.string().min(1),
  files: z.array(z.string().regex(/^[A-Za-z0-9._-]+$/)).min(1),
  topic: z.string().min(1),
  sourceUri: z.string().min(1),
  revision: z.string().min(1),
});
const ConsumerSchema = z.object({ role: z.string().regex(/^[a-z0-9_-]{1,50}$/), label: z.string(), path: z.string().min(1), topic: z.string().min(1) });
const AgentsConfigSchema = z.object({ sources: z.array(SourceSchema), consumers: z.array(ConsumerSchema) });
export type SourceConfig = z.infer<typeof SourceSchema>;
export type ConsumerConfig = z.infer<typeof ConsumerSchema>;

export function loadAgentsConfig() {
  return AgentsConfigSchema.parse(JSON.parse(readFileSync(resolve(ROOT, 'agents.config.json'), 'utf8')));
}

/** Resolves a config path relative to the repo root, refusing anything outside it. */
export function repoPath(path: string) {
  const full = resolve(ROOT, path);
  const rel = relative(ROOT, full);
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..') || rel.startsWith('.local')) throw new AnalystError(`Configured path ${path} is outside the repository.`);
  return full;
}

export function findSource(sourceId: unknown): SourceConfig {
  const source = typeof sourceId === 'string' ? loadAgentsConfig().sources.find(item => item.id === sourceId) : undefined;
  if (!source) throw new AnalystError('sourceId must be one of the sources in agents.config.json.');
  return source;
}

export function checkSpaceId(spaceId: unknown): string {
  if (typeof spaceId !== 'string' || !SPACE_ID_RE.test(spaceId)) throw new AnalystError('spaceId must match sp_[A-Za-z0-9_-]{1,200}.');
  return spaceId;
}

export function checkRunId(runId: unknown): string {
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) throw new AnalystError('runId must be 1-100 letters, digits, hyphens or underscores.');
  return runId;
}

export type Credentials = { relayUrl: string; token: string; spaceId: string };

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

/**
 * Reads `.local/workspace-agents/<spaceId>/<role>.env` (written by the web lane, mode 0600).
 * spaceId and role must already be validated; the file must name the same space.
 */
export function loadWorkspaceCredentials(spaceId: string, role: string): Credentials {
  checkSpaceId(spaceId);
  if (!/^[a-z0-9_-]{1,50}$/.test(role)) throw new AnalystError('Invalid agent role.');
  let text: string;
  try { text = readFileSync(resolve(ROOT, '.local/workspace-agents', spaceId, `${role}.env`), 'utf8'); }
  catch { throw new AnalystError(`No ${role} agent credential is connected for this space. Connect the workspace agents first.`); }
  const values = parseEnv(text);
  if (!values.CIVITAS_RELAY_URL || !values.CIVITAS_AGENT_TOKEN) throw new AnalystError(`The ${role} agent credential file is incomplete.`);
  if (values.CIVITAS_DEMO_SPACE_ID !== spaceId) throw new AnalystError(`The ${role} agent credential belongs to a different space.`);
  return { relayUrl: values.CIVITAS_RELAY_URL, token: values.CIVITAS_AGENT_TOKEN, spaceId };
}

/** CLI path: credentials from the process environment (loaded with --env-file). */
export function processCredentials(): Credentials {
  const { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN, CIVITAS_DEMO_SPACE_ID } = process.env;
  if (!CIVITAS_RELAY_URL || !CIVITAS_AGENT_TOKEN) throw new AnalystError('Load a private agent env file before using MCP.');
  return { relayUrl: CIVITAS_RELAY_URL, token: CIVITAS_AGENT_TOKEN, spaceId: CIVITAS_DEMO_SPACE_ID ?? 'sp_demo' };
}
